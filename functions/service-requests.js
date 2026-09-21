const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const RATE_WINDOW_MS = 10 * 60 * 1000;
const ANON_LIMIT = 3;
const AUTH_LIMIT = 5;

const EGYPT_GOVERNORATES = new Set([
  "القاهرة","الجيزة","الإسكندرية","الدقهلية","البحيرة","الشرقية","المنوفية","القليوبية",
  "الغربية","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","شمال سيناء","جنوب سيناء",
  "بني سويف","الفيوم","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","الوادي الجديد",
  "مطروح","البحر الأحمر",
]);

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getClientIp(request) {
  const raw = request.rawRequest;
  const forwarded = raw?.headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded)
    ? String(forwarded[0] || "")
    : String(forwarded || "").split(",")[0].trim();
  return firstForwarded || raw?.ip || raw?.socket?.remoteAddress || "unknown";
}

function hashKey(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function enforceRateLimit(request) {
  const uid = request.auth?.uid || "";
  const subject = uid ? `uid:${uid}` : `ip:${getClientIp(request)}`;
  const limit = uid ? AUTH_LIMIT : ANON_LIMIT;
  const windowStartMs = Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const rateRef = db.collection("serviceRequestRateLimits").doc(
    hashKey(`${subject}:${windowStartMs}`)
  );

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateRef);
    const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
    if (count >= limit) {
      throw new HttpsError(
        "resource-exhausted",
        "تم إرسال طلبات كتير في وقت قصير. حاول تاني بعد شوية."
      );
    }

    tx.set(rateRef, {
      subjectHash: hashKey(subject),
      count: count + 1,
      windowStart: admin.firestore.Timestamp.fromMillis(windowStartMs),
      lastAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

const createServiceRequest = onCall(async (request) => {
  const text = cleanText(request.data?.text, 1500);
  if (!text) {
    throw new HttpsError("invalid-argument", "اكتب طلبك الأول");
  }

  const requestedGov = cleanText(request.data?.gov, 40);
  if (requestedGov && !EGYPT_GOVERNORATES.has(requestedGov)) {
    throw new HttpsError("invalid-argument", "المحافظة غير صحيحة");
  }

  const city = cleanText(request.data?.city, 100);
  const suppliedName = cleanText(request.data?.userName, 100);
  const suppliedPhone = cleanText(request.data?.phone, 25).replace(/[^0-9+]/g, "");

  await enforceRateLimit(request);

  const uid = request.auth?.uid || null;
  let userName = suppliedName;
  let phone = suppliedPhone;

  if (uid) {
    const memberSnap = await db.collection("members").doc(uid).get();
    if (memberSnap.exists) {
      const member = memberSnap.data() || {};
      userName = cleanText(member.name || suppliedName, 100);
      phone = cleanText(member.phone || suppliedPhone, 25).replace(/[^0-9+]/g, "");
    }
  }

  const ref = await db.collection("serviceRequests").add({
    text,
    gov: requestedGov,
    city,
    userId: uid,
    userName,
    phone,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
    source: "callable",
  });

  return { success: true, id: ref.id };
});

module.exports = { createServiceRequest };
