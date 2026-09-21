const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const crypto = require("crypto");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function eventMarkerRef(eventId) {
  const safeId = crypto.createHash("sha256").update(String(eventId || "missing-event-id")).digest("hex");
  return db.collection("functionEvents").doc(safeId);
}

async function applyMemberCounterEvent(event, memberId, field, delta, type) {
  if (!memberId || !Number.isFinite(delta)) return;
  const memberRef = db.collection("members").doc(String(memberId));
  const markerRef = eventMarkerRef(event.id);

  await db.runTransaction(async (tx) => {
    const [markerSnap, memberSnap] = await Promise.all([
      tx.get(markerRef),
      tx.get(memberRef),
    ]);
    if (markerSnap.exists || !memberSnap.exists) return;

    const current = Number(memberSnap.data()?.[field] || 0);
    const next = Math.max(0, current + delta);
    tx.update(memberRef, { [field]: next });
    tx.set(markerRef, {
      type,
      memberId: String(memberId),
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

const updateFollowersOnCreate = onDocumentCreated("members/{followingId}/followers/{followerId}", async (event) => {
  const { followingId, followerId } = event.params;
  if (!followingId || !followerId || followingId === followerId) return;
  await applyMemberCounterEvent(event, followingId, "followersCount", 1, "follower-created");
});

const updateFollowersOnDelete = onDocumentDeleted("members/{followingId}/followers/{followerId}", async (event) => {
  const { followingId, followerId } = event.params;
  if (!followingId || !followerId || followingId === followerId) return;
  await applyMemberCounterEvent(event, followingId, "followersCount", -1, "follower-deleted");
});

const updateSavesOnCreate = onDocumentCreated("members/{userId}/saved/{savedMemberId}", async (event) => {
  const data = event.data?.data?.() || {};
  const targetMemberId = String(data.memberId || event.params.savedMemberId || "");
  if (!targetMemberId) return;
  await applyMemberCounterEvent(event, targetMemberId, "saves", 1, "saved-created");
});

const updateSavesOnDelete = onDocumentDeleted("members/{userId}/saved/{savedMemberId}", async (event) => {
  const data = event.data?.data?.() || {};
  const targetMemberId = String(data.memberId || event.params.savedMemberId || "");
  if (!targetMemberId) return;
  await applyMemberCounterEvent(event, targetMemberId, "saves", -1, "saved-deleted");
});

const updateRatingOnReviewCreate = onDocumentCreated("members/{memberId}/reviews/{reviewId}", async (event) => {
  const review = event.data?.data?.() || {};
  const rating = Number(review.rating);
  const memberId = String(event.params.memberId || "");
  if (!memberId || !Number.isFinite(rating) || rating < 1 || rating > 5) return;

  const memberRef = db.collection("members").doc(memberId);
  const markerRef = eventMarkerRef(event.id);

  await db.runTransaction(async (tx) => {
    const [markerSnap, memberSnap] = await Promise.all([
      tx.get(markerRef),
      tx.get(memberRef),
    ]);
    if (markerSnap.exists || !memberSnap.exists) return;

    const member = memberSnap.data() || {};
    const oldCount = Math.max(0, Number(member.reviews || 0));
    const oldRating = Math.max(0, Number(member.rating || 0));
    const newCount = oldCount + 1;
    const newRating = Math.round((((oldRating * oldCount) + rating) / newCount) * 10) / 10;

    tx.update(memberRef, { reviews: newCount, rating: newRating });
    tx.set(markerRef, {
      type: "review-created",
      memberId,
      reviewId: String(event.params.reviewId || ""),
      createdAt: FieldValue.serverTimestamp(),
    });
  });
});

module.exports = {
  updateFollowersOnCreate,
  updateFollowersOnDelete,
  updateSavesOnCreate,
  updateSavesOnDelete,
  updateRatingOnReviewCreate,
};
