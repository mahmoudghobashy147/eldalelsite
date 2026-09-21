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

  if (!appSnap.exists) throw new Error('appSettings is missing');
  const app = appSnap.data() || {};

  // Idempotent: if a complete secure config already exists, do not change it.
  if (secretSnap.exists) {
    const secret = secretSnap.data() || {};
    if (secret.adminUid && secret.phone && secret.salt && secret.pinHash) {
      const memberSnap = await db.collection('members').doc(String(secret.adminUid)).get();
      const authUser = await admin.auth().getUser(String(secret.adminUid));
      if (!memberSnap.exists || memberSnap.data()?.isAdmin !== true || authUser.disabled) {
        throw new Error('Existing adminSecrets points to an invalid admin account');
      }
      console.log('ADMIN_AUTH_REPAIR=already-secure');
      return;
    }
    throw new Error('adminSecrets exists but is incomplete; refusing automatic overwrite');
  }

  const legacyPin = String(app.adminPin || '');
  const adminPhone = normalizePhone(app.adminPhone || '');
  if (!legacyPin) throw new Error('Legacy admin PIN is missing');
  if (!adminPhone) throw new Error('Admin phone is missing');

  // The legacy app maps phone login to this Firebase Auth email.
  const derivedEmail = `${adminPhone}@daleel.app`;
  const authUser = await admin.auth().getUserByEmail(derivedEmail);
  if (!authUser || authUser.disabled) throw new Error('Derived admin Auth user is missing or disabled');

  const memberRef = db.collection('members').doc(authUser.uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists || memberSnap.data()?.isAdmin !== true) {
    throw new Error('Derived Auth user is not an existing Firestore admin member');
  }

  const salt = crypto.randomBytes(24).toString('hex');
  const pinHash = hashPin(legacyPin, salt);

  await db.runTransaction(async (tx) => {
    const freshSecret = await tx.get(secretRef);
    if (freshSecret.exists) throw new Error('adminSecrets was created concurrently; aborting');

    tx.set(secretRef, {
      adminUid: authUser.uid,
      phone: adminPhone,
      salt,
      pinHash,
      migratedAt: FieldValue.serverTimestamp(),
      version: 1,
      migrationSource: 'legacy-appSettings',
    });

    tx.set(appRef, {
      adminPin: FieldValue.delete(),
      adminAuthMigrated: true,
    }, { merge: true });
  });

  console.log('ADMIN_AUTH_REPAIR=migrated-successfully');
})().catch((err) => {
  console.error('ADMIN_AUTH_REPAIR_ERROR=' + (err?.message || err));
  process.exit(1);
});
