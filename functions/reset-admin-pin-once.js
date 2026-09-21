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
  if (newPin.length < 6 || newPin.length > 64) {
    throw new Error('ADMIN_PIN_RESET_VALUE must be 6-64 characters');
  }

  const appRef = db.collection('config').doc('appSettings');
  const secretRef = db.collection('config').doc('adminSecrets');
  const [appSnap, secretSnap] = await Promise.all([appRef.get(), secretRef.get()]);
  const appData = appSnap.exists ? appSnap.data() : {};
  const secret = secretSnap.exists ? secretSnap.data() : {};

  if (!secret.adminUid) throw new Error('adminSecrets.adminUid is missing');
  const memberSnap = await db.collection('members').doc(String(secret.adminUid)).get();
  if (!memberSnap.exists || memberSnap.data()?.isAdmin !== true) {
    throw new Error('Configured admin account is not valid');
  }

  const phone = normalizePhone(appData.adminPhone || secret.phone || '');
  if (!phone) throw new Error('Admin phone is missing');

  const salt = crypto.randomBytes(24).toString('hex');
  const pinHash = crypto.scryptSync(newPin, Buffer.from(salt, 'hex'), 64).toString('hex');

  await db.runTransaction(async (tx) => {
    tx.set(secretRef, {
      adminUid: String(secret.adminUid),
      phone,
      salt,
      pinHash,
      version: Number(secret.version || 1) + 1,
      resetAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(appRef, {
      adminPin: FieldValue.delete(),
      adminAuthMigrated: true,
    }, { merge: true });
  });

  const attempts = await db.collection('adminLoginAttempts').get();
  let batch = db.batch();
  let count = 0;
  for (const d of attempts.docs) {
    batch.delete(d.ref);
    count += 1;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 400 !== 0) await batch.commit();

  console.log('ADMIN_PIN_RESET_SUCCESS=true');
  console.log('ADMIN_LOGIN_ATTEMPTS_CLEARED=' + count);
})().catch((err) => {
  console.error('ADMIN_PIN_RESET_ERROR=' + (err?.message || err));
  process.exit(1);
});
