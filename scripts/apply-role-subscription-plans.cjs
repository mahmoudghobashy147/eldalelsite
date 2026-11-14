const fs = require('node:fs');
const path = 'src/App.jsx';
let app = fs.readFileSync(path, 'utf8');
const marker = '// Role subscription plans';
if (app.includes(marker)) process.exit(0);

const replace = (from, to) => {
  if (app.split(from).length !== 2) throw Error('Missing plan anchor: '+from.slice(0,90));
  app = app.replace(from, () => to);
};
replace('accountPlanLabel,needsPaidActivation,canManageCatalog}', 'accountPlanLabel,needsPaidActivation,canManageCatalog,availablePlanKeys}');
replace('const PLANS = {', `${marker}
const PLANS = {
  supplier_banner: {label:"إعلان رئيسي ومتجر",price:6000,color:"#855617",maxPhotos:5,maxPosts:80,maxVideos:10,searchPriority:-2,features:["إعلان في البنر الرئيسي","متجر إلكتروني داخل الدليل","كتالوج المنتجات"]},`);
replace('  const v = cfg?.planPrices?.[type];', '  const v = cfg?.planPrices?.[type];\n  if (PLANS[type]) return PLANS[type].price;');
replace('setForm(previous=>({...previous,type:"",specialty:"",plan:"starter"}));', 'setForm(previous=>({...previous,type:"",specialty:"",plan:availablePlanKeys({accountKind:kind})[0] || "starter"}));');
replace('if (!createdUser?.uid) return setError("سجّل دخولك لإكمال الاشتراك");','if (!createdUser?.uid) return setError("سجّل دخولك لإكمال الاشتراك");\n    if (!availablePlanKeys({accountKind}).includes(form.plan)) return setError("اختر باقة مناسبة لنوع حسابك");');
const options = 'Object.entries(PLANS).map(([key,pl])=>';
for (const [start,end,member] of [
  ['const AuthScreen =','const WebPaymentScreen =','{accountKind}'],
  ['const WebPaymentScreen =','const PaymentScreen =','member'],
  ['const RegisterScreen =','const MyProfileScreen =','form'],
]) {
  const a = app.indexOf(start), b = app.indexOf(end,a);
  const section = app.slice(a,b);
  if (section.split(options).length !== 2) throw Error('Missing role plan list: '+start);
  app = app.slice(0,a)+section.replace(options,`availablePlanKeys(${member}).map(key=>[key,PLANS[key]]).map(([key,pl])=>`)+app.slice(b);
}
replace('const WebPaymentScreen = ({ onBack, darkMode, onSuccess })','const WebPaymentScreen = ({ onBack, darkMode, onSuccess, member })');
replace('const [plan, setPlan] = useState("premium");','const [plan, setPlan] = useState(()=>availablePlanKeys(member)[0]);');
replace('const [plan,setPlan]=useState("basic");','const [plan,setPlan]=useState(()=>availablePlanKeys(props.member)[0]);');
replace('Object.entries(PLANS).map(([key,p])=>','availablePlanKeys(props.member).map(key=>[key,PLANS[key]]).map(([key,p])=>');
replace('<PaymentScreen onBack={()=>setShowPayment(false)} darkMode={darkMode} onSuccess={handlePaySuccess}/></AccountPaymentGate>', '{member=><PaymentScreen member={member} onBack={()=>setShowPayment(false)} darkMode={darkMode} onSuccess={handlePaySuccess}/>}</AccountPaymentGate>');
app = app.replaceAll('<PlayPrice plan={key}/>', '<PlayPrice plan={key} annualPrice={getPlanPrice(key,cfg)}/>');
fs.writeFileSync(path,app);

for (const file of ['firestore.rules','storage.rules','src/catalog-owner.jsx']) {
  const source = fs.readFileSync(file,'utf8');
  let updated = source.replace("let price = prices.get(plan, defaults.get(plan, 0));","let price = plan == 'supplier_banner' ? 6000 : prices.get(plan, defaults.get(plan, 0));")
    .replace('price=typeof configured==="number"?configured:(fallback[plan]||0)','price=plan==="supplier_banner"?6000:typeof configured==="number"?configured:(fallback[plan]||0)');
  if (file === 'firestore.rules') updated = updated.replace('          && ownPlanChangeAllowed()', `          && ownPlanChangeAllowed()
          && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['plan'])
            || (resource.data.get('accountKind', '') == 'supplier' && request.resource.data.plan in ['vip', 'company', 'elite', 'supplier_banner'])
            || (resource.data.get('accountKind', '') == 'technician' && request.resource.data.plan in ['starter', 'basic', 'premium', 'vip'])
            || !(resource.data.get('accountKind', '') in ['supplier', 'technician']))`);
  fs.writeFileSync(file, updated);
}
