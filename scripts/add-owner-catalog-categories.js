const fs = require('fs');

const OWNER = 'src/catalog-owner.jsx';
const FIRESTORE = 'firestore.rules';
const FIRESTORE_TEST = 'scripts/test-firestore-rules.js';

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Owner category patch failed: ${label} anchor not found`);
  return text.replace(from, to);
}

let owner = fs.readFileSync(OWNER, 'utf8');

// Keep existing global categories, but only expose this owner's private categories
// inside their product form. Nothing is migrated or rewritten.
owner = replaceOnce(
  owner,
  '  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[request,setRequest]=useState(null),[business,setBusiness]=useState(null),[products,setProducts]=useState([]),[categories,setCategories]=useState([]);\n',
  '  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[request,setRequest]=useState(null),[business,setBusiness]=useState(null),[products,setProducts]=useState([]),[categories,setCategories]=useState([]);\n  const [categoryName,setCategoryName]=useState("");\n',
  'owner category state'
);

owner = replaceOnce(
  owner,
  '      setRequest(req);setBusiness(biz);setProducts(prodSnap.docs.map(x=>({id:x.id,...x.data()})));setCategories(catSnap.docs.map(x=>({id:x.id,...x.data()})));\n',
  '      const visibleCategories=catSnap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>!x.ownerId||x.ownerId===uid);\n      setRequest(req);setBusiness(biz);setProducts(prodSnap.docs.map(x=>({id:x.id,...x.data()})));setCategories(visibleCategories);\n',
  'owner category filtering'
);

if (!owner.includes('const addOwnerCategory=async()=>')) {
  const anchor = '  const removeProduct=async p=>{if(!window.confirm(`حذف السلعة ${p.name}؟`))return;try{await deleteDoc(doc(db,"catalogProducts",p.id));await load()}catch(e){alert(e.message)}};\n';
  const block = `  const addOwnerCategory=async()=>{\n    const name=String(categoryName||"").trim();\n    if(!business){alert("لازم يكون عندك كتالوج معتمد أولًا");return;}\n    if(name.length<2){alert("اكتب اسم القسم");return;}\n    if(categories.some(x=>x.ownerId===uid&&String(x.name||"").trim().toLowerCase()===name.toLowerCase())){alert("القسم موجود بالفعل");return;}\n    setBusy(true);\n    try{\n      const categoryRef=doc(collection(db,"catalogCategories"));\n      await setDoc(categoryRef,{name,icon:"📁",active:true,scope:"business",ownerId:uid,businessId:business.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});\n      setCategoryName("");\n      await load();\n    }catch(e){alert(e.message||"تعذر إضافة القسم")}finally{setBusy(false)}\n  };\n  const renameOwnerCategory=async cat=>{\n    const name=window.prompt("اسم القسم الجديد",cat.name||"");\n    if(name===null)return;\n    const clean=String(name).trim();\n    if(clean.length<2){alert("اكتب اسم صحيح للقسم");return;}\n    try{await updateDoc(doc(db,"catalogCategories",cat.id),{name:clean,updatedAt:serverTimestamp()});await load()}catch(e){alert(e.message)}\n  };\n  const toggleOwnerCategory=async cat=>{\n    try{await updateDoc(doc(db,"catalogCategories",cat.id),{active:cat.active===false,updatedAt:serverTimestamp()});await load()}catch(e){alert(e.message)}\n  };\n  const removeOwnerCategory=async cat=>{\n    if(products.some(p=>p.categoryId===cat.id)){alert("القسم مرتبط بسلع. انقل السلع لقسم آخر الأول.");return;}\n    if(!window.confirm(\`حذف قسم \${cat.name}؟\`))return;\n    try{await deleteDoc(doc(db,"catalogCategories",cat.id));await load()}catch(e){alert(e.message)}\n  };\n\n`;
  owner = replaceOnce(owner, anchor, block + anchor, 'owner category actions');
}

if (!owner.includes('if(mode==="categories")')) {
  const anchor = '  const orderedProducts=[...products].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));\n';
  const replacement = '  const ownCategories=categories.filter(x=>x.ownerId===uid);\n' + anchor;
  owner = replaceOnce(owner, anchor, replacement, 'owner category list');

  const modeAnchor = '  if(mode==="business")return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}>';
  const categoryMode = `  if(mode==="categories")return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"18px 12px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:760,margin:"0 auto"}}>\n    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12}}><div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:21,color:c.tc}}>الأقسام / التصنيفات</div><div style={{fontSize:11.5,color:c.sub}}>أضف الأقسام الخاصة بكتالوجك علشان تختارها عند إضافة السلعة</div></div><Btn secondary onClick={()=>setMode("overview")}>رجوع</Btn></div>\n    <div style={{background:c.card,border:\`1px solid \${c.border}\`,borderRadius:16,padding:14,marginBottom:12}}>\n      <div style={{fontWeight:900,color:c.tc,marginBottom:8}}>+ إضافة قسم جديد</div>\n      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr auto",gap:8}}>\n        <input value={categoryName} onChange={e=>setCategoryName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addOwnerCategory()}} placeholder="مثال: أرضيات - خلاطات - إضاءة" style={{width:"100%",boxSizing:"border-box",padding:"13px",borderRadius:12,border:\`1px solid \${c.border}\`,background:c.input,color:c.tc,fontFamily:"Cairo",outline:"none"}}/>\n        <Btn onClick={addOwnerCategory} disabled={busy} style={{minWidth:130}}>{busy?"جاري الإضافة...":"إضافة القسم"}</Btn>\n      </div>\n    </div>\n    {ownCategories.length===0?<div style={{background:c.card,border:\`1px solid \${c.border}\`,borderRadius:14,padding:28,textAlign:"center",color:c.sub}}>لسه ما أضفتش أقسام خاصة بكتالوجك.</div>:<div style={{display:"grid",gap:8}}>{ownCategories.map(cat=><div key={cat.id} style={{background:c.card,border:\`1px solid \${c.border}\`,borderRadius:14,padding:12,display:"grid",gridTemplateColumns:mobile?"1fr":"1fr auto",gap:9,alignItems:"center"}}><div><div style={{fontWeight:900,color:c.tc}}>{cat.icon||"📁"} {cat.name}</div><div style={{fontSize:10.5,color:cat.active===false?"#DC2626":"#16A34A",marginTop:2}}>{cat.active===false?"مخفي":"ظاهر"}</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn secondary onClick={()=>renameOwnerCategory(cat)}>تعديل</Btn><Btn secondary onClick={()=>toggleOwnerCategory(cat)}>{cat.active===false?"إظهار":"إخفاء"}</Btn><Btn danger onClick={()=>removeOwnerCategory(cat)}>حذف</Btn></div></div>)}</div>}\n  </div></div>;\n\n` + modeAnchor;
  owner = replaceOnce(owner, modeAnchor, categoryMode, 'owner category screen');
}

if (!owner.includes('title:"إدارة الأقسام"')) {
  const anchor = '    {icon:"🧱",title:"السلع الحالية",sub:`${products.length} سلعة`,go:()=>setMode("products")},\n';
  owner = replaceOnce(
    owner,
    anchor,
    anchor + '    {icon:"📁",title:"إدارة الأقسام",sub:`${ownCategories.length} قسم خاص`,go:()=>setMode("categories")},\n',
    'owner category dashboard action'
  );
}

fs.writeFileSync(OWNER, owner);

// Firestore: existing/global categories remain admin-managed. A catalog owner may
// only create/edit/delete categories explicitly owned by them and tied to their
// already-approved business.
let rules = fs.readFileSync(FIRESTORE, 'utf8');
const oldCategoryRules = `    match /catalogCategories/{categoryId} {\n      allow get, list: if isAdmin() || resource.data.active == true;\n      allow create, update, delete: if isAdmin();\n    }`;
const newCategoryRules = `    match /catalogCategories/{categoryId} {\n      allow get, list: if isAdmin()\n        || resource.data.active == true\n        || (signedIn() && resource.data.get('ownerId', '') == request.auth.uid);\n\n      allow create: if isAdmin()\n        || (signedIn()\n          && request.resource.data.get('ownerId', '') == request.auth.uid\n          && request.resource.data.get('scope', '') == 'business'\n          && request.resource.data.get('businessId', '') is string\n          && request.resource.data.get('name', '') is string\n          && request.resource.data.get('name', '').size() >= 2\n          && request.resource.data.get('active', false) == true\n          && exists(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId))\n          && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('ownerId', '') == request.auth.uid\n          && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('approvalStatus', 'approved') == 'approved');\n\n      allow update: if isAdmin()\n        || (signedIn()\n          && resource.data.get('ownerId', '') == request.auth.uid\n          && resource.data.get('scope', '') == 'business'\n          && request.resource.data.get('ownerId', '') == resource.data.get('ownerId', '')\n          && request.resource.data.get('businessId', '') == resource.data.get('businessId', '')\n          && request.resource.data.get('scope', '') == 'business'\n          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name','icon','active','updatedAt']));\n\n      allow delete: if isAdmin()\n        || (signedIn()\n          && resource.data.get('ownerId', '') == request.auth.uid\n          && resource.data.get('scope', '') == 'business');\n    }`;
if (!rules.includes(newCategoryRules)) {
  if (!rules.includes(oldCategoryRules)) throw new Error('Owner category patch failed: Firestore category rules anchor not found');
  rules = rules.replace(oldCategoryRules, newCategoryRules);
}
fs.writeFileSync(FIRESTORE, rules);

let tests = fs.readFileSync(FIRESTORE_TEST, 'utf8');
if (!tests.includes('// ── Catalog owner private categories ──')) {
  const anchor = '    // New owner products must be pending + inactive.\n';
  const block = `    // ── Catalog owner private categories ──\n    await assertSucceeds(setDoc(doc(bob, "catalogCategories", "bob-flooring"), {\n      ownerId: "bob", businessId: "bob", scope: "business", name: "أرضيات", icon: "📁", active: true,\n      createdAt: new Date(), updatedAt: new Date(),\n    }));\n    await assertFails(updateDoc(doc(alice, "catalogCategories", "bob-flooring"), { name: "اختراق" }));\n    await assertSucceeds(updateDoc(doc(bob, "catalogCategories", "bob-flooring"), { name: "أرضيات وبورسلين", updatedAt: new Date() }));\n    await assertFails(updateDoc(doc(bob, "catalogCategories", "bob-flooring"), { ownerId: "alice" }));\n    await assertSucceeds(updateDoc(doc(bob, "catalogCategories", "bob-flooring"), { active: false, updatedAt: new Date() }));\n\n`;
  if (!tests.includes(anchor)) throw new Error('Owner category patch failed: tests anchor not found');
  tests = tests.replace(anchor, block + anchor);
}
fs.writeFileSync(FIRESTORE_TEST, tests);

console.log('✅ Owner catalog categories enabled safely');
