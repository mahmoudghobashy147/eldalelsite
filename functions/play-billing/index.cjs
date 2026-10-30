const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onMessagePublished} = require('firebase-functions/v2/pubsub');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const {GoogleAuth} = require('google-auth-library');
const {PACKAGE, PRODUCTS, hash, accountId, entitlement} = require('./policy.cjs');
const db = admin.firestore();
const auth = new GoogleAuth({scopes:['https://www.googleapis.com/auth/androidpublisher']});
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases`;
async function google(path, method='GET', data) {
  const client = await auth.getClient();
  return (await client.request({url:base+path, method, data, timeout:15000})).data;
}
const endMs = member => member.subscriptionEnd?.toMillis?.() || Date.parse(member.subscriptionEnd) || 0;
async function sync(token, uid) {
  const observedAt = Date.now();
  const purchase = await google(`/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
  let e;
  try { e = entitlement(purchase, uid); } catch { throw new HttpsError('permission-denied','لا يمكن ربط عملية الشراء بهذا الحساب'); }
  const key = hash(token), ref = db.collection('playPurchases').doc(key), memberRef = db.collection('members').doc(uid);
  const now = Date.now();
  await db.runTransaction(async tx => {
    const [record, memberSnap] = await Promise.all([tx.get(ref), tx.get(memberRef)]);
    if (record.exists && record.data().checkedAtMs > observedAt) throw new HttpsError('aborted','أعد محاولة تأكيد الشراء');
    if (record.exists && record.data().uid !== uid) throw new HttpsError('permission-denied','الشراء مرتبط بحساب آخر');
    if (!memberSnap.exists || memberSnap.data().accountKind === 'customer') throw new HttpsError('failed-precondition','هذه الباقات لحساب المشترك');
    const member = memberSnap.data();
    // Never replace an independently paid manual entitlement or another active purchase.
    if (e.active && member.status === 'approved' && (!endMs(member) || endMs(member) > now) && member.playTokenHash !== key) throw new HttpsError('failed-precondition','لديك اشتراك سارٍ؛ انتظر انتهاءه قبل شراء اشتراك جديد');
    tx.set(ref,{uid,token,checkedAtMs:observedAt,productId:e.productId,state:e.state,expiry:admin.firestore.Timestamp.fromMillis(e.expiry),checkedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    if (e.active) tx.update(memberRef,{plan:e.plan,status:'approved',billingProvider:'google_play',playTokenHash:key,subscriptionEnd:admin.firestore.Timestamp.fromMillis(e.expiry),subscriptionStart:admin.firestore.Timestamp.fromDate(new Date(purchase.startTime || now)),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    else if (member.playTokenHash === key && member.billingProvider === 'google_play') tx.update(memberRef,{status:'pending',subscriptionEnd:admin.firestore.Timestamp.fromMillis(e.expiry),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
  });
  // Only acknowledge after the durable grant; retry safely after interrupted responses.
  if (e.active && purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') await google(`/subscriptions/${encodeURIComponent(e.productId)}/tokens/${encodeURIComponent(token)}:acknowledge`,'POST',{});
  return {active:e.active,plan:e.plan,expiry:e.expiry,state:e.state};
}
exports.preparePlayPurchase = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated','سجّل دخولك أولًا');
  const settings = await db.collection('config').doc('playBilling').get();
  if (settings.data()?.enabled !== true) throw new HttpsError('failed-precondition','الشراء غير متاح بعد؛ حاول لاحقًا');
  const productId = request.data?.productId;
  if (!Object.hasOwn(PRODUCTS, productId || '')) throw new HttpsError('invalid-argument','باقة غير متاحة');
  const snap = await db.collection('members').doc(uid).get();
  if (!snap.exists || snap.data().accountKind === 'customer') throw new HttpsError('failed-precondition','يلزم حساب مشترك');
  if (snap.data().status === 'approved' && (!endMs(snap.data()) || endMs(snap.data()) > Date.now())) throw new HttpsError('failed-precondition','اشتراكك سارٍ؛ الشراء متاح بعد انتهائه');
  return {accountId:accountId(uid),productId};
});
exports.verifyPlayPurchase = onCall(async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated','سجّل دخولك أولًا');
  const token = request.data?.purchaseToken;
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) throw new HttpsError('invalid-argument','عملية شراء غير صالحة');
  return sync(token,request.auth.uid);
});
exports.playBillingNotifications = onMessagePublished('play-billing-notifications', async event => {
  const message = event.data.message.json;
  if (message?.packageName !== PACKAGE) return;
  const token = message.subscriptionNotification?.purchaseToken || message.voidedPurchaseNotification?.purchaseToken;
  if (!token) return;
  const snap = await db.collection('playPurchases').doc(hash(token)).get();
  // Unknown tokens are bound by signed-in verification, never by the notification alone.
  if (snap.exists) await sync(token,snap.data().uid);
});
exports.reconcilePlayPurchases = onSchedule('every 60 minutes', async () => {
  let cursor;
  do {
    let query = db.collection('playPurchases').orderBy(admin.firestore.FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      try { await sync(doc.data().token,doc.data().uid); }
      catch (error) { console.error('play-reconcile-failed',{record:doc.id,code:error.code || 'unknown'}); }
    }
    cursor = page.docs.at(-1);
    if (page.size < 100) break;
  } while (cursor);
});
