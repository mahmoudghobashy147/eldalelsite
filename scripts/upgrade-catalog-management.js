const fs = require('fs');

const OWNER = 'src/catalog-owner.jsx';
const CATALOG = 'src/catalog.jsx';
const APP = 'src/App.jsx';
const RULES = 'firestore.rules';
const VERIFY = 'scripts/verify-catalog-owner-portal.js';

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Catalog management upgrade failed: ${label}`);
  return text.replace(from, to);
}

// ------------------------------------------------------------------
// 1) Owner dashboard: use the existing `active` field for hide/show.
// This is schema-compatible with every existing product and requires no backfill.
// ------------------------------------------------------------------
let owner = fs.readFileSync(OWNER, 'utf8');
owner = owner.replace('  const hidden=p.ownerHidden===true;\n', '  const hidden=approved&&p.active===false;\n');
owner = owner.replace('        data.ownerHidden=editingProduct.ownerHidden===true;\n', '');
owner = owner.replace('data.active=false;data.ownerHidden=false;data.rejectionReason=""', 'data.active=false;data.rejectionReason=""');
owner = owner.replace('approvalStatus:"pending",active:false,featured:false,ownerHidden:false,createdAt:', 'approvalStatus:"pending",active:false,featured:false,createdAt:');
owner = owner.replace('approvalStatus:"approved",active:true,ownerHidden:false,rejectionReason:', 'approvalStatus:"approved",active:true,rejectionReason:');
owner = owner.replace('const toggleHidden=async p=>{if((p.approvalStatus||"approved")!=="approved")return;const next=!(p.ownerHidden===true);try{await updateDoc(doc(db,"catalogProducts",p.id),{ownerHidden:next,updatedAt:serverTimestamp()});setProducts(xs=>xs.map(x=>x.id===p.id?{...x,ownerHidden:next}:x))}catch(e){alert(e.message)}};',
  'const toggleHidden=async p=>{if((p.approvalStatus||"approved")!=="approved")return;const next=p.active===false;try{await updateDoc(doc(db,"catalogProducts",p.id),{active:next,updatedAt:serverTimestamp()});setProducts(xs=>xs.map(x=>x.id===p.id?{...x,active:next}:x))}catch(e){alert(e.message)}};');
owner = owner.replace('products.filter(p=>(p.approvalStatus||"approved")==="approved"&&p.ownerHidden!==true).length', 'products.filter(p=>(p.approvalStatus||"approved")==="approved"&&p.active!==false).length');
fs.writeFileSync(OWNER, owner);

// ------------------------------------------------------------------
// 2) Customer catalog: search/category filters inside each company and QR per product.
// ------------------------------------------------------------------
let catalog = fs.readFileSync(CATALOG, 'utf8');

if (!catalog.includes('const productQrUrl = id =>')) {
  const anchor = 'const productUrl = (productId) => {\n  const origin = typeof window !== "undefined" ? window.location.origin : "https://eldalel-elshamel.online";\n  return `${origin}/?catalog=product&productId=${encodeURIComponent(productId)}`;\n};\n';
  const add = `${anchor}const productQrUrl = id => \`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=\${encodeURIComponent(productUrl(id))}\`;\nasync function downloadProductQr(id,name){\n  const url=productQrUrl(id);\n  try{\n    const r=await fetch(url); if(!r.ok) throw new Error('qr');\n    const blob=await r.blob(), objectUrl=URL.createObjectURL(blob);\n    const a=document.createElement('a'); a.href=objectUrl; a.download=\`QR-\${String(name||id).replace(/[^\\p{L}\\p{N}._-]+/gu,'_')}.png\`;\n    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objectUrl);\n  }catch{ window.open(url,'_blank','noopener,noreferrer'); }\n}\n`;
  catalog = replaceOnce(catalog, anchor, add, 'product QR helpers');
}

