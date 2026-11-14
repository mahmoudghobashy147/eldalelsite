const fs = require('node:fs');

function edit(path, transform, marker) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes(marker)) return;
  const replace = (before, after) => {
    if (before === after || source.split(before).length !== 2) throw new Error(`Missing registration role anchor in ${path}: ${before.slice(0, 90)}`);
    return current => current.replace(before, after);
  };
  fs.writeFileSync(path, transform(source, replace));
}

edit('src/App.jsx', (source, replace) => {
  let app = replace('accountPlanLabel,needsPaidActivation}=accountRolePolicy', 'accountPlanLabel,needsPaidActivation,canManageCatalog}=accountRolePolicy')(source);
  const authStart = app.indexOf('const AuthScreen =');
  const authEnd = app.indexOf('const RegisterScreen =', authStart);
  let auth = app.slice(authStart, authEnd);
  const choicesStart = auth.indexOf('            <div className="easy-create-account">');
  const choicesEnd = auth.indexOf('\n', choicesStart);
  if (choicesStart < 0 || choicesEnd < 0) throw new Error('Missing registration chooser');
  auth = auth.slice(0, choicesStart) + `            <div className="easy-create-account" data-registration-account-types="true">
              <p style={{color:sub}}>إنشاء حساب</p>
              <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                {registrationKinds.map(([kind,label])=><button key={kind} type="button" className="btn btn-outline" onClick={()=>{
                  setAccountKind(kind);
                  setForm(previous=>({...previous,type:"",specialty:"",plan:"starter"}));
                  setMode("register");
                  setRegStep(1);
                  setError("");
                }}>{label}</button>)}
              </div>
            </div>` + auth.slice(choicesEnd);
  auth = auth.replace('useState("craftsman");','useState("");')
    .replace('  const types = [[','  const registrationKinds = [["customer","عميل"],["technician","صنايعي / فني"],["supplier","مورد / شركة"]];\n  const allTypes = [[')
    .replace('  const steps = mode===', '  const types = allTypes.filter(([type])=>accountKind==="supplier" ? ["supplier","company"].includes(type) : ["craftsman","technician"].includes(type));\n  const steps = mode===')
    .replace('if(!form.type||!form.specialty||!form.gov)', 'if(!types.some(([type])=>type===form.type)||!form.specialty||!form.gov)')
    .replace('if(!form.name||!form.phone||!form.pin)', 'if(!registrationKinds.some(([kind])=>kind===accountKind)) return setError("اختار نوع الحساب");\n    if(!form.name||!form.phone||!form.pin)')
    .replace('؛ لا يمكن استخدام نفس الرقم لحساب عميل ومشترك.', '.')
    .replace('accountKind==="customer"?"تسجيل كعميل":"تسجيل كمشترك"', '`تسجيل — ${registrationKinds.find(([kind])=>kind===accountKind)?.[1] || ""}`')
    .replace('>بياناتك المهنية</h2>', '>{accountKind==="supplier"?"بيانات النشاط التجاري":"بياناتك المهنية"}</h2>')
    .replace('placeholder="مثال: سباكة وصرف صحي"', 'placeholder={accountKind==="supplier"?"مثال: توريد سيراميك ومواد بناء":"مثال: سباكة وصرف صحي"}');
  app = app.slice(0,authStart) + auth + app.slice(authEnd);

  const editorStart = app.indexOf('const RegisterScreen =');
  const editorEnd = app.indexOf('const MyProfileScreen =', editorStart);
  const editor = app.slice(editorStart,editorEnd)
    .replace('  const types = [[', '  const allTypes = [[')
    .replace('  useEffect(() => {', '  const types = allTypes.filter(([type])=>form.accountKind==="supplier" ? ["supplier","company"].includes(type) : form.accountKind==="technician" ? ["craftsman","technician"].includes(type) : true);\n\n  useEffect(() => {')
    .replace('if (data.type) setStep(2);', 'if (allTypes.some(([type])=>type===data.type)) setStep(2);');
  app = app.slice(0,editorStart) + editor + app.slice(editorEnd);

  const homeStart = app.indexOf('const HomeScreen =');
  const homeEnd = app.indexOf('const ProfileScreen =', homeStart);
  let home = app.slice(homeStart, homeEnd);
  home = home.replace('  const [showAddPost, setShowAddPost]', '  const [postingMember,setPostingMember]=useState(null);\n  const canShowPostTools=!user || (postingMember?.uid===user.uid && !isCustomerAccount(postingMember));\n  const [showAddPost, setShowAddPost]')
    .replace('        const memberType = snap.exists()', '        setPostingMember(snap.exists()?{...snap.data(),uid:snap.id}:null);\n        const memberType = snap.exists()')
    .replace('    setShowAddPost(true);', '    if(canShowPostTools) setShowAddPost(true);')
    .replace('{/* Add Post Box — visible to all users */}\n        <div', '{canShowPostTools&&<div')
    .replace('</div>\n\n        {/* Empty State */}', '</div>}\n\n        {/* Empty State */}')
    .replace('<button className="btn btn-primary btn-sm" onClick={handleAddPost}>✏️ أضف أول منشور</button>', '{canShowPostTools&&<button className="btn btn-primary btn-sm" onClick={handleAddPost}>✏️ أضف أول منشور</button>}')
    .replace('{/* Floating Add Post Button */}\n      <div', '{canShowPostTools&&<div')
    .replace('        ✏️\n      </div>', '        ✏️\n      </div>}');
  const carousel = '        <AdsCarousel ads={homeAds} fallbackImage={luxuryHero}/>';
  if (!home.includes(carousel)) throw new Error('Missing home carousel');
  home = home.replace(carousel, carousel + `
        {!isPlayApp() && <div style={{display:"flex",justifyContent:"center",padding:"12px 12px 4px"}}>
          <a className="btn btn-primary" href="https://play.google.com/store/apps/details?id=com.company.eldalelelshamel" target="_blank" rel="noopener noreferrer">
            حمّل تطبيق الدليل الشامل من Google Play
          </a>
        </div>}
  `);
  app = app.slice(0,homeStart) + home + app.slice(homeEnd);

  const catalogButton = app.match(/<button data-profile-catalog-button="true"[^\n]+?<\/button>/);
  if (!catalogButton) throw new Error('Missing profile catalog button');
  app = app.replace(catalogButton[0], '{canManageCatalog(profile)&&'+catalogButton[0]+'}');
  app = replace('<option value="professional">المشتركون / الصنايعية</option>', '<option value="technician">صنايعي / فني</option><option value="supplier">مورد / شركة</option>')(app);
  return app.replace('<div style={{fontSize:12.5,color:"rgba(255,255,255,.55)",marginBottom:5}}>🔧 {profile.specialty}</div>', '<div style={{fontSize:12.5,color:"rgba(255,255,255,.75)",marginBottom:5}}>{accountRoleLabel(profile)}{profile.specialty ? ` · ${profile.specialty}` : ""}</div>');
}, 'data-registration-account-types="true"');

