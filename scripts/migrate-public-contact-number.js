const admin = require('../functions/node_modules/firebase-admin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'eldalel-elshamel';
const OLD_LOCAL = '01110001986';
const OLD_WA = '201110001986';
const NEW_LOCAL = '01039195832';
const NEW_WA = '201039195832';
const ADMIN_LOGIN_PHONE = '01110001986';

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

function publicPhonePatch(data = {}) {
  const patch = {};
  for (const key of ['phone','contactPhone','phoneNumber','contactNumber']) {
    if (data[key] === OLD_LOCAL || data[key] === OLD_WA) patch[key] = NEW_LOCAL;
  }
  for (const key of ['whatsapp','whatsApp','whatsappNumber']) {
    if (data[key] === OLD_LOCAL || data[key] === OLD_WA) patch[key] = NEW_WA;
  }
  return patch;
}

(async () => {
  const appRef = db.collection('config').doc('appSettings');
  const before = await appRef.get();
  const beforeData = before.exists ? before.data() : {};
  const originalAdminEmail = beforeData.adminEmail;

  // Public contact changes only. Admin login identity is explicitly preserved.
  await appRef.set({
    whatsapp: NEW_WA,
    contactPhone: NEW_LOCAL,
    adminPhone: ADMIN_LOGIN_PHONE,
  }, { merge: true });

  // Update public home-ad contact fields only when they still carry the old admin contact.
  const adsSnap = await db.collection('homeAds').get().catch(() => null);
  let adsUpdated = 0;
  if (adsSnap) {
    const batch = db.batch();
    for (const docSnap of adsSnap.docs) {
      const patch = publicPhonePatch(docSnap.data());
      if (Object.keys(patch).length) {
        batch.update(docSnap.ref, patch);
        adsUpdated++;
      }
    }
    if (adsUpdated) await batch.commit();
  }

  const after = await appRef.get();
  const data = after.data() || {};
  if (data.adminPhone !== ADMIN_LOGIN_PHONE) throw new Error('adminPhone changed unexpectedly');
  if (data.whatsapp !== NEW_WA) throw new Error('WhatsApp migration failed');
  if (data.contactPhone !== NEW_LOCAL) throw new Error('contactPhone migration failed');
  if (originalAdminEmail !== undefined && data.adminEmail !== originalAdminEmail) {
    throw new Error('adminEmail changed unexpectedly');
  }

  console.log(JSON.stringify({
    success: true,
    publicContactPhone: NEW_LOCAL,
    publicWhatsApp: NEW_WA,
    adminLoginPhonePreserved: data.adminPhone === ADMIN_LOGIN_PHONE,
    adminEmailPreserved: originalAdminEmail === undefined || data.adminEmail === originalAdminEmail,
    homeAdsUpdated: adsUpdated,
  }));
})().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