if (!catalog.includes('data-product-qr="true"')) {
  const anchor = '        {business&&<div style={{borderTop:`1px solid ${c.border}`,marginTop:16,paddingTop:14}}><div style={{fontWeight:900,color:c.tc}}>{business.name}</div><div style={{fontSize:12,color:c.sub,marginTop:3}}>{business.address||business.governorate}</div></div>}\n        <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(2,1fr)",gap:8,marginTop:16}}>';
  const replacement = '        {business&&<div style={{borderTop:`1px solid ${c.border}`,marginTop:16,paddingTop:14}}><div style={{fontWeight:900,color:c.tc}}>{business.name}</div><div style={{fontSize:12,color:c.sub,marginTop:3}}>{business.address||business.governorate}</div></div>}\n        <div data-product-qr="true" style={{display:"flex",alignItems:"center",gap:10,marginTop:14,padding:10,border:`1px solid ${c.border}`,borderRadius:12}}><img src={productQrUrl(p.id)} alt={`QR ${p.name}`} style={{width:66,height:66,borderRadius:8}}/><div style={{flex:1}}><div style={{fontWeight:900,color:c.tc,fontSize:12}}>QR السلعة</div><div style={{fontSize:10.5,color:c.sub,marginTop:2}}>يفتح صفحة السلعة مباشرة</div><div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}><Btn secondary onClick={()=>downloadProductQr(p.id,p.name)} style={{padding:"6px 9px",fontSize:10}}>تحميل QR</Btn><Btn secondary onClick={()=>{if(navigator.share)navigator.share({title:p.name,url:productUrl(p.id)}).catch(()=>{});else navigator.clipboard?.writeText(productUrl(p.id));}} style={{padding:"6px 9px",fontSize:10}}>مشاركة</Btn></div></div></div>\n        <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(2,1fr)",gap:8,marginTop:16}}>';
  catalog = replaceOnce(catalog, anchor, replacement, 'product QR panel');
}

if (!catalog.includes('const [storeSearch,setStoreSearch]')) {
  const anchor = 'function BusinessDetails({b,products,categories,onBack,onProduct,darkMode}){\n  const c=cardColors(darkMode), mobile=useMobile();\n  const phones=lines(b.phones), branches=lines(b.branches), wa=(b.whatsapp||phones[0]||"").replace(/\\D/g,"");';
  const replacement = 'function BusinessDetails({b,products,categories,onBack,onProduct,darkMode}){\n  const c=cardColors(darkMode), mobile=useMobile();\n  const [storeSearch,setStoreSearch]=useState("");\n  const [storeCategory,setStoreCategory]=useState("");\n  const phones=lines(b.phones), branches=lines(b.branches), wa=(b.whatsapp||phones[0]||"").replace(/\\D/g,"");\n  const storeCategoryIds=[...new Set(products.map(p=>p.categoryId).filter(Boolean))];\n  const visibleProducts=products.filter(p=>{const q=normalize(storeSearch);if(storeCategory&&p.categoryId!==storeCategory)return false;return !q||normalize([p.name,p.description,p.specs,p.subCategory,p.size,p.color].join(" ")).includes(q);});';
  catalog = replaceOnce(catalog, anchor, replacement, 'store search state');
}

if (!catalog.includes('data-store-product-search="true"')) {
  const anchor = '    <SectionTitle darkMode={darkMode} title="منتجات الشركة" sub={`${products.length} منتج`}/>\n    {products.length?<div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},minmax(0,1fr))`,gap:11}}>\n      {products.map(p=><ProductCard key={p.id} p={p} business={b} category={categories.find(c=>c.id===p.categoryId)} onOpen={onProduct} darkMode={darkMode}/>)}</div>:<div style={{textAlign:"center",padding:35,color:c.sub}}>لا توجد منتجات منشورة حاليًا</div>}' ;
  const replacement = '    <div data-store-product-search="true" style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:11,marginBottom:14}}><input value={storeSearch} onChange={e=>setStoreSearch(e.target.value)} placeholder="ابحث داخل منتجات الشركة..." style={{...filterStyle(c),padding:"12px"}}/><div style={{display:"flex",gap:7,overflowX:"auto",marginTop:9,paddingBottom:2}}><button onClick={()=>setStoreCategory("")} style={{border:`1px solid ${!storeCategory?GOLD:c.border}`,background:!storeCategory?GOLD:c.input,color:!storeCategory?NAVY_DEEP:c.tc,borderRadius:20,padding:"6px 10px",whiteSpace:"nowrap",fontFamily:"Cairo",fontWeight:800}}>الكل</button>{storeCategoryIds.map(id=>{const cat=categories.find(c=>c.id===id);return <button key={id} onClick={()=>setStoreCategory(id)} style={{border:`1px solid ${storeCategory===id?GOLD:c.border}`,background:storeCategory===id?GOLD:c.input,color:storeCategory===id?NAVY_DEEP:c.tc,borderRadius:20,padding:"6px 10px",whiteSpace:"nowrap",fontFamily:"Cairo",fontWeight:800}}>{cat?.name||"قسم"}</button>})}</div></div>\n    <SectionTitle darkMode={darkMode} title="منتجات الشركة" sub={`${visibleProducts.length} منتج`}/>\n    {visibleProducts.length?<div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},minmax(0,1fr))`,gap:11}}>\n      {visibleProducts.map(p=><ProductCard key={p.id} p={p} business={b} category={categories.find(c=>c.id===p.categoryId)} onOpen={onProduct} darkMode={darkMode}/>)}</div>:<div style={{textAlign:"center",padding:35,color:c.sub}}>لا توجد منتجات مطابقة</div>}' ;
  catalog = replaceOnce(catalog, anchor, replacement, 'store search UI');
}

