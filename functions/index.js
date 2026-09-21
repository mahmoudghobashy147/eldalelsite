// ============================================================
// Cloud Functions — الدليل الشامل
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const crypto = require("crypto");
admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const normalizePhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);
  return digits;
};

const hashPin = (pin, saltHex) => crypto.scryptSync(String(pin), Buffer.from(saltHex, "hex"), 64).toString("hex");

async function requireAdmin(uid) {
  if (!uid) throw new HttpsError("unauthenticated", "لازم تكون مسجل دخول");
  const snap = await db.collection("members").doc(uid).get();
  if (!snap.exists || snap.data().isAdmin !== true) {
    throw new HttpsError("permission-denied", "الميزة دي للأدمن بس");
  }
  return snap.data();
}

// ─────────────────────────────────────────────
// 1) إعادة تعيين كلمة سر عضو — Admin فقط
// ─────────────────────────────────────────────
exports.resetMemberPassword = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  const { memberId, newPassword } = request.data || {};
  if (!memberId || !newPassword || String(newPassword).length < 6) {
    throw new HttpsError("invalid-argument", "بيانات ناقصة أو كلمة السر أقل من 6 أرقام");
  }

  try {
    await admin.auth().updateUser(memberId, { password: String(newPassword) });
    return { success: true };
  } catch (e) {
    throw new HttpsError("internal", "فشل تغيير كلمة السر: " + e.message);
  }
});

// ─────────────────────────────────────────────
// 2) ترحيل دخول الأدمن من السر العام القديم إلى Secret server-side
// تتنفذ مرة واحدة بعد نجاح دخول الأدمن القديم وتأكد isAdmin في Firestore.
// ─────────────────────────────────────────────
exports.migrateAdminAuth = onCall(async (request) => {
  const uid = request.auth?.uid;
  await requireAdmin(uid);

  const appRef = db.collection("config").doc("appSettings");
  const secretRef = db.collection("config").doc("adminSecrets");
  const [appSnap, secretSnap] = await Promise.all([appRef.get(), secretRef.get()]);

  if (secretSnap.exists && secretSnap.data().pinHash && secretSnap.data().salt) {
    // حتى لو الترحيل سبق، اتأكد إن أي نسخة قديمة من PIN اتمسحت من المستند العام.
    if (appSnap.exists && Object.prototype.hasOwnProperty.call(appSnap.data(), "adminPin")) {
      await appRef.set({ adminPin: FieldValue.delete() }, { merge: true });
    }
    return { success: true, alreadyMigrated: true };
  }

  const suppliedPin = String(request.data?.pin || "");
  const appData = appSnap.exists ? appSnap.data() : {};
  const legacyPin = String(appData.adminPin || "");
  if (!legacyPin || !suppliedPin || suppliedPin !== legacyPin) {
    throw new HttpsError("permission-denied", "تعذر تأكيد بيانات الأدمن للترحيل");
  }

  const adminPhone = normalizePhone(request.data?.phone || appData.adminPhone || "");
  if (!adminPhone) throw new HttpsError("failed-precondition", "رقم الأدمن غير مضبوط");

  const salt = crypto.randomBytes(24).toString("hex");
  const pinHash = hashPin(suppliedPin, salt);

  await db.runTransaction(async (tx) => {
    tx.set(secretRef, {
      adminUid: uid,
      phone: adminPhone,
      salt,
      pinHash,
      migratedAt: FieldValue.serverTimestamp(),
      version: 1,
    }, { merge: false });
    tx.set(appRef, {
      adminPin: FieldValue.delete(),
      adminAuthMigrated: true,
    }, { merge: true });
  });

  return { success: true, migrated: true };
});

