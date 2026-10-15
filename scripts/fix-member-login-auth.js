const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
const fnPath = path.join(__dirname, "..", "functions", "index.js");
let app = fs.readFileSync(appPath, "utf8");
let fn = fs.readFileSync(fnPath, "utf8");
let appChanged = false;
let fnChanged = false;

// ---- Client phone normalization: keep display value, canonicalize only for auth/indexing.
if (!app.includes("const normalizeMemberPhone = (value) =>")) {
  const anchor = '  const phoneToEmail = (phone) => \`\${phone.replace(/\\s/g,"")}@daleel.app\`;';
  if (!app.includes(anchor)) throw new Error("Member login patch: phoneToEmail anchor not found");
  const replacement = `  const normalizeMemberPhone = (value) => {
    let digits = String(value ?? "")
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/\\D/g, "");
    if (digits.startsWith("0020") && digits.length >= 14) digits = "0" + digits.slice(4);
    else if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);
    if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
    return digits;
  };
  const phoneToEmail = (phone) => \`\${normalizeMemberPhone(phone)}@daleel.app\`;`;
  app = app.replace(anchor, replacement);
  appChanged = true;
}

// ---- Replace ordinary member login with server-side phone resolver + real Firebase Auth session.
if (!app.includes('httpsCallable(functions, "secureMemberLogin")')) {
  const startAnchor = '    if(!form.phone||!form.pin) return setError("أدخل رقم الموبايل والرقم السري");';
  const endAnchor = '\n  };\n\n  // Step 1: Create Firebase account';
  const start = app.indexOf(startAnchor);
  const end = app.indexOf(endAnchor, start);
  if (start < 0 || end < 0) throw new Error("Member login patch: login block anchors not found");

  const block = `    if(!form.phone||!form.pin) return setError("أدخل رقم الموبايل والرقم السري");
    const normalizedMemberPhone = normalizeMemberPhone(form.phone);
    if(normalizedMemberPhone.length < 11) return setError("رقم الموبايل غير صحيح");
    if(String(form.pin).trim().length < 4) return setError("الرقم السري 4 أرقام على الأقل");

    setLoading(true); setError("");
    try {
      // السيرفر يطابق رقم البروفايل الحالي مع UID الحقيقي في Firebase Auth.
      // ده يخلي العضو يدخل حتى لو رقم موبايله اتعدل بعد التسجيل أو اتخزن بصيغة +20/20/0.
      const secureLogin = httpsCallable(functions, "secureMemberLogin");
      const resolved = await secureLogin({ phone: form.phone, pin: form.pin });
      const authEmail = String(resolved?.data?.authEmail || "");
      const expectedUid = String(resolved?.data?.uid || "");
      if (!authEmail) throw Object.assign(new Error("member-login-no-email"), { code:"functions/internal" });

      const cred = await DB.signIn(authEmail, String(form.pin).trim());
      if (expectedUid && cred.user.uid !== expectedUid) {
        await DB.signOut();
        throw Object.assign(new Error("member-login-uid-mismatch"), { code:"functions/internal" });
      }

      const memberSnap = await getDoc(doc(db, "members", cred.user.uid));
      const memberData = memberSnap.exists() ? memberSnap.data() : {};
      const u = {
        uid: cred.user.uid,
        email: cred.user.email,
        phone: memberData.phone || form.phone,
        displayName: memberData.name || cred.user.displayName || form.phone,
      };
      localStorage.setItem("daleel_user", JSON.stringify(u));
      onLogin(u);
    } catch(e) {
      const code = String(e?.code || "");
      const message = String(e?.message || "");
      if (code.includes("resource-exhausted")) setError("محاولات دخول كثيرة. حاول بعد شوية");
      else if (code.includes("not-found")) setError("رقم الموبايل غير مسجل");
      else if (code.includes("failed-precondition") || message.includes("member-login-missing")) {
        setError("الحساب موجود في الدليل لكن بيانات الدخول محتاجة إعادة ربط من الإدارة");
      }
      else if (code.includes("permission-denied") || code.includes("invalid-argument") || code.includes("invalid-credential") || code.includes("wrong-password")) {
        setError("رقم الموبايل أو الرقم السري غير صحيح");
      }
      else if (code.includes("unavailable") || code.includes("network") || code.includes("internal")) {
        setError("تعذر الاتصال بخادم تسجيل الدخول. حاول مرة أخرى");
      }
      else setError(\`تعذر تسجيل الدخول (\${code||"بدون كود"})\`);
    }
    setLoading(false);`;

  app = app.slice(0, start) + block + app.slice(end);
  appChanged = true;
}