// Logged-in users see the requested explicit wording.
catalog = catalog.replace('{user?"لوحة متجري / أضف نشاطك":"أضف نشاطك للكتالوج"}', '{user?"إدارة الكتالوج":"أضف نشاطك للكتالوج"}');

// Admin dashboard metrics and quick activation controls.
if (!catalog.includes('const catalogStats={')) {
  const anchor = '  useEffect(()=>{load().catch(console.error)},[db]);\n';
  const addition = `${anchor}  const catalogStats={totalBusinesses:businesses.length,totalProducts:products.length,newProducts:products.filter(p=>p.ownerId&&p.approvalStatus==="pending").length,activeBusinesses:businesses.filter(b=>b.active!==false).length,stoppedBusinesses:businesses.filter(b=>b.active===false).length};\n  const toggleBusinessActive=async x=>{try{await updateDoc(doc(db,"catalogBusinesses",x.id),{active:x.active===false,updatedAt:serverTimestamp()});await load()}catch(e){alert(e.message)}};\n  const toggleProductActive=async x=>{try{await updateDoc(doc(db,"catalogProducts",x.id),{active:x.active===false,updatedAt:serverTimestamp()});await load()}catch(e){alert(e.message)}};\n`;
  // Only the CatalogAdminPanel load/useEffect occurrence contains this exact compact form.
  const idx=catalog.indexOf('export function CatalogAdminPanel');
  if(idx<0)throw new Error('Catalog management upgrade failed: admin panel missing');
  const before=catalog.slice(0,idx), after=catalog.slice(idx);
  if(!after.includes(anchor))throw new Error('Catalog management upgrade failed: admin load anchor');
  catalog=before+after.replace(anchor,addition);
}

if (!catalog.includes('data-catalog-admin-stats="true"')) {
  const anchor = '    <CatalogOwnerRequestsPanel db={db} darkMode={darkMode} onChanged={load}/>\n';
  const stats = `${anchor}    <div data-catalog-admin-stats="true" style={{display:"grid",gridTemplateColumns:mobile?"repeat(2,1fr)":"repeat(5,1fr)",gap:8,marginBottom:13}}>{[["الكتالوجات",catalogStats.totalBusinesses],["المنتجات",catalogStats.totalProducts],["منتجات جديدة",catalogStats.newProducts],["نشطة",catalogStats.activeBusinesses],["موقوفة",catalogStats.stoppedBusinesses]].map(([label,val])=><div key={label} style={{background:c.card,border:\`1px solid \${c.border}\`,borderRadius:12,padding:11}}><div style={{fontSize:10.5,color:c.sub}}>{label}</div><div style={{fontFamily:"Cairo",fontSize:22,fontWeight:900,color:c.tc}}>{val}</div></div>)}</div>\n`;
  catalog = replaceOnce(catalog, anchor, stats, 'admin stats');
}

catalog = catalog.replace('<Btn secondary onClick={()=>editB(x)}>تعديل</Btn><Btn secondary onClick={()=>window.open(catalogUrl(x.id))}>فتح</Btn>', '<Btn secondary onClick={()=>editB(x)}>تعديل</Btn><Btn secondary onClick={()=>{setSearch(x.name);setTab("products")}}>المنتجات</Btn><Btn secondary onClick={()=>toggleBusinessActive(x)}>{x.active===false?"إعادة تفعيل":"إيقاف"}</Btn><Btn secondary onClick={()=>window.open(catalogUrl(x.id))}>فتح</Btn>');
catalog = catalog.replace('<Btn secondary onClick={()=>editP(x)}>تعديل</Btn><button onClick={()=>remove("products",x.id,x.name)}', '<Btn secondary onClick={()=>editP(x)}>تعديل</Btn><Btn secondary onClick={()=>toggleProductActive(x)}>{x.active===false?"إظهار":"إخفاء"}</Btn><button onClick={()=>remove("products",x.id,x.name)}');
catalog = catalog.replace('🧱 إدارة كتالوج مواد التشطيب', '🧱 إدارة الكتالوجات');

