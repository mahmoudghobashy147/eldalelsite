const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const ALLOWED_STATS = new Set(["views", "calls", "waMessages"]);
const WINDOWS_MS = {
  views: 10 * 60 * 1000,
  calls: 5 * 60 * 1000,
  waMessages: 5 * 60 * 1000,
};

function getClientIp(request) {
  const raw = request.rawRequest;
  const forwarded = raw?.headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded)
    ? String(forwarded[0] || "")
    : String(forwarded || "").split(",")[0].trim();
  return firstForwarded || raw?.ip || raw?.socket?.remoteAddress || "unknown";
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

const recordMemberInteraction = onCall(async (request) => {
  const memberId = String(request.data?.memberId || "").trim();
  const stat = String(request.data?.stat || "").trim();
  if (!memberId || !ALLOWED_STATS.has(stat)) {
    throw new HttpsError("invalid-argument", "بيانات التفاعل غير صحيحة");
  }

  const memberRef = db.collection("members").doc(memberId);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists || memberSnap.data()?.status !== "approved") {
    throw new HttpsError("not-found", "العضو غير موجود");
  }

  const uid = request.auth?.uid || "";
  const subject = uid ? `uid:${uid}` : `ip:${getClientIp(request)}`;
  const windowMs = WINDOWS_MS[stat];
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const markerId = hash(`${subject}:${memberId}:${stat}:${windowStart}`);
  const markerRef = db.collection("memberInteractionRate").doc(markerId);

  const counted = await db.runTransaction(async (tx) => {
    const markerSnap = await tx.get(markerRef);
    if (markerSnap.exists) return false;

    tx.update(memberRef, { [stat]: FieldValue.increment(1) });
    tx.create(markerRef, {
      memberId,
      stat,
      subjectHash: hash(subject),
      windowStart: admin.firestore.Timestamp.fromMillis(windowStart),
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  return { success: true, counted };
});

module.exports = { recordMemberInteraction };