// ─────────────────────────────────────────────
// 3) دخول الأدمن الآمن — لا يقرأ العميل PIN المخزن
// يرجع Firebase Custom Token بعد التحقق server-side.
// ─────────────────────────────────────────────
exports.secureAdminLogin = onCall(async (request) => {
  const phone = normalizePhone(request.data?.phone);
  const pin = String(request.data?.pin || "");
  if (!phone || pin.length < 4 || pin.length > 64) {
    throw new HttpsError("invalid-argument", "بيانات الدخول غير صحيحة");
  }

  const secretSnap = await db.collection("config").doc("adminSecrets").get();
  if (!secretSnap.exists || !secretSnap.data().pinHash || !secretSnap.data().salt) {
    throw new HttpsError("failed-precondition", "admin-auth-migration-required");
  }
  const secret = secretSnap.data();

  // Rate limit تقريبي حسب IP: 8 محاولات خلال 10 دقائق.
  const rawIp = String(request.rawRequest?.ip || request.rawRequest?.headers?.["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const ipKey = crypto.createHash("sha256").update(rawIp).digest("hex").slice(0, 32);
  const attemptRef = db.collection("adminLoginAttempts").doc(ipKey);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const attemptSnap = await attemptRef.get();
  const attemptData = attemptSnap.exists ? attemptSnap.data() : {};
  const windowStartMs = attemptData.windowStart?.toMillis?.() || 0;
  const sameWindow = windowStartMs && now - windowStartMs < windowMs;
  const attempts = sameWindow ? Number(attemptData.attempts || 0) : 0;
  if (attempts >= 8) {
    throw new HttpsError("resource-exhausted", "محاولات كثيرة. حاول لاحقاً");
  }

  const expected = Buffer.from(String(secret.pinHash), "hex");
  const actual = Buffer.from(hashPin(pin, String(secret.salt)), "hex");
  const phoneOk = phone === normalizePhone(secret.phone);
  const pinOk = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!phoneOk || !pinOk) {
    await attemptRef.set({
      attempts: attempts + 1,
      windowStart: sameWindow && attemptData.windowStart ? attemptData.windowStart : FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    throw new HttpsError("permission-denied", "رقم الموبايل أو الرقم السري غير صحيح");
  }

  const adminUid = String(secret.adminUid || "");
  await requireAdmin(adminUid);
  await attemptRef.delete().catch(() => {});

  const token = await admin.auth().createCustomToken(adminUid, { admin: true });
  return { success: true, token };
});

// ─────────────────────────────────────────────
// 4) تغيير PIN الأدمن بعد الترحيل — Admin authenticated فقط
// ─────────────────────────────────────────────
exports.changeAdminPin = onCall(async (request) => {
  const uid = request.auth?.uid;
  await requireAdmin(uid);
  const newPin = String(request.data?.newPin || "");
  if (newPin.length < 6 || newPin.length > 64) {
    throw new HttpsError("invalid-argument", "الرقم السري الجديد لازم يكون 6 خانات على الأقل");
  }

  const secretRef = db.collection("config").doc("adminSecrets");
  const snap = await secretRef.get();
  if (!snap.exists || String(snap.data().adminUid || "") !== uid) {
    throw new HttpsError("failed-precondition", "بيانات دخول الأدمن لم يتم ترحيلها بعد");
  }

  const salt = crypto.randomBytes(24).toString("hex");
  await secretRef.set({
    salt,
    pinHash: hashPin(newPin, salt),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

// ─────────────────────────────────────────────
// 5) إرسال Push Notification عند إنشاء إشعار
// ─────────────────────────────────────────────
exports.sendPushOnNotification = onDocumentCreated("notifications/{notifId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const recipientId = data.recipientId;
  if (!recipientId) return;

  const memberSnap = await db.collection("members").doc(recipientId).get();
  if (!memberSnap.exists) return;
  const tokens = memberSnap.data().fcmTokens || [];
  if (!tokens.length) return;

  const targetUrl = String(data.url || data.link || "/");
  const message = {
    notification: {
      title: data.title || "الدليل الشامل",
      body: data.body || "",
    },
    data: { url: targetUrl },
    webpush: { fcmOptions: { link: targetUrl } },
    android: { notification: { channelId: "default_channel" } },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    const invalidTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && [
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered",
      ].includes(r.error?.code)) {
        invalidTokens.push(tokens[idx]);
      }
    });
    if (invalidTokens.length) {
      await db.collection("members").doc(recipientId).update({
        fcmTokens: FieldValue.arrayRemove(...invalidTokens),
      });
    }
  } catch (e) {
    console.error("sendPushOnNotification error:", e);
  }
});