edit('src/catalog.jsx', (source, replace) => {
  let output = 'import accountRolePolicy from "./account-role";\n' + source;
  output = replace('  const [ownerOpen,setOwnerOpen]', `  const [catalogMember,setCatalogMember]=useState(null);
  useEffect(()=>{
    let active=true;
    if(user?.uid) getDoc(doc(db,"members",user.uid)).then(snapshot=>{
      if(active) setCatalogMember(snapshot.exists()?{...snapshot.data(),id:snapshot.id}:null);
    }).catch(()=>{if(active) setCatalogMember(null);});
    return ()=>{active=false;};
  },[db,user?.uid]);
  const canManage = catalogMember?.id===user?.uid && accountRolePolicy.canManageCatalog(catalogMember);
  const [ownerOpen,setOwnerOpen]`)(output);
  output = replace('if(ownerOpen) return <CatalogOwnerPortal','if(ownerOpen && canManage) return <CatalogOwnerPortal')(output);
  return replace('ownerEntry={<div data-catalog-owner-entry="true">','ownerEntry={(!user||canManage)&&<div data-catalog-owner-entry="true">')(output);
}, 'const [catalogMember,setCatalogMember]');

edit('src/catalog-owner.jsx', (source, replace) => {
  const output = 'import accountRolePolicy from "./account-role";\n' + source;
  return replace('setCatalogAccess(!!m&&','setCatalogAccess(accountRolePolicy.canManageCatalog(m)&&')(output);
}, 'accountRolePolicy.canManageCatalog');

