/**
 * generate-sitemap.js
 * ============================================================
 * بيولّد sitemap.xml تلقائيًا من بيانات Firestore الحقيقية
 * (كل صنايعي/شركة معتمد + صفحات التخصصات والمحافظات) + robots.txt
 *
 * الاستخدام:
 *   1) npm install firebase-admin
 *   2) حط ملف مفتاح حساب الخدمة الجديد باسم serviceAccountKey.json في نفس الفولدر
 *   3) شغّل: node generate-sitemap.js
 *   4) الناتج هيتحط في public/sitemap.xml و public/robots.txt
 *   5) اعمل npm run build بعدها عشان الملفين يترفعوا مع باقي الموقع
 *
 * ملحوظة: نفّذ السكريبت ده كل ما تضيف صنايعية جداد بكمية كبيرة، أو اربطه
 * بجدولة تلقائية (GitHub Actions cron) لاحقًا لو حبيت يتحدّث لوحده يوميًا.
 * ============================================================
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SITE_URL = "https://eldalel-elshamel.online";

// --- نفس دالة slugify اللي في src/seo.js بالظبط، لازم تفضل متطابقة ---
function slugify(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMemberPath(member) {
  const type = member.type === "company" ? "companies" : "craftsmen";
  const parts = [member.name, member.specialty || member.category, member.city || member.governorate]
    .filter(Boolean)
    .map(slugify)
    .filter(Boolean);
  const descriptive = parts.join("-") || "profile";
  return `/${type}/${descriptive}-${member.id}`;
}

async function main() {
  console.log("📡 بجيب المستخدمين المعتمدين من Firestore...");
  const snapshot = await db.collection("members").where("status", "==", "approved").get();
  console.log(`✅ لقيت ${snapshot.size} حساب معتمد`);

  const urls = [];

  // الصفحات الثابتة
  const staticPages = ["", "craftsmen", "companies", "about", "how-it-works", "faq", "privacy", "terms"];
  staticPages.forEach((p) => {
    urls.push({ loc: `${SITE_URL}/${p}`, priority: p === "" ? "1.0" : "0.6", changefreq: "weekly" });
  });

  // صفحات الأعضاء (صنايعية/شركات)
  const specialties = new Set();
  const governorates = new Set();

  snapshot.forEach((docSnap) => {
    const member = { id: docSnap.id, ...docSnap.data() };
    urls.push({
      loc: `${SITE_URL}${buildMemberPath(member)}`,
      priority: "0.8",
      changefreq: "weekly",
    });
    if (member.specialty) specialties.add(member.specialty);
    if (member.city || member.governorate) governorates.add(member.city || member.governorate);
  });

  // صفحات التخصصات
  specialties.forEach((s) => {
    urls.push({ loc: `${SITE_URL}/specialties/${encodeURIComponent(slugify(s))}`, priority: "0.7", changefreq: "weekly" });
  });

  // صفحات المحافظات
  governorates.forEach((g) => {
    urls.push({ loc: `${SITE_URL}/governorates/${encodeURIComponent(slugify(g))}`, priority: "0.7", changefreq: "weekly" });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  const outDir = path.join(__dirname, "public");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml, "utf8");
  console.log(`✅ اتكتب sitemap.xml فيه ${urls.length} رابط`);

  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(outDir, "robots.txt"), robots, "utf8");
  console.log("✅ اتكتب robots.txt");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  });