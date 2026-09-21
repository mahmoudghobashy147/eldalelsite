const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const normalizeDigits = (value) => String(value ?? '')
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const normalizePin = (value) => normalizeDigits(value).trim();
const normalizePhone = (value) => {
  let digits = normalizeDigits(value).replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length >= 12) digits = '0' + digits.slice(2);
  return digits;
};

(async () => {
  const newPin = normalizePin(process.env.ADMIN_PIN_RESET_VALUE || '');
  if (newPin.length < 6 || newPin.length > 64) throw new Error('ADMIN_PIN_RESET_VALUE must be 6-64 characters');

  const appRef = db.collection('config').doc('appSettings');
  const secretRef = db.collection('config').doc('adminSecrets');
  const [appSnap, secretSnap] = await Promise.all([appRef.get(), secretRef.get()]);
  const appData = appSnap.exists ? appSnap.data() : {};
  const secret = secretSnap.exists ? secretSnap.data() : {};
  const adminUid = String(secret.adminUid || '');
  if (!adminUid) throw new Error('adminSecrets.adminUid is missing');

  const memberSnap = await db.collection('members').doc(adminUid).get();
  if (!memberSnap.exists || memberSnap.data()?.isAdmin !== true) throw new Error('Configured admin account is not valid');
  const phone = normalizePhone(appData.adminPhone || secret.phone || '');
  if (!phone) throw new Error('Admin phone is missing');

  const authUser = await admin.auth().getUser(adminUid);
  await admin.auth().updateUser(adminUid, { password: newPin });

  const salt = crypto.randomBytes(24).toString('hex');
  const pinHash = crypto.scryptSync(newPin, Buffer.from(salt, 'hex'), 64).toString('hex');
  await db.runTransaction(async (tx) => {
    tx.set(secretRef, {
      adminUid,
      phone,
      salt,
      pinHash,
      version: Number(secret.version || 1) + 1,
      resetAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(appRef, { adminPin: FieldValue.delete(), adminAuthMigrated: true }, { merge: true });
  });

  console.log('ADMIN_PIN_RESET_SUCCESS=true');
  console.log('ADMIN_FIREBASE_AUTH_PASSWORD_SYNCED=true');
  console.log('ADMIN_AUTH_EMAIL=' + String(authUser.email || ''));
})().catch((err) => {
  console.error('ADMIN_PIN_RESET_ERROR=' + (err?.message || err));
  process.exit(1);
});
