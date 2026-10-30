const fs=require('node:fs');
let s=fs.readFileSync('src/App.jsx','utf8');
if(!s.includes('// PLAY BILLING INTEGRATION')){
 const once=(a,b)=>{if(s.split(a).length!==2)throw Error('billing anchor: '+a.slice(0,70));s=s.replace(a,b)};
 s='// PLAY BILLING INTEGRATION\nimport {PlayCheckout, PlayPurchaseSync, PlayPrice, isPlayApp} from "./billing/PlayCheckout";\n'+s;
 once('const functions = getFunctions(app);','const functions = getFunctions(app);\nconst invokePlayBilling = async (name,data) => (await httpsCallable(functions,name)(data)).data;');
 once('const PaymentScreen = ({ onBack, darkMode, onSuccess }) => {','const WebPaymentScreen = ({ onBack, darkMode, onSuccess }) => {');
 const marker='// REGISTER / MY PROFILE SCREEN';
 once(marker,`const PaymentScreen = props => {
 const [plan,setPlan]=useState("basic");
 const cfg=useConfig();
 if(!isPlayApp())return <WebPaymentScreen {...props}/>;
 return <main dir="rtl" style={{padding:20,minHeight:"100vh",background:"#f5f4ec",color:"#163e30"}}>
  <button className="btn btn-outline" onClick={props.onBack}>رجوع</button><h2>اختر باقتك السنوية</h2>
  {Object.entries(PLANS).map(([key,p])=><button key={key} className="btn btn-outline" style={{display:"block",width:"100%",marginBottom:10,borderWidth:plan===key?3:1}} onClick={()=>setPlan(key)}>{p.label} — <PlayPrice plan={key}/><small style={{display:"block"}}>حتى 5 صور أعمال، {getPostLimit(key,cfg)} منشورات شهريًا</small></button>)}
  <PlayCheckout plan={plan} uid={auth.currentUser?.uid} invoke={invokePlayBilling} onSuccess={props.onSuccess}/>
 </main>;
};
// REGISTER / MY PROFILE SCREEN`);
 const start=s.indexOf('          {/* ── REGISTER STEP 4: Payment ── */}');
 const end=s.indexOf('          {/* Step 5 - Waiting for approval */}',start);
 if(start<0||end<0)throw Error('registration payment section missing');
 const old=s.slice(start,end);
 s=s.slice(0,start)+`          {mode==="register" && regStep===4 && isPlayApp() && <><PlayCheckout plan={form.plan} uid={createdUser?.uid} invoke={invokePlayBilling} onSuccess={()=>{localStorage.setItem("daleel_user",JSON.stringify(createdUser));onLogin(createdUser);}}/><button className="btn btn-outline" onClick={()=>setRegStep(3)}>رجوع للباقات</button></>}
`+old.replace('regStep===4 &&','regStep===4 && !isPlayApp() &&')+s.slice(end);
 once('mode==="register" && regStep===5 &&','mode==="register" && regStep===5 && !isPlayApp() &&');
 once('  const doPayment = (method) => {','  const doPayment = (method) => {\n    if(isPlayApp())return;');
 // Show Play prices on plan selectors; never display web-configured price as the charge.
 s=s.replaceAll('{getPlanPrice(key,cfg)} ج/سنة','{isPlayApp()?<PlayPrice plan={key}/>:<>{getPlanPrice(key,cfg)} ج/سنة</>}');
 s=s.replaceAll('{getPlanPrice(key,cfg)===0?"مجاني":getPlanPrice(key,cfg)+" ج/سنة"}','{isPlayApp()?<PlayPrice plan={key}/>:getPlanPrice(key,cfg)===0?"مجاني":getPlanPrice(key,cfg)+" ج/سنة"}');
 s=s.replace('setRegStep(getPlanPrice(form.plan,cfg)>0 ? 4 : 5);','setRegStep(isPlayApp() || getPlanPrice(form.plan,cfg)>0 ? 4 : 5);');
 once('if (planChanged) {','if (planChanged && !isPlayApp()) {');
 s=s.replace('⚠️ اخترت باقة مختلفة عن باقتك الحالية. الباقة الجديدة مش هتتفعل تلقائي — هيتفتحلك واتساب بعد الحفظ للتواصل مع الإدارة وتأكيد الدفع.','{isPlayApp()?"احفظ بياناتك، ثم افتح الاشتراك من حسابي لاختيار الباقة والدفع عبر Google Play. الاشتراك الساري يحتفظ بمزاياه حتى انتهاء مدته.":"⚠️ اخترت باقة مختلفة عن باقتك الحالية. الباقة الجديدة مش هتتفعل تلقائي — هيتفتحلك واتساب بعد الحفظ للتواصل مع الإدارة وتأكيد الدفع."}');
 s=s.replaceAll('أكمل الاشتراك وتواصل مع الإدارة لتأكيد الدفع وتفعيل حسابك.','أكمل الاشتراك من شاشة الباقات لتفعيل حسابك.');
 s=s.replaceAll('أكمل بياناتك وسداد الاشتراك، ثم تواصل مع الإدارة لتأكيد الدفع وتفعيل حسابك.','أكمل بياناتك ثم افتح شاشة الاشتراك لإتمام التفعيل.');
 once('<GlobalStyles/><style>{trustStyles}</style>','<GlobalStyles/><style>{trustStyles}</style><PlayPurchaseSync uid={user?.uid} invoke={invokePlayBilling}/>');
 // Manual renewals performed by admin must detach the previous Play token.
 s='import { deleteField } from "firebase/firestore";\n'+s;
 s=s.replace('{ status:"approved", approvedAt: new Date(), subscriptionStart:', '{ status:"approved", billingProvider:"manual", playTokenHash:deleteField(), approvedAt: new Date(), subscriptionStart:');
 s=s.replace('{ subscriptionEnd: newEnd, subscriptionRenewedAt:', '{ billingProvider:"manual", playTokenHash:deleteField(), subscriptionEnd: newEnd, subscriptionRenewedAt:');
 s=s.replace('updateData.subscriptionEnd = subEnd;', 'updateData.subscriptionEnd = subEnd; updateData.billingProvider="manual"; updateData.playTokenHash=deleteField();');
 // Native policy follows Play refunds; retain the existing website payment term.
 s=s.replace('const PROGRAM_PAYMENT_TERM = "','const PROGRAM_PAYMENT_TERM = isPlayApp() ? "اشتراكات التطبيق تُشترى عبر Google Play لمدة سنة دون تجديد تلقائي. تخضع طلبات الاسترداد لسياسات Google Play والحقوق القانونية الواجبة. لا يشترط استلام تصميم لتفعيل الشراء المؤكد." : "');
 s=s.replace('const PromoBanner = ({ cfg }) => (','const PromoBanner = ({ cfg }) => isPlayApp() ? null : (');
 fs.writeFileSync('src/App.jsx',s);
}
let main=fs.readFileSync('functions/main.js','utf8');if(!main.includes('./play-billing/index.cjs'))main=main.replace('module.exports = {','module.exports = {\n  ...require("./play-billing/index.cjs"),');
// Billing requires admin initialization before loading the billing module.
main=main.replace('  ...require("./play-billing/index.cjs"),\n  ...require("./index"),','  ...require("./index"),\n  ...require("./play-billing/index.cjs"),');fs.writeFileSync('functions/main.js',main);
let rules=fs.readFileSync('firestore.rules','utf8');
// Server-only billing attribution and purchase token references.
rules=rules.replaceAll("        'subscriptionStart',","        'billingProvider', 'playTokenHash',\n        'subscriptionStart',");
rules=rules.replaceAll("          'subscriptionStart',","          'billingProvider', 'playTokenHash',\n          'subscriptionStart',");
// Idempotency: collapse the extra fields inserted by this script on repeated prebuilds.
rules=rules.replace(/(\s*'billingProvider', 'playTokenHash',)+\s*'subscriptionStart',/g,"\n        'billingProvider', 'playTokenHash',\n        'subscriptionStart',");
fs.writeFileSync('firestore.rules',rules);
