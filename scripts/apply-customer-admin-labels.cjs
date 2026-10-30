const fs=require('node:fs');
const file='src/App.jsx';let s=fs.readFileSync(file,'utf8');
if(s.includes('// customer-admin-labels-v1'))process.exit(0);
function once(a,b){if(s.split(a).length!==2)throw Error('Customer admin anchor: '+a.slice(0,90));s=s.replace(a,b)}
s='// customer-admin-labels-v1\nimport accountRolePolicy from "./account-role";\nimport AccountPaymentGate from "./AccountPaymentGate";\nconst {isCustomerAccount,accountRole,accountRoleLabel,accountPlanLabel,needsPaidActivation}=accountRolePolicy;\n'+s;
// Existing customer records may still carry starter or a legacy paid tier; display by role.
once('accountKind, plan:"starter",','accountKind, plan:accountKind==="customer"?"customer":"starter",');
once('  const [memberTypeFilter, setMemberTypeFilter] = useState("");','  const [memberTypeFilter, setMemberTypeFilter] = useState("");\n  const [memberAccountFilter,setMemberAccountFilter]=useState("");');
once('members.filter(m => !m.status || m.status === "pending").sort','members.filter(m => needsPaidActivation(m) && (!m.status || m.status === "pending")).sort');
once('(!memberTypeFilter || getMemberPlan(m) === memberTypeFilter) &&','(!memberAccountFilter || accountRole(m) === memberAccountFilter) &&\n      (!memberTypeFilter || (!isCustomerAccount(m) && getMemberPlan(m) === memberTypeFilter)) &&');
once('[members, memberSearch, memberStatusFilter, memberTypeFilter, memberGovFilter]','[members, memberSearch, memberStatusFilter, memberTypeFilter, memberGovFilter, memberAccountFilter]');
const guard=arg=>`\n    if(!needsPaidActivation(members.find(m=>m.id===${arg}))){setConfirmModal(null);alert("باقة العميل مجانية ولا تحتاج إلى تفعيل أو تجديد مدفوع.");return;}`;
for(const [anchor,arg] of [['  const approveMember = async (id, days) => {','id'],['  const renewMemberSubscription = async (id, days) => {','id'],['  const changeMemberType = async (memberId, newType) => {','memberId'],['  const cancelSubscription = async (memberId) => {','memberId']])once(anchor,anchor+guard(arg));
// Clear badges in both pending requests and member management.
once('<span className={`badge badge-${getMemberPlan(m)}`}>{PLANS[getMemberPlan(m)]?.label}</span>','<span style={{padding:"4px 9px",borderRadius:20,background:"#e4efe8",color:"#194c36",fontWeight:800,fontSize:12}}>{accountRoleLabel(m)}</span><span className={`badge badge-${getMemberPlan(m)}`}>{accountPlanLabel(m,PLANS)}</span>');
once('<div style={{ fontSize:11.5,color:sub }}>{m.specialty} · {m.gov}</div>','<div style={{fontSize:12,fontWeight:800,color:isCustomerAccount(m)?"#16734b":C.gold,marginTop:4}}>{accountRoleLabel(m)}</div><div style={{ fontSize:11.5,color:sub }}>{isCustomerAccount(m)?"باقة العميل — مجانية، لطلب صنايعي فقط":[m.specialty,m.gov].filter(Boolean).join(" · ")}</div>');
once('{(memberStatusFilter||memberTypeFilter||memberGovFilter) && (','{(memberStatusFilter||memberTypeFilter||memberGovFilter||memberAccountFilter) && (');
once('setMemberGovFilter("");}}>✕ مسح الفلاتر','setMemberGovFilter("");setMemberAccountFilter("");}}>✕ مسح الفلاتر');
const filterAnchor='              <select value={memberStatusFilter}';
once(filterAnchor,'              <select aria-label="نوع الحساب" value={memberAccountFilter} onChange={e=>{setMemberAccountFilter(e.target.value);setMemberTypeFilter("");setMemberVisibleCount(30)}} style={{padding:8,borderRadius:8,background:card,color:tc}}><option value="">كل أنواع الحسابات</option><option value="customer">العملاء — مجانًا</option><option value="professional">المشتركون / الصنايعية</option></select>\n'+filterAnchor);
// Let filters wrap comfortably on phones.
s=s.replace('gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:12','gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:7,marginBottom:12');
function wrapSelect(anchor,customer){const start=s.indexOf(anchor);if(start<0)throw Error('Missing member select');const end=s.indexOf('</select>',start)+9;if(end<9)throw Error('Missing select close');s=s.slice(0,start)+`{isCustomerAccount(m)?${customer}:(`+s.slice(start,end)+')}'+s.slice(end)}
wrapSelect('<select value={getMemberPlan(m)} onChange={e=>changeMemberType(m.id,e.target.value)}','<span style={{flex:1,fontWeight:800,color:"#16734b",padding:8}}>باقة العميل — مجانية</span>');
wrapSelect('<select value={m.status||"pending"} onChange={async e=>{','<span style={{flex:1,fontSize:12,padding:8,color:sub}}>لا يحتاج تفعيلًا مدفوعًا</span>');
once('{m.status==="approved" && m.type!=="starter" && (()=>{','{!isCustomerAccount(m) && m.status==="approved" && m.type!=="starter" && (()=>{');
once('if(profile.accountKind==="customer")return','if(isCustomerAccount(profile))return');
once('<h2>👤 حساب العميل</h2><p>{profile.name}</p>','<h2>👤 حساب العميل</h2><p style={{background:"#e4efe8",color:"#194c36",padding:12,borderRadius:12,fontWeight:800}}>باقة العميل — مجانية، بدون رسوم تفعيل</p><p>{profile.name}</p>');
// Guard the entire payment overlay, so the current web checkout and the separate
// Play Billing candidate are both inaccessible to signed-in customer accounts.
once('<PaymentScreen onBack={()=>setShowPayment(false)} darkMode={darkMode} onSuccess={handlePaySuccess}/>','<AccountPaymentGate uid={user?.uid} db={db} onBack={()=>setShowPayment(false)}><PaymentScreen onBack={()=>setShowPayment(false)} darkMode={darkMode} onSuccess={handlePaySuccess}/></AccountPaymentGate>');
fs.writeFileSync(file,s);
console.log('Customer role labels, free account display and paid activation guards staged.');
