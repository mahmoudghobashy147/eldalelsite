const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const normalizeDigits = (value) => String(value ?? '')
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

const normalizePhone = (value) => {
  let digits = normalizeDigits(value).replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length >= 12) digits = '0' + digits.slice(2);
  return digits;
};

const normalizePin = (value) => normalizeDigits(value).trim();
const rawHashPin = (pin, saltHex) => crypto.scryptSync(String(pin), Buffer.from(saltHex, 'hex'), 64).toString('hex');
const pinVariants = (value) => {
  const raw = String(value ?? '').trim();
  const ascii = normalizePin(raw);
  const arabic = ascii.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const persian = ascii.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  return [...new Set([raw, ascii, arabic, persian])];
};

(async () => {
  const appRef = db.collection('config').doc('appSettings');
  const secretRef = db.collection('config').doc('adminSecrets');
  const [appSnap, secretSnap] = await Promise.all([appRef.get(), secretRef.get()]);
  const appData = appSnap.exists ? appSnap.data() : {};
  const secret = secretSnap.exists ? secretSnap.data() : {};

  const secretReady = !!(secretSnap.exists && secret.pinHash && secret.salt && secret.adminUid);
  const publicPinPresent = typeof appData.adminPin === 'string' && appData.adminPin.trim().length > 0;
  const appPhonePresent = normalizePhone(appData.adminPhone).length > 0;
  const secretPhonePresent = normalizePhone(secret.phone).length > 0;
  const phoneMatch = appPhonePresent && secretPhonePresent && normalizePhone(appData.adminPhone) === normalizePhone(secret.phone);

  let memberOk = false;
  if (secret.adminUid) {
    const memberSnap = await db.collection('members').doc(String(secret.adminUid)).get();
    memberOk = memberSnap.exists && memberSnap.data()?.isAdmin === true;
  }

  let pinMatch = null;
  if (secretReady && publicPinPresent) {
    const expected = Buffer.from(String(secret.pinHash), 'hex');
    pinMatch = pinVariants(appData.adminPin).some((candidate) => {
      const actual = Buffer.from(rawHashPin(candidate, String(secret.salt)), 'hex');
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    });
  }

  console.log('ADMIN_DIAG_SECRET_READY=' + secretReady);
  console.log('ADMIN_DIAG_MEMBER_OK=' + memberOk);
  console.log('ADMIN_DIAG_PUBLIC_PIN_PRESENT=' + publicPinPresent);
  console.log('ADMIN_DIAG_PHONE_MATCH=' + phoneMatch);
  console.log('ADMIN_DIAG_PIN_MATCH=' + (pinMatch === null ? 'UNKNOWN' : pinMatch));

  if (!secretReady || !memberOk) {
    console.log('ADMIN_REPAIR_ACTION=SKIPPED_UNSAFE_STATE');
    return;
  }

  const patch = {};
  let repairedPin = false;
  let repairedPhone = false;

  if (publicPinPresent && pinMatch === false) {
    const canonicalPin = normalizePin(appData.adminPin);
    if (canonicalPin.length >= 4 && canonicalPin.length <= 64) {
      const salt = crypto.randomBytes(24).toString('hex');
      patch.salt = salt;
      patch.pinHash = rawHashPin(canonicalPin, salt);
      patch.repairedAt = FieldValue.serverTimestamp();
      patch.version = Number(secret.version || 1) + 1;
      repairedPin = true;
    }
  }

  if (appPhonePresent && !phoneMatch) {
    patch.phone = normalizePhone(appData.adminPhone);
    patch.phoneRepairedAt = FieldValue.serverTimestamp();
    repairedPhone = true;
  }

  if (repairedPin || repairedPhone || publicPinPresent) {
    await db.runTransaction(async (tx) => {
      if (repairedPin || repairedPhone) tx.set(secretRef, patch, { merge: true });
      if (publicPinPresent) {
        tx.set(appRef, {
          adminPin: FieldValue.delete(),
          adminAuthMigrated: true,
        }, { merge: true });
      }
    });
  }

  console.log('ADMIN_REPAIR_PIN=' + repairedPin);
  console.log('ADMIN_REPAIR_PHONE=' + repairedPhone);
  console.log('ADMIN_REPAIR_PUBLIC_PIN_REMOVED=' + publicPinPresent);
})().catch((err) => {
  console.error('ADMIN_DIAG_REPAIR_ERROR=' + (err?.message || err));
  process.exit(1);
});