fs.writeFileSync(CATALOG, catalog);

// ------------------------------------------------------------------
// 3) Firestore: approved owners may hide/show ONLY their approved products.
// New products are still forced pending + inactive, so this cannot bypass review.
// ------------------------------------------------------------------
let rules = fs.readFileSync(RULES, 'utf8');
rules = rules.replace(
  "&& request.resource.data.get('active', false) == resource.data.get('active', false))",
  "&& request.resource.data.get('active', false) is bool)"
);
fs.writeFileSync(RULES, rules);

// ------------------------------------------------------------------
// 4) Account screen: explicit إدارة الكتالوج button. No existing profile data changes.
// ------------------------------------------------------------------
let app = fs.readFileSync(APP, 'utf8');
app = app.replace(
  'const MyProfileScreen = ({ onSuccess, darkMode, currentUser, onMemberClick, onShowPayment }) => {',
  'const MyProfileScreen = ({ onSuccess, darkMode, currentUser, onMemberClick, onShowPayment, onOpenCatalog }) => {'
);
if (!app.includes('data-profile-catalog-button="true"')) {
  const anchor = '        <div style={{padding:isDesktop?"0 28px":0}}>\n        <div style={{background:card,borderRadius:15,padding:15,marginBottom:11,border:`2px solid ${planInfo.color}33`}}>';
  const replacement = '        <div style={{padding:isDesktop?"0 28px":0}}>\n        <button data-profile-catalog-button="true" onClick={onOpenCatalog} style={{width:"100%",marginBottom:11,border:"none",borderRadius:15,padding:"14px 16px",background:`linear-gradient(135deg,${C.gold},${C.goldDark})`,color:C.navyDeep,fontFamily:"Cairo",fontWeight:900,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}><span>🏪 إدارة الكتالوج</span><span>←</span></button>\n        <div style={{background:card,borderRadius:15,padding:15,marginBottom:11,border:`2px solid ${planInfo.color}33`}}>';
  app = replaceOnce(app, anchor, replacement, 'profile catalog button');
}
app = app.replace(
  '<MyProfileScreen onSuccess={handleRegisterSuccess} darkMode={darkMode} currentUser={user} onMemberClick={handleMemberClick} onShowPayment={()=>setShowPayment(true)}/>',
  '<MyProfileScreen onSuccess={handleRegisterSuccess} darkMode={darkMode} currentUser={user} onMemberClick={handleMemberClick} onShowPayment={()=>setShowPayment(true)} onOpenCatalog={()=>setActiveTab("catalog")}/>'
);
fs.writeFileSync(APP, app);

// ------------------------------------------------------------------
// 5) Build-time invariants so regressions stop before deployment.
// ------------------------------------------------------------------
let verify = fs.readFileSync(VERIFY, 'utf8');
if (!verify.includes('owner.includes(\'إدارة الكتالوج\')')) {
  const anchor = "must(owner.includes('إرسال طلب الإضافة'), 'owner request flow missing');\n";
  const add = `${anchor}must(owner.includes('إدارة الكتالوج'), 'simple catalog management title missing');\nmust(owner.includes('+ إضافة سلعة'), 'simple add-product action missing');\nmust(owner.includes('toggleAvailability'), 'quick availability control missing');\nmust(owner.includes('toggleHidden'), 'quick hide/show control missing');\nmust(owner.includes('QR الكتالوج'), 'catalog QR action missing');\nmust(catalog.includes('data-product-qr="true"'), 'product QR missing');\nmust(catalog.includes('data-store-product-search="true"'), 'business product search missing');\nmust(catalog.includes('data-catalog-admin-stats="true"'), 'admin catalog stats missing');\nmust(app.includes('data-profile-catalog-button="true"'), 'profile catalog management button missing');\n`;
  verify = replaceOnce(verify, anchor, add, 'verification invariants');
}
fs.writeFileSync(VERIFY, verify);

console.log('✅ Safe catalog management upgrade applied without data migration');
