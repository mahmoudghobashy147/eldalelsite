const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let src = fs.readFileSync(appPath, 'utf8');

const MARKER = '// SMART_SEARCH_RANKING_V1';
if (src.includes(MARKER)) {
  console.log('Smart search ranking already applied');
  process.exit(0);
}

const find = `    if (availableOnly) filtered = filtered.filter(m=>m.available===true);\n    setResults(filtered);\n    setLoading(false);`;

const replacement = `    if (availableOnly) filtered = filtered.filter(m=>m.available===true);\n\n    // ترتيب ذكي للنتائج عند اختيار \"الأفضل\":\n    // يفضل التطابق المكاني والتخصص، ثم العضوية والتقييم والخبرة والتوفر.\n    if (sort === \"priority\") {\n      const planWeight = { elite: 70, company: 55, vip: 45, premium: 34, basic: 18, starter: 8 };\n      const norm = v => String(v || \"\").trim().toLowerCase();\n      const scoreMember = m => {\n        let score = 0;\n        if (gov && norm(m.gov) === norm(gov)) score += 80;\n        if (city && norm(m.city) === norm(city)) score += 110;\n        if (specialty && norm(m.specialty) === norm(specialty)) score += 95;\n        if (category && norm(m.type || m.category) === norm(category)) score += 45;\n        if (m.available === true) score += 18;\n        score += planWeight[getMemberPlan(m)] || 0;\n        score += Math.min(Number(m.rating || 0), 5) * 9;\n        score += Math.min(Number(m.reviews || 0), 20) * 1.4;\n        score += Math.min(Number(m.experience || 0), 30) * 1.1;\n        score += Math.min(Number(m.views || 0), 5000) / 500;\n        return score;\n      };\n      filtered = [...filtered].sort((a,b) => scoreMember(b) - scoreMember(a));\n    }\n\n    setResults(filtered);\n    setLoading(false);\n    ${MARKER}`;

if (!src.includes(find)) {
  throw new Error('Smart search ranking patch failed: target block not found');
}

src = src.replace(find, replacement);
fs.writeFileSync(appPath, src);
console.log('Smart search ranking added successfully');
