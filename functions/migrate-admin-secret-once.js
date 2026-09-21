const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const normalizePhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length >= 12) digits = '0' + digits.slice(2);
  return digits;
};

const hashPin = (pin, saltHex) =>
  crypto.scryptSync(String(pin), Buffer.from(saltHex, 'hex'), 64).toString('hex');

(async () => {
  const appRef = db.collection('config').doc('appSettings');
  const secretRef = db.collection('config').doc('adminSecrets');
  const [appSnap, secretSnap] = await Promise.all([appRef.get(), secretRef.get()]);

  if (!appSnap.exists) throw new Error('appSettings missing');
  if (secretSnap.exists) throw new Error('adminSecrets already exists; refusing one-time migration');

  const app = appSnap.data() || {};
  const phone = normalizePhone(app.adminPhone || '');
  const legacyPin = String(app.adminPin || '');
  if (!phone) throw new Error('adminPhone missing');
  if (legacyPin.length < 4) throw new Error('legacy admin PIN missing');

  // The legacy admin Firebase account was deterministically created from the
  // configured admin phone. Resolve that exact account rather than guessing
  // between multiple Firestore documents marked isAdmin.
  const derivedEmail = `${phone}@daleel.app`;
  const authUser = await admin.auth().getUserByEmail(derivedEmail);
  if (!authUser || authUser.disabled) throw new Error('configured admin Auth user missing or disabled');

  const memberSnap = await db.collection('members').doc(authUser.uid).get();
  if (!memberSnap.exists || memberSnap.data()?.isAdmin !== true) {
    throw new Error('configured admin Auth UID is not an authorized admin member');
  }

  const salt = crypto.randomBytes(24).toString('hex');
  const pinHash = hashPin(legacyPin, salt);

  await db.runTransaction(async (tx) => {
    const freshSecret = await tx.get(secretRef);
    const freshApp = await tx.get(appRef);
    if (freshSecret.exists) throw new Error('adminSecrets appeared during migration; aborting');
    if (!freshApp.exists) throw new Error('appSettings disappeared during migration');

    const current = freshApp.data() || {};
    if (normalizePhone(current.adminPhone || '') !== phone) throw new Error('adminPhone changed during migration');
    if (String(current.adminPin || '') !== legacyPin) throw new Error('admin PIN changed during migration');

    tx.set(secretRef, {
      adminUid: authUser.uid,
      phone,
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

  console.log('ADMIN_SECRET_MIGRATION=success');
})().catch((err) => {
  console.error('ADMIN_SECRET_MIGRATION_ERROR=' + (err?.message || err));
  process.exit(1);
});