// ---- New registrations use canonical auth email and store a normalized lookup key.
if (!app.includes('phoneNormalized: normalizeMemberPhone(form.phone)') && !app.includes('phoneNormalized:registrationPhone')) {
  app = app.replace(
    'const cred = await DB.signUp(email, form.pin, { name:form.name, phone:form.phone, type:"starter" });',
    'const cred = await DB.signUp(email, form.pin, { name:form.name, phone:form.phone, phoneNormalized:normalizeMemberPhone(form.phone), type:"starter" });'
  );
  app = app.replace(
    '        name: form.name, phone: form.phone,\n        type: form.type, specialty: form.specialty,',
    '        name: form.name, phone: form.phone, phoneNormalized: normalizeMemberPhone(form.phone),\n        type: form.type, specialty: form.specialty,'
  );
  appChanged = true;
}

// ---- Functions import for automatic phoneNormalized maintenance.
if (!fn.includes("onDocumentWritten")) {
  const oldImport = 'const { onDocumentCreated } = require("firebase-functions/v2/firestore");';
  if (!fn.includes(oldImport)) throw new Error("Member login patch: firestore import anchor not found");
  fn = fn.replace(oldImport, 'const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");');
  fnChanged = true;
}

// ---- Admin password reset now repairs the single class of approved members that has no Auth user.
const resetStartMarker = "exports.resetMemberPassword = onCall(async (request) => {";
const migrationMarker = "// 2) ترحيل دخول الأدمن من السر العام القديم إلى Secret server-side";
if (!fn.includes("createdLogin: true") && !fn.includes("Legacy/imported member: create the missing Auth identity")) {
  const start = fn.indexOf(resetStartMarker);
  const markerPos = fn.indexOf(migrationMarker, start);
  if (start < 0 || markerPos < 0) throw new Error("Member login patch: reset password anchors not found");
  const sectionStart = fn.lastIndexOf("// ─────────────────────────────────────────────", markerPos);
  const resetEnd = sectionStart >= 0 ? sectionStart : markerPos;
  const newReset = `exports.resetMemberPassword = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  const { memberId, newPassword } = request.data || {};
  if (!memberId || !newPassword || String(newPassword).length < 6) {
    throw new HttpsError("invalid-argument", "بيانات ناقصة أو كلمة السر أقل من 6 أرقام");
  }

  const memberSnap = await db.collection("members").doc(String(memberId)).get();
  if (!memberSnap.exists) throw new HttpsError("not-found", "العضو غير موجود");
  const member = memberSnap.data() || {};

  try {
    await admin.auth().updateUser(String(memberId), { password: String(newPassword) });
    return { success: true, createdLogin: false };
  } catch (e) {
    if (e?.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "فشل تغيير كلمة السر");
    }
  }

  const phone = normalizePhone(member.phone);
  if (!phone) throw new HttpsError("failed-precondition", "رقم العضو غير صالح لإنشاء حساب الدخول");
  const email = \`\${phone}@daleel.app\`;

  try {
    await admin.auth().createUser({
      uid: String(memberId),
      email,
      password: String(newPassword),
      displayName: String(member.name || ""),
      disabled: false,
    });
    await memberSnap.ref.set({
      phoneNormalized: phone,
      loginProvisionedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true, createdLogin: true };
  } catch (e) {
    if (e?.code === "auth/email-already-exists") {
      throw new HttpsError("failed-precondition", "رقم الموبايل مرتبط بحساب دخول آخر ويحتاج مراجعة الإدارة");
    }
    throw new HttpsError("internal", "فشل إنشاء حساب دخول للعضو");
  }
});

`;
  fn = fn.slice(0, start) + newReset + fn.slice(resetEnd);
  fnChanged = true;
}

