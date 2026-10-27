const fs=require('fs');const file='src/App.jsx';let s=fs.readFileSync(file,'utf8');
function patch(old,next,label){if(next&&s.includes(next))return;const count=s.split(old).length-1;if(count!==1)throw Error(`${label}: expected 1, found ${count}`);s=s.replace(old,next);}
const imports='import SpecialtyIcon from "./SpecialtyIcon";\nimport "./program-policy.css";';
if(!s.includes('import SpecialtyIcon from "./SpecialtyIcon";'))s=imports+'\n'+s;
patch('{SPECIALTIES.map(s=><button key={s.id} onClick={()=>onNavigate("search",{specialty:s.label})}><span aria-hidden="true">{s.icon}</span> {s.label}</button>)}','{SPECIALTIES.map(s=><button key={s.id} onClick={()=>onNavigate("search",{specialty:s.label})}><SpecialtyIcon id={s.id} fallback={s.icon}/> <span>{s.label}</span></button>)}','specialty strip');
const constants=`const PROGRAM_PAYMENT_TERM = "في حالة دفع الرسوم المطلوبة للتفعيل ووصول التصميم إليك، لا يُسترد المبلغ المدفوع، وذلك مع عدم الإخلال بأي حقوق أو استثناءات يقررها القانون المعمول به.";
const PROGRAM_POLICY = ["سياسة البرنامج — الدليل الشامل", PROGRAM_PAYMENT_TERM, "يجب تقديم بيانات صحيحة، ويحظر انتحال الهوية ونشر المحتوى المسيء أو المخالف للقانون. يمكن الإبلاغ عن المحتوى المخالف وحظر المستخدمين من داخل المنصة.", "المنصة وسيلة لعرض الملفات وتسهيل التواصل؛ اتفق مع مقدم الخدمة كتابة على نطاق العمل والسعر والمواعيد وشروط الضمان إن وجدت.", "تسري هذه السياسة مع الشروط والأحكام وسياسة الخصوصية، مع مراعاة حقوق المستخدم المقررة قانونًا."].join("\\n\\n");
`;
if(!s.includes('const PROGRAM_PAYMENT_TERM ='))patch('const LEGAL_TERMS = `',constants+'const LEGAL_TERMS = `','policy definitions');
patch('- رسوم الاشتراك غير قابلة للاسترداد بعد التفعيل، إلا في حالات الخطأ الفني المثبت من الإدارة.','- ${PROGRAM_PAYMENT_TERM}','payment terms');
patch('const LegalModal = ({ isOpen, onClose, darkMode }) => {\n  const [tab, setTab] = useState("terms");\n  if (!isOpen) return null;','const LegalModal = ({ isOpen, onClose, darkMode, initialTab="terms" }) => {\n  const [tab, setTab] = useState(initialTab);\n  useEffect(()=>{if(isOpen)setTab(initialTab);},[isOpen,initialTab]);\n  if (!isOpen) return null;','policy modal state');
patch('const content = tab === "terms" ? LEGAL_TERMS : LEGAL_PRIVACY;','const content = tab === "terms" ? LEGAL_TERMS : tab === "policy" ? PROGRAM_POLICY : LEGAL_PRIVACY;','policy tab content');
const privacyButton='<button onClick={()=>setTab("privacy")} className={`chip ${tab==="privacy"?"active":""}`}>سياسة الخصوصية</button>';
patch(privacyButton,privacyButton+'\n          <button onClick={()=>setTab("policy")} className={`chip ${tab==="policy"?"active":""}`}>سياسة البرنامج</button>','policy tab button');
patch('const [showLegal, setShowLegal] = useState(false);\n  const [form, setForm] = useState({','const [showLegal, setShowLegal] = useState(false);\n  const [policyAccepted, setPolicyAccepted] = useState(false);\n  const [form, setForm] = useState({','consent state');
const consent=`  const policyAcceptance = <div className={'policy-consent'+(darkMode?' policy-consent-dark':'')}>
    <input id="policy-consent" type="checkbox" checked={policyAccepted} onChange={e=>{setPolicyAccepted(e.target.checked);setError("");}}/>
    <div><label htmlFor="policy-consent">أوافق على سياسة البرنامج والشروط والأحكام وسياسة الخصوصية</label> <button type="button" onClick={()=>setShowLegal(true)}>اقرأ السياسات</button></div>
  </div>;
`;
patch('  const OWNER_WA = cfg.whatsapp;\n','  const OWNER_WA = cfg.whatsapp;\n'+consent,'consent control');
patch('  const handleLogin = async () => {\n    const identifier','  const handleLogin = async () => {\n    if(!policyAccepted)return setError("لازم توافق على سياسة البرنامج قبل المتابعة");\n    const identifier','login consent guard');
patch('  const doCreateAccount = async () => {\n    if(!form.name','  const doCreateAccount = async () => {\n    if(!policyAccepted)return setError("لازم توافق على سياسة البرنامج قبل المتابعة");\n    if(!form.name','registration consent guard');
const loginButton='<button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:13}} onClick={handleLogin} disabled={loading}>';
patch(loginButton,'{policyAcceptance}\n            '+loginButton,'login consent placement');
const createButton='<button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:10}} onClick={doCreateAccount} disabled={loading}>';
patch(createButton,'{policyAcceptance}\n            '+createButton,'registration consent placement');
const implied=`            <p style={{textAlign:"center",color:sub,fontSize:11,marginBottom:6}}>
              بالتسجيل، انت موافق على <span style={{color:C.gold,cursor:"pointer",fontWeight:700}} onClick={()=>setShowLegal(true)}>الشروط والأحكام وسياسة الخصوصية</span>
            </p>\n`;
if(s.includes(implied))patch(implied,'','remove implicit consent');
const modal='<LegalModal isOpen={showLegal} onClose={()=>setShowLegal(false)} darkMode={darkMode}/>';
const authEnd=s.indexOf('// MEMBER CARD');const authStart=s.indexOf('const AuthScreen =');
if(authStart<0||authEnd<authStart)throw Error('Auth screen not found');
let authSection=s.slice(authStart,authEnd);if(!authSection.includes('initialTab="policy"')){if(authSection.split(modal).length!==2)throw Error('auth policy modal count');authSection=authSection.replace(modal,modal.replace('/>',' initialTab="policy"/>'));s=s.slice(0,authStart)+authSection+s.slice(authEnd);}

patch('  terms: {\n    title: "الشروط والأحكام",\n    body: [','  terms: {\n    title: "سياسة البرنامج والشروط والأحكام",\n    body: [\n      PROGRAM_PAYMENT_TERM,','public policy');
patch('style={{padding:"12px 18px 6px",display:"flex",gap:8}}','style={{padding:"12px 18px 6px",display:"flex",flexWrap:"wrap",gap:8}}','policy tabs responsive');
patch('whiteSpace:"pre-line",fontSize:12.5,lineHeight:1.9,color:sub','whiteSpace:"pre-line",fontSize:14,lineHeight:2,color:darkMode?"#f3efdc":"#243d30"','readable policy text');
fs.writeFileSync(file,s);console.log('Policy consent, user-facing payment terms and 3D specialty icons integrated.');
