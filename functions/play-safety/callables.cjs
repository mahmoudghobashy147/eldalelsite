'use strict';
// STAGED ONLY: deliberately not exported from functions/main.js.
// Existing catch-all rules deny direct client access to these collections.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { SafetyError, reportInput, blockInput, deletionInput, digest } = require('./core.cjs');
const db = admin.firestore();
const timestamp = () => admin.firestore.FieldValue.serverTimestamp();
const wrap = handler => onCall({ region: 'us-central1' }, async request => {
  try { return await handler(request); }
  catch (error) {
    if (error instanceof SafetyError) throw new HttpsError(error.code, error.message);
    if (error instanceof HttpsError) throw error;
    // Never return internal document paths, user data, or provider errors.
    throw new HttpsError('internal', 'تعذر إتمام الطلب، حاول مرة أخرى');
  }
});
exports.submitSafetyReport = wrap(async request => {
  const report = reportInput(request);
  const target = db.collection(report.targetType === 'post' ? 'posts' : 'members').doc(report.targetId);
  const ref = db.collection('safetyReports').doc(report.id);
  const quota = db.collection('safetyReportQuotas').doc(digest([report.reporterId]));
  return db.runTransaction(async transaction => {
    const [existing, subject, rate] = await Promise.all([transaction.get(ref), transaction.get(target), transaction.get(quota)]);
    if (existing.exists) return { accepted: true, duplicate: true };
    if (!subject.exists) throw new HttpsError('not-found', 'المحتوى غير موجود');
    if (report.targetType === 'member' && subject.data().status !== 'approved') throw new HttpsError('not-found', 'المحتوى غير موجود');
    const now = Date.now();
    const inWindow = rate.exists && now - rate.data().windowStart < 3600000;
    const count = inWindow ? rate.data().count : 0;
    if (count >= 10) throw new HttpsError('resource-exhausted', 'وصلت للحد المسموح، حاول لاحقًا');
    transaction.set(quota, { windowStart: inWindow ? rate.data().windowStart : now, count: count + 1 });
    const { id, ...record } = report;
    transaction.create(ref, { ...record, status: 'pending', createdAt: timestamp() });
    return { accepted: true, duplicate: false };
  });
});
exports.setSafetyBlock = wrap(async request => {
  const block = blockInput(request);
  const ref = db.collection('safetyBlocks').doc(block.id);
  // Store explicit false on unblock: avoids existence races and is idempotent.
  await ref.set({ blockerId: block.uid, blockedId: block.targetId, active: block.blocked, updatedAt: timestamp() });
  return { blocked: block.blocked };
});
exports.requestAccountDeletion = wrap(async request => {
  const { uid } = deletionInput(request, Date.now() / 1000);
  const ref = db.collection('accountDeletionRequests').doc(uid);
  return db.runTransaction(async transaction => {
    const existing = await transaction.get(ref);
    if (existing.exists) return { received: true, status: existing.data().status };
    transaction.create(ref, { uid, status: 'pending', createdAt: timestamp(), source: 'authenticated-app' });
    // A request is NOT completed deletion. No Auth/Firestore/Storage deletes here.
    return { received: true, status: 'pending' };
  });
});
