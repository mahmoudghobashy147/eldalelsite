const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const normalizePhone = (value) => {
  let digits = String(value || "")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");
  if (digits.startsWith("0020") && digits.length >= 14) digits = "0" + digits.slice(4);
  else if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return digits;
};

(async () => {
  const snap = await db.collection("members").get();
  let changed = 0, skipped = 0;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const normalized = normalizePhone(data.phone);
    if (!normalized || data.phoneNormalized === normalized) {
      skipped++;
      continue;
    }
    batch.set(doc.ref, { phoneNormalized: normalized }, { merge: true });
    changed++;
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops) await batch.commit();

  console.log("MEMBERS_TOTAL=" + snap.size);
  console.log("PHONE_NORMALIZED_BACKFILLED=" + changed);
  console.log("UNCHANGED_OR_NO_PHONE=" + skipped);
})().catch(e => { console.error(e?.stack || e); process.exit(1); });
