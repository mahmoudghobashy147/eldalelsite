const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const normalizePhone = (value) => {
  let digits = String(value || "")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return digits;
};

(async () => {
  const snap = await db.collection("members").where("status","==","approved").get();
  let authMissing=0, authMismatch=0, uidFieldMismatch=0, authOk=0, noPhone=0;
  const seen = new Map();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const phone = normalizePhone(d.phone);
    if (!phone) noPhone++;
    if (d.uid && d.uid !== doc.id) uidFieldMismatch++;
    if (phone) seen.set(phone, (seen.get(phone)||0)+1);
    const uid = d.uid || doc.id;
    try {
      const u = await admin.auth().getUser(uid);
      const emailPhone = normalizePhone(String(u.email||"").split("@")[0]);
      if (phone && emailPhone && phone !== emailPhone) authMismatch++;
      else authOk++;
    } catch (e) {
      if (e?.code === "auth/user-not-found") authMissing++;
      else throw e;
    }
  }
  const duplicates = [...seen.values()].filter(v => v > 1).length;
  console.log("APPROVED_TOTAL=" + snap.size);
  console.log("AUTH_OK=" + authOk);
  console.log("AUTH_MISSING=" + authMissing);
  console.log("AUTH_PHONE_MISMATCH=" + authMismatch);
  console.log("UID_FIELD_MISMATCH=" + uidFieldMismatch);
  console.log("NO_PHONE=" + noPhone);
  console.log("DUPLICATE_NORMALIZED_PHONES=" + duplicates);
})().catch(e => { console.error(e?.stack || e); process.exit(1); });
