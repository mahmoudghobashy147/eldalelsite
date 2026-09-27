const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let src = fs.readFileSync(appPath, 'utf8');

const MARKER = '// ARABIC_SMART_SEARCH_V2';
if (src.includes(MARKER)) {
  console.log('Arabic smart search already applied');
  process.exit(0);
}

const oldBlock = `const arabicTextIncludes = (haystack="", needle="") => {\n  const hTokens = normalizeArabic(haystack).split(" ").filter(Boolean).map(stripArabicPrefix);\n  const nTokens = normalizeArabic(needle).split(" ").filter(Boolean).map(stripArabicPrefix);\n  if (nTokens.length === 0) return true;\n  if (hTokens.length === 0) return false;\n  return nTokens.every(nt => hTokens.some(ht => ht.includes(nt) || nt.includes(ht)));\n};`;

const newBlock = `// ${MARKER}\n// مرادفات شائعة في سوق التشطيبات + تحمل خطأ إملائي بسيط، عشان العميل مش لازم يكتب\n// اسم التخصص بنفس الصياغة المسجلة حرفياً. مثال: نقاش/دهانات، كهربا/كهربائي، سباك/سباكة.\nconst SEARCH_TOKEN_CANON = {\n  \"كهربا\":\"كهرباء\", \"كهرباء\":\"كهرباء\", \"كهربائي\":\"كهرباء\", \"كهرباي\":\"كهرباء\",\n  \"سباك\":\"سباكه\", \"سباكه\":\"سباكه\", \"سباكي\":\"سباكه\", \"صحي\":\"سباكه\",\n  \"نقاش\":\"دهانات\", \"نقاشه\":\"دهانات\", \"دهان\":\"دهانات\", \"دهانات\":\"دهانات\", \"دوكو\":\"دهانات\",\n  \"محار\":\"محاره\", \"محاره\":\"محاره\", \"مبيض\":\"محاره\", \"بياض\":\"محاره\",\n  \"نجار\":\"نجاره\", \"نجاره\":\"نجاره\", \"خشب\":\"نجاره\",\n  \"حداد\":\"حداده\", \"حداده\":\"حداده\", \"حديد\":\"حداده\",\n  \"سيراميك\":\"سيراميك\", \"بلاط\":\"سيراميك\", \"مبلط\":\"سيراميك\",\n  \"تكييف\":\"تكييف\", \"تكييفات\":\"تكييف\", \"تبريد\":\"تكييف\", \"مكيف\":\"تكييف\",\n  \"جبسون\":\"جبس\", \"جيبس\":\"جبس\", \"جبس\":\"جبس\",\n  \"الوميتال\":\"الومنيوم\", \"الومنيوم\":\"الومنيوم\", \"المونيوم\":\"الومنيوم\",\n  \"رخام\":\"رخام\", \"جرانيت\":\"رخام\",\n  \"ايبوكسي\":\"ايبوكسي\", \"ابوكسي\":\"ايبوكسي\", \"epoxy\":\"ايبوكسي\",\n  \"تشطيب\":\"تشطيبات\", \"تشطيبات\":\"تشطيبات\", \"ديكور\":\"تشطيبات\",\n  \"مقاول\":\"مقاولات\", \"مقاولات\":\"مقاولات\",\n  \"مهندس\":\"هندسه\", \"هندسه\":\"هندسه\"\n};\n\nconst canonicalSearchToken = (w=\"\") => {\n  const token = stripArabicPrefix(normalizeArabic(w));\n  return SEARCH_TOKEN_CANON[token] || token;\n};\n\nconst oneEditAway = (a=\"\", b=\"\") => {\n  if (a === b) return true;\n  if (Math.abs(a.length - b.length) > 1 || Math.max(a.length,b.length) < 5) return false;\n  let i=0, j=0, edits=0;\n  while (i<a.length && j<b.length) {\n    if (a[i] === b[j]) { i++; j++; continue; }\n    if (++edits > 1) return false;\n    if (a.length > b.length) i++;\n    else if (b.length > a.length) j++;\n    else { i++; j++; }\n  }\n  if (i<a.length || j<b.length) edits++;\n  return edits <= 1;\n};\n\nconst arabicTextIncludes = (haystack=\"\", needle=\"\") => {\n  const hTokens = normalizeArabic(haystack).split(\" \").filter(Boolean).map(canonicalSearchToken);\n  const nTokens = normalizeArabic(needle).split(\" \").filter(Boolean).map(canonicalSearchToken);\n  if (nTokens.length === 0) return true;\n  if (hTokens.length === 0) return false;\n  return nTokens.every(nt => hTokens.some(ht =>\n    ht === nt || ht.includes(nt) || nt.includes(ht) || oneEditAway(ht, nt)\n  ));\n};`;

if (!src.includes(oldBlock)) {
  throw new Error('Arabic smart search patch failed: arabicTextIncludes block not found');
}

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(appPath, src);
console.log('Arabic smart search synonyms and typo tolerance added');
