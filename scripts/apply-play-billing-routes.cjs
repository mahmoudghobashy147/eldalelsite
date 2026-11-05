const fs = require('node:fs');
const path = 'src/App.jsx';
let app = fs.readFileSync(path, 'utf8');
const marker = '// PLAY BILLING ROUTES';
if (app.includes(marker)) process.exit(0);
function replace(from, to) {
  if (app.split(from).length !== 2) throw Error('Expected one Play UI anchor: ' + from.slice(0, 90));
  app = app.replace(from, () => to);
}
// Keep native checkout and registration; remove shared external-payment entry points.
if (!app.includes('<PlayCheckout') || !app.includes('!isPlayApp() && <')) throw Error('Missing platform checkout separation');
replace('activeTab !== "messages" && <FloatingWhatsApp', '!isPlayApp() && activeTab !== "messages" && <FloatingWhatsApp');
replace('expired ? "⚠️ اشتراكك منتهي، تواصل مع الإدارة للتجديد"', 'expired ? (isPlayApp() ? "⚠️ اشتراكك منتهي" : "⚠️ اشتراكك منتهي، تواصل مع الإدارة للتجديد")');

replace('memberData.website&&<a', '!isPlayApp()&&memberData.website&&<a');
fs.writeFileSync(path, marker + '\n' + app);
