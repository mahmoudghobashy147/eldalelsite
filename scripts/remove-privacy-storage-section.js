const fs = require('fs');
const path = 'src/App.jsx';
let source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('const LEGAL_PRIVACY = `');
const end = source.indexOf('`.trim();', start);
if (start < 0 || end < 0) throw new Error('Privacy policy not found');
const previous = source.slice(start, end);
const oldSection = '4. تخزين البيانات\nبياناتك متخزنة على خوادم Google Firebase بمعايير أمان قياسية في الصناعة.\n\n5. حقوقك';
const newSection = '4. حقوقك';
let revised = previous;
if (revised.includes(oldSection)) {
  revised = revised.replace(oldSection, newSection).replace('6. الأطفال', '5. الأطفال').replace('7. التعديلات', '6. التعديلات');
} else if (!revised.includes(newSection) || revised.includes('4. تخزين البيانات')) {
  throw new Error('Unexpected privacy policy; refusing to change it');
}
source = source.slice(0, start) + revised + source.slice(end);
fs.writeFileSync(path, source);
console.log('Removed the requested privacy storage section and renumbered later items.');
