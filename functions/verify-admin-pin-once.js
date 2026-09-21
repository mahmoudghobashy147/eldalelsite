const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

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
  const pin = normalizePin(process.env.ADMIN_PIN_RESET_VALUE || '');
  if (!pin) throw new Error('ADMIN_PIN_RESET_VALUE missing');
  const [secretSnap, appSnap] = await Promise.all([
    db.collection('config').doc('adminSecrets').get(),
    db.collection('config').doc('appSettings').get(),
  ]);
  if (!secretSnap.exists) throw new Error('adminSecrets missing');
  const secret = secretSnap.data();
  const appData = appSnap.exists ? appSnap.data() : {};
  const actual = crypto.scryptSync(pin, Buffer.from(String(secret.salt), 'hex'), 64).toString('hex');
  const pinMatch = actual === String(secret.pinHash || '');
  const phoneMatch = normalizePhone(secret.phone) === normalizePhone(appData.adminPhone || '');
  let memberOk = false;
  if (secret.adminUid) {
    const memberSnap = await db.collection('members').doc(String(secret.adminUid)).get();
    memberOk = memberSnap.exists && memberSnap.data()?.isAdmin === true;
  }
  console.log('ADMIN_VERIFY_PIN_MATCH=' + pinMatch);
  console.log('ADMIN_VERIFY_PHONE_MATCH=' + phoneMatch);
  console.log('ADMIN_VERIFY_MEMBER_OK=' + memberOk);
  if (!pinMatch || !phoneMatch || !memberOk) process.exit(1);
})().catch((err) => {
  console.error('ADMIN_VERIFY_ERROR=' + (err?.message || err));
  process.exit(1);
});