// ---- Secure member login: resolve current profile phone -> real Auth email, verify PIN server-side.
if (!fn.includes("exports.secureMemberLogin = onCall")) {
  const insertMarker = "// 2) ترحيل دخول الأدمن من السر العام القديم إلى Secret server-side";
  const markerPos = fn.indexOf(insertMarker);
  const sectionStart = fn.lastIndexOf("// ─────────────────────────────────────────────", markerPos);
  if (markerPos < 0 || sectionStart < 0) throw new Error("Member login patch: secure login insert anchor not found");

  const secureMember = `// ─────────────────────────────────────────────
// دخول الأعضاء الآمن بالرقم الحالي في البروفايل.
// لا نكشف إيميل Firebase القديم إلا بعد التحقق الصحيح من الرقم السري.
// ─────────────────────────────────────────────
const FIREBASE_WEB_API_KEY_FOR_AUTH = process.env.MEMBER_LOGIN_API_KEY;

const memberPhoneVariants = (phone) => {
  const local = normalizePhone(phone);
  if (!local) return [];
  const withoutZero = local.startsWith("0") ? local.slice(1) : local;
  return [...new Set([local, withoutZero, "20" + withoutZero, "+20" + withoutZero, "0020" + withoutZero])];
};

async function findMembersByNormalizedPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  const byNormalized = await db.collection("members").where("phoneNormalized", "==", normalized).limit(10).get();
  if (!byNormalized.empty) return byNormalized.docs;

  const variants = memberPhoneVariants(normalized).slice(0, 10);
  if (variants.length) {
    const byRaw = await db.collection("members").where("phone", "in", variants).limit(10).get();
    if (!byRaw.empty) return byRaw.docs.filter(d => normalizePhone(d.data()?.phone) === normalized);
  }

  // Fallback للبيانات القديمة فقط. بعد الـ backfill الطبيعي المسار ده نادراً ما يتنفذ.
  const legacy = await db.collection("members").select("phone", "uid", "name", "status").get();
  return legacy.docs.filter(d => normalizePhone(d.data()?.phone) === normalized).slice(0, 10);
}

async function verifyFirebasePassword(email, password) {
  const response = await fetch(
    \`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=\${FIREBASE_WEB_API_KEY_FOR_AUTH}\`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: String(password), returnSecureToken: true }),
    }
  );
  const body = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, localId: String(body.localId || "") };
  const reason = String(body?.error?.message || "");
  if (["INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND", "INVALID_PASSWORD", "USER_DISABLED"].some(x => reason.includes(x))) {
    return { ok: false };
  }
  console.error("Firebase Auth verification rejected", {
    status: response.status,
    reason: reason.slice(0, 100),
  });
  throw new HttpsError("internal", "تعذر التحقق من بيانات الدخول");
}

exports.secureMemberLogin = onCall({ invoker: "public", secrets: ["MEMBER_LOGIN_API_KEY"] }, async (request) => {
  const phone = normalizePhone(request.data?.phone);
  const pin = normalizePin(request.data?.pin);
  if (!phone || pin.length < 4 || pin.length > 128) {
    throw new HttpsError("invalid-argument", "بيانات الدخول غير صحيحة");
  }

  let loginStage = "rate_limit";
  try {
  const rawIp = String(request.rawRequest?.ip || request.rawRequest?.headers?.["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const attemptKey = crypto.createHash("sha256").update(rawIp + "|" + phone).digest("hex").slice(0, 40);
  const attemptRef = db.collection("memberLoginAttempts").doc(attemptKey);
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const attemptSnap = await attemptRef.get();
  const attemptData = attemptSnap.exists ? attemptSnap.data() : {};
  const windowStartMs = attemptData.windowStart?.toMillis?.() || 0;
  const sameWindow = windowStartMs && now - windowStartMs < windowMs;
  const attempts = sameWindow ? Number(attemptData.attempts || 0) : 0;
  if (attempts >= 10) throw new HttpsError("resource-exhausted", "محاولات كثيرة. حاول لاحقاً");

  loginStage = "member_lookup";
  const candidates = await findMembersByNormalizedPhone(phone);
  if (!candidates.length) {
    throw new HttpsError("not-found", "رقم الموبايل غير مسجل");
  }

  let authUsersFound = 0;
  for (const memberDoc of candidates) {
    const member = memberDoc.data() || {};
    const uid = String(member.uid || memberDoc.id);
    let authUser;
    try {
      loginStage = "auth_user_lookup";
      authUser = await admin.auth().getUser(uid);
      authUsersFound++;
    } catch (e) {
      if (e?.code === "auth/user-not-found") continue;
      throw new HttpsError("internal", "تعذر قراءة حساب الدخول");
    }
    if (!authUser.email) continue;

    loginStage = "password_verification";
    const verified = await verifyFirebasePassword(authUser.email, pin);
    if (verified.ok && (!verified.localId || verified.localId === uid)) {
      await attemptRef.delete().catch(() => {});
      return { success: true, authEmail: authUser.email, uid };
    }
  }

  if (!authUsersFound) {
    throw new HttpsError("failed-precondition", "member-login-missing");
  }

  loginStage = "record_failed_attempt";
  await attemptRef.set({
    attempts: attempts + 1,
    windowStart: sameWindow && attemptData.windowStart ? attemptData.windowStart : FieldValue.serverTimestamp(),
    lastAttemptAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  throw new HttpsError("permission-denied", "رقم الموبايل أو الرقم السري غير صحيح");
  } catch (error) {
    // Never log phone numbers, passwords, auth emails, or request bodies.
    console.error("secureMemberLogin failed", {
      stage: loginStage,
      code: String(error?.code || "unknown").slice(0, 80),
      errorType: String(error?.name || "Error").slice(0, 80),
    });
    throw error;
  }
});

// يحافظ تلقائياً على مفتاح بحث موحّد لأي رقم يتغير من المستخدم أو الإدارة.
exports.syncMemberPhoneNormalized = onDocumentWritten("members/{memberId}", async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data() || {};
  const normalized = normalizePhone(data.phone);
  if (!normalized || data.phoneNormalized === normalized) return;
  await after.ref.set({ phoneNormalized: normalized }, { merge: true });
});

`;
  fn = fn.slice(0, sectionStart) + secureMember + fn.slice(sectionStart);
  fnChanged = true;
}

if (appChanged) fs.writeFileSync(appPath, app, "utf8");
if (fnChanged) fs.writeFileSync(fnPath, fn, "utf8");
console.log(appChanged || fnChanged ? "✅ Member login compatibility patch applied" : "✓ Member login compatibility patch already applied");
