const fs = require('node:fs');
const path = 'src/App.jsx';
let app = fs.readFileSync(path, 'utf8');
const marker = '// PLAY CONSUMPTION ONLY';
if (app.includes(marker)) process.exit(0);
function replace(from, to) {
  if (app.split(from).length !== 2) throw Error('Expected one Play UI anchor: ' + from.slice(0, 90));
  app = app.replace(from, () => to);
}
function hideLine(match) {
  const lines = app.split('\n').filter(line => line.includes(match));
  if (lines.length !== 1) throw Error('Expected one Play control: ' + match);
  const line = lines[0];
  replace(line, line.replace(/^(\s*)(.*)$/, '$1{!isPlayApp() && ($2)}'));
}
const start = app.indexOf('const PaymentScreen = props => {');
const end = app.indexOf('// REGISTER / MY PROFILE SCREEN', start);
if (start < 0 || end < 0) throw Error('Missing payment screen');
app = app.slice(0,start) + `const PaymentScreen = props => isPlayApp()
  ? <main dir="rtl"><button onClick={props.onBack}>رجوع</button><p>تقدر تستخدم مزايا اشتراكك الحالي بعد تسجيل الدخول.</p></main>
  : <WebPaymentScreen {...props}/>;
` + app.slice(end);
const checkout = app.split('\n').find(line => line.includes('regStep===4 && isPlayApp()'));
if (!checkout?.includes('<PlayCheckout')) throw Error('Missing native checkout');
replace(checkout, '');
replace('PlayCheckout, PlayPurchaseSync, PlayPrice, isPlayApp', 'PlayPurchaseSync, PlayPrice, isPlayApp');
const signup = app.match(/<button[^\n]+setAccountKind\("craftsman"\)[^\n]+>تسجيل كمشترك<\/button>/)?.[0]?.match(/<button(?:(?!<button).)*>تسجيل كمشترك<\/button>$/)?.[0];
if (!signup) throw Error('Missing subscriber signup button');
replace(signup, '{!isPlayApp() && (' + signup + ')}');
hideLine('onClick={()=>onShowPayment()}>💳 الاشتراك');
const mobile = app.match(/\{user&&\(\s*<button onClick=\{\(\)=>setShowPayment\(true\)\}[^\n]+\n\s*\)\}/)?.[0];
if (!mobile) throw Error('Missing mobile payment button');
replace(mobile, mobile.replace('{user&&(', '{user&&!isPlayApp()&&('));
hideLine('onShowPayment?.(); }}>ترقية الاشتراك');
hideLine('onClick={onShowPayment}>⬆️ ترقية الاشتراك');
replace('activeTab !== "messages" && <FloatingWhatsApp', '!isPlayApp() && activeTab !== "messages" && <FloatingWhatsApp');
replace('<div>أكمل بياناتك ثم افتح شاشة الاشتراك لإتمام التفعيل.</div><button type="button" className="btn btn-primary" onClick={onShowPayment}>إكمال الاشتراك والدفع</button>', '{!isPlayApp() && <><div>أكمل بياناتك ثم افتح شاشة الاشتراك لإتمام التفعيل.</div><button type="button" className="btn btn-primary" onClick={onShowPayment}>إكمال الاشتراك والدفع</button></>}');
replace('expired ? "⚠️ اشتراكك منتهي، تواصل مع الإدارة للتجديد"', 'expired ? (isPlayApp() ? "⚠️ اشتراكك منتهي" : "⚠️ اشتراكك منتهي، تواصل مع الإدارة للتجديد")');
replace('احفظ بياناتك، ثم افتح الاشتراك من حسابي لاختيار الباقة والدفع عبر Google Play. الاشتراك الساري يحتفظ بمزاياه حتى انتهاء مدته.', 'الاشتراك الساري يحتفظ بمزاياه حتى انتهاء مدته.');
replace('اشتراكات التطبيق تُشترى عبر Google Play لمدة سنة دون تجديد تلقائي. تخضع طلبات الاسترداد لسياسات Google Play والحقوق القانونية الواجبة. لا يشترط استلام تصميم لتفعيل الشراء المؤكد.', 'التطبيق يتيح استخدام مزايا الاشتراك الساري.');

replace('onClick={()=>setStep(4)}>التالي ←', 'onClick={isPlayApp()?handleSubmit:()=>setStep(4)} disabled={loading}>{isPlayApp()?"حفظ الحساب":"التالي ←"}');
replace('memberData.website&&<a', '!isPlayApp()&&memberData.website&&<a');
fs.writeFileSync(path, marker + '\n' + app);
