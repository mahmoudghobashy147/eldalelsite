const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const crypto = require("crypto");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const normalizeArabic = (value = "") => String(value)
  .replace(/[إأآا]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const stripArabicPrefix = (word = "") => word.replace(/^(و|ف|ب|ك|ل)?ال/, "") || word;

const arabicTextIncludes = (haystack = "", needle = "") => {
  const haystackTokens = normalizeArabic(haystack).split(" ").filter(Boolean).map(stripArabicPrefix);
  const needleTokens = normalizeArabic(needle).split(" ").filter(Boolean).map(stripArabicPrefix);
  if (!needleTokens.length) return true;
  if (!haystackTokens.length) return false;
  return needleTokens.every((needleToken) =>
    haystackTokens.some((haystackToken) =>
      haystackToken.includes(needleToken) || needleToken.includes(haystackToken)
    )
  );
};

function deterministicNotificationId(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

async function createPersonalNotification(recipientId, data = {}, idempotencyKey = "") {
  if (!recipientId) return null;
  const payload = {
    recipientId,
    title: String(data.title || "الدليل الشامل").slice(0, 120),
    body: String(data.body || "").slice(0, 500),
    icon: data.icon || "🔔",
    color: data.color || "#3B82F6",
    type: data.type || "system",
    url: data.url || "/",
    time: FieldValue.serverTimestamp(),
    read: false,
    ...(data.meta || {}),
  };

  if (!idempotencyKey) return db.collection("notifications").add(payload);

  const notificationRef = db.collection("notifications").doc(
    deterministicNotificationId(`${idempotencyKey}:${recipientId}`)
  );
  try {
    await notificationRef.create(payload);
  } catch (error) {
    // Firestore event handlers can retry. If this exact event already created its
    // notification, treat the duplicate create as success instead of generating
    // another document (and another push notification).
    if (error?.code === 6 || error?.code === "already-exists") return notificationRef;
    throw error;
  }
  return notificationRef;
}

const notifyProfileView = onCall(async (request) => {
  const viewerId = request.auth?.uid;
  if (!viewerId) throw new HttpsError("unauthenticated", "لازم تكون مسجل دخول");

  const profileOwnerId = String(request.data?.profileOwnerId || "");
  if (!profileOwnerId || profileOwnerId === viewerId) return { success: true, skipped: true };

  const [viewerSnap, ownerSnap] = await Promise.all([
    db.collection("members").doc(viewerId).get(),
    db.collection("members").doc(profileOwnerId).get(),
  ]);
  if (!ownerSnap.exists) throw new HttpsError("not-found", "الملف الشخصي غير موجود");

  const rateKey = crypto.createHash("sha256").update(`${viewerId}:${profileOwnerId}`).digest("hex");
  const rateRef = db.collection("profileViewNotificationRate").doc(rateKey);
  const rateSnap = await rateRef.get();
  const lastSentMs = rateSnap.exists ? (rateSnap.data().lastSentAt?.toMillis?.() || 0) : 0;
  if (lastSentMs && Date.now() - lastSentMs < 10 * 60 * 1000) {
    return { success: true, skipped: true, rateLimited: true };
  }

  const viewerName = viewerSnap.exists ? String(viewerSnap.data().name || "عضو") : "عضو";
  await Promise.all([
    createPersonalNotification(profileOwnerId, {
      title: "زيارة جديدة",
      body: `${viewerName} دخل بروفايلك`,
      icon: "👁",
      color: "#10B981",
      type: "profileView",
      url: `/?member=${encodeURIComponent(profileOwnerId)}`,
      meta: { viewerId, profileOwnerId },
    }),
    rateRef.set({ viewerId, profileOwnerId, lastSentAt: FieldValue.serverTimestamp() }, { merge: true }),
  ]);

  return { success: true };
});

const notifyOnChatMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const messageSnap = event.data;
  if (!messageSnap) return;
  const data = messageSnap.data() || {};
  const senderId = String(data.senderId || "");
  if (!senderId) return;

  const chatSnap = await db.collection("chats").doc(event.params.chatId).get();
  if (!chatSnap.exists) return;
  const users = Array.isArray(chatSnap.data().users) ? chatSnap.data().users.map(String) : [];
  if (!users.includes(senderId)) return;
  const recipientId = users.find((uid) => uid !== senderId);
  if (!recipientId) return;

  const body = String(data.message || "");
  await createPersonalNotification(recipientId, {
    title: String(data.senderName || "عضو"),
    body: body.length > 60 ? body.slice(0, 60) + "…" : body,
    icon: "💬",
    color: "#3B82F6",
    type: "message",
    url: "/",
    meta: { chatId: event.params.chatId, senderId },
  }, `chat-message:${event.id}`);
});

const notifyOnFollowerCreated = onDocumentCreated("members/{followingId}/followers/{followerId}", async (event) => {
  const { followingId, followerId } = event.params;
  if (!followingId || !followerId || followingId === followerId) return;

  const followerSnap = await db.collection("members").doc(followerId).get();
  const followerName = followerSnap.exists ? String(followerSnap.data().name || "عضو") : "عضو";
  await createPersonalNotification(followingId, {
    title: "متابعة جديدة",
    body: `${followerName} بدأ يتابعك!`,
    icon: "👥",
    color: "#3B82F6",
    type: "follow",
    url: `/?member=${encodeURIComponent(followerId)}`,
    meta: { followerId, followingId },
  }, `follower-created:${event.id}`);
});

const notifyOnServiceRequest = onDocumentCreated("serviceRequests/{requestId}", async (event) => {
  const requestSnap = event.data;
  if (!requestSnap) return;
  const requestData = requestSnap.data() || {};
  const text = String(requestData.text || "").trim();
  if (!text) return;
  const gov = String(requestData.gov || "").trim();

  // الدليل مستهدف آلاف الأعضاء، لذلك ماينفعش نقف عند أول 500 عضو فقط.
  // نقرأ على دفعات 500، ونقف أول ما نوصل إلى 25 تطابق أو 5000 عضو كحد حماية.
  const matched = [];
  let lastDoc = null;
  let scanned = 0;
  const pageSize = 500;
  const maxScanned = 5000;

  while (matched.length < 25 && scanned < maxScanned) {
    let membersQuery = db.collection("members")
      .where("status", "==", "approved")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);
    if (lastDoc) membersQuery = membersQuery.startAfter(lastDoc);

    const membersSnap = await membersQuery.get();
    if (membersSnap.empty) break;
    scanned += membersSnap.size;

    for (const docSnap of membersSnap.docs) {
      const member = { id: docSnap.id, ...docSnap.data() };
      if (gov && String(member.gov || "").trim() !== gov) continue;
      const specialty = String(member.specialty || "").trim();
      if (!specialty || !arabicTextIncludes(text, specialty)) continue;
      matched.push(member);
      if (matched.length >= 25) break;
    }

    lastDoc = membersSnap.docs[membersSnap.docs.length - 1];
    if (membersSnap.size < pageSize) break;
  }

  const body = text.length > 70 ? text.slice(0, 70) + "…" : text;
  await Promise.all(matched.map((member) => createPersonalNotification(member.id, {
    title: "🛠️ طلب جديد يناسب تخصصك",
    body,
    icon: "🛠️",
    color: "#C9A84C",
    type: "serviceRequest",
    url: "/",
    meta: { serviceRequestId: event.params.requestId },
  }, `service-request:${event.id}`)));
});

module.exports = {
  notifyProfileView,
  notifyOnChatMessage,
  notifyOnFollowerCreated,
  notifyOnServiceRequest,
};
