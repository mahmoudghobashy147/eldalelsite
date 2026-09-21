const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('adminLoginAttempts').get();
  let deleted = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    batchCount += 1;
    deleted += 1;
    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount) await batch.commit();
  console.log(`ADMIN_LOGIN_ATTEMPTS_CLEARED=${deleted}`);
})().catch((err) => {
  console.error('ADMIN_LOGIN_ATTEMPTS_CLEAR_ERROR=' + (err?.message || err));
  process.exit(1);
});
