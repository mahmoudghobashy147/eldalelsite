const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const normalizePhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('20') && digits.length >= 12) digits = '0' + digits.slice(2);
  return digits;
};

(async () => {
  const [appSnap, secretSnap] = await Promise.all([
    db.collection('config').doc('appSettings').get(),
    db.collection('config').doc('adminSecrets').get(),
  ]);

  const app = appSnap.exists ? appSnap.data() : {};
  const secret = secretSnap.exists ? secretSnap.data() : {};
  const adminUid = String(secret.adminUid || '');

  let memberExists = false;
  let memberIsAdmin = false;
  let authUserExists = false;
  let authUserDisabled = null;

  if (adminUid) {
    const memberSnap = await db.collection('members').doc(adminUid).get();
    memberExists = memberSnap.exists;
    memberIsAdmin = Boolean(memberSnap.exists && memberSnap.data()?.isAdmin === true);
    try {
      const user = await admin.auth().getUser(adminUid);
      authUserExists = true;
      authUserDisabled = Boolean(user.disabled);
    } catch (_) {
      authUserExists = false;
    }
  }

  const appPhone = normalizePhone(app.adminPhone || '');
  const secretPhone = normalizePhone(secret.phone || '');

  const result = {
    appSettingsExists: appSnap.exists,
    adminSecretsExists: secretSnap.exists,
    adminAuthMigrated: Boolean(app.adminAuthMigrated),
    legacyAdminPinPresent: Object.prototype.hasOwnProperty.call(app, 'adminPin') && String(app.adminPin || '').length > 0,
    hasPinHash: Boolean(secret.pinHash),
    hasSalt: Boolean(secret.salt),
    hasAdminUid: Boolean(adminUid),
    appAdminPhonePresent: Boolean(appPhone),
    secretPhonePresent: Boolean(secretPhone),
    phonesMatch: Boolean(appPhone && secretPhone && appPhone === secretPhone),
    adminMemberExists: memberExists,
    adminMemberIsAdmin: memberIsAdmin,
    firebaseAuthUserExists: authUserExists,
    firebaseAuthUserDisabled: authUserDisabled,
  };

  console.log('ADMIN_LOGIN_DIAGNOSTIC=' + JSON.stringify(result));

  const criticalOk = result.adminSecretsExists && result.hasPinHash && result.hasSalt && result.hasAdminUid && result.phonesMatch && result.adminMemberExists && result.adminMemberIsAdmin && result.firebaseAuthUserExists && result.firebaseAuthUserDisabled === false;
  if (!criticalOk) process.exitCode = 2;
})().catch((err) => {
  console.error('ADMIN_LOGIN_DIAGNOSTIC_ERROR=' + (err?.message || err));
  process.exit(1);
});