for (const path of ['firestore.rules', 'storage.rules']) {
  edit(path, (source, replace) => {
    const start = source.indexOf('    function catalogEligible()');
    const end = source.indexOf('\n    }', start);
    if (start < 0 || end < 0) throw new Error(`Missing catalog eligibility in ${path}`);
    const fn = source.slice(start, end);
    const updated = fn.replace("      return member.get('status', '') == 'approved'", `      let kind = member.get('accountKind', '');
      return kind in ['', 'craftsman', 'supplier']
        && !(kind == '' && (member.get('type', '') == 'customer' || plan == 'customer'))
        && member.get('status', '') == 'approved'`);
    if (updated === fn) throw new Error(`Missing catalog status anchor in ${path}`);
    let output = source.slice(0, start) + updated + source.slice(end);
    if (path === 'firestore.rules') {
      output = replace('          && memberStatusChangeAllowed()', `          && memberStatusChangeAllowed()
          && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['type'])
            || (resource.data.get('accountKind', '') != 'supplier' && resource.data.get('accountKind', '') != 'technician')
            || (resource.data.get('accountKind', '') == 'supplier' && request.resource.data.get('type', '') in ['supplier', 'company'])
            || (resource.data.get('accountKind', '') == 'technician' && request.resource.data.get('type', '') in ['craftsman', 'technician']))`)(output);
    }
    return output;
  }, "return kind in ['', 'craftsman', 'supplier']");
}

edit('scripts/test-firestore-rules.js', (source, replace) => replace(
  '    // Subscription gate: owner needs an approved plan costing at least 600 EGP.',
  `    // Registration roles stay fixed even when a member has an eligible plan.
    await testEnv.withSecurityRulesDisabled(async ctx=>{
      const seed=ctx.firestore();
      await setDoc(doc(seed,"members","newTechnician"),{uid:"newTechnician",accountKind:"technician",type:"technician",plan:"vip",status:"approved"});
      await setDoc(doc(seed,"members","newSupplier"),{uid:"newSupplier",accountKind:"supplier",type:"supplier",plan:"vip",status:"approved"});
    });
    const newTechnician=testEnv.authenticatedContext("newTechnician").firestore();
    const newSupplier=testEnv.authenticatedContext("newSupplier").firestore();
    await assertFails(updateDoc(doc(newTechnician,"members","newTechnician"),{accountKind:"supplier"}));
    await assertFails(updateDoc(doc(newTechnician,"members","newTechnician"),{type:"supplier"}));
    await assertSucceeds(updateDoc(doc(newSupplier,"members","newSupplier"),{type:"company"}));
    await assertFails(setDoc(doc(newTechnician,"catalogBusinessRequests","newTechnician"),{ownerId:"newTechnician",name:"Technician",status:"pending"}));
    await assertSucceeds(setDoc(doc(newSupplier,"catalogBusinessRequests","newSupplier"),{ownerId:"newSupplier",name:"Supplier",status:"pending"}));

    // Subscription gate: owner needs an approved plan costing at least 600 EGP.`
)(source), 'Registration roles stay fixed');

console.log('Three account registration paths and catalog role permissions applied.');
