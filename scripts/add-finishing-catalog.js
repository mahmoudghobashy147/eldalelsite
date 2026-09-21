const fs = require('fs');

const APP = 'src/App.jsx';
const FIRESTORE = 'firestore.rules';
const STORAGE = 'storage.rules';

function mustReplace(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Catalog patch failed: ${label} anchor not found`);
  return text.replace(from, to);
}

let app = fs.readFileSync(APP, 'utf8');

if (!app.includes('from "./catalog"')) {
  app = mustReplace(
    app,
    'import React,{useState,useEffect,useRef,useCallback,useMemo,Component} from "react";\n',
    'import React,{useState,useEffect,useRef,useCallback,useMemo,Component} from "react";\nimport { CatalogHomeSection, CatalogScreen, CatalogAdminPanel } from "./catalog";\n',
    'catalog import'
  );
}

if (!app.includes('<CatalogHomeSection db={db}')) {
  app = mustReplace(
    app,
    '      {!isDesktop && adsBlock}\n\n      {promoSlot === 0 && <PromoBanner cfg={cfg} />}',
    '      {!isDesktop && adsBlock}\n\n      {/* كتالوج مواد التشطيب — إضافة مستقلة بدون تغيير أي قسم حالي */}\n      <CatalogHomeSection db={db} darkMode={darkMode} onOpen={()=>onNavigate("catalog")} />\n\n      {promoSlot === 0 && <PromoBanner cfg={cfg} />}',
    'homepage catalog section'
  );
}

// Remove only the jobs navigation icon. Keep JobsScreen/data/routes untouched.
app = app.replace(/\s*\{id:"jobs", icon:"💼", label:"الوظائف"\},/g, '');

// Add catalog navigation in the same place where jobs was exposed.
if (!app.includes('{id:"catalog", icon:"🧱", label:"الكتالوج"}')) {
  const signedAnchor = '    {id:"saved", icon:"❤️", label:"المحفوظة"},\n';
  const signedReplacement = signedAnchor + '    {id:"catalog", icon:"🧱", label:"الكتالوج"},\n';
  app = mustReplace(app, signedAnchor, signedReplacement, 'signed catalog tab');
  const guestAnchor = '    {id:"search", icon:"🔍", label:"البحث"},\n';
  const first = app.indexOf(guestAnchor, app.indexOf('] : ['));
  if (first >= 0) {
    const at = first + guestAnchor.length;
    app = app.slice(0, at) + '    {id:"catalog", icon:"🧱", label:"الكتالوج"},\n' + app.slice(at);
  } else throw new Error('Catalog patch failed: guest catalog tab anchor not found');
}

if (!app.includes('activeTab==="catalog"&&<ErrorBoundary><CatalogScreen')) {
  app = mustReplace(
    app,
    '            {activeTab==="search"&&<ErrorBoundary><SearchScreen initialFilters={searchFilters} onMemberClick={handleMemberClick} darkMode={darkMode}/></ErrorBoundary>}\n',
    '            {activeTab==="search"&&<ErrorBoundary><SearchScreen initialFilters={searchFilters} onMemberClick={handleMemberClick} darkMode={darkMode}/></ErrorBoundary>}\n            {activeTab==="catalog"&&<ErrorBoundary><CatalogScreen db={db} darkMode={darkMode}/></ErrorBoundary>}\n',
    'catalog screen route'
  );
}

if (!app.includes('["catalog","🧱","كتالوج مواد التشطيب"]')) {
  app = mustReplace(
    app,
    '    ["ads","📢","الإعلانات"],\n',
    '    ["ads","📢","الإعلانات"],\n    ["catalog","🧱","كتالوج مواد التشطيب"],\n',
    'admin catalog nav'
  );
}

if (!app.includes('section==="catalog" && <CatalogAdminPanel')) {
  app = mustReplace(
    app,
    '        {/* ══════════════ PENDING MEMBERS ══════════════ */}\n',
    '        {/* ══════════════ FINISHING MATERIALS CATALOG ══════════════ */}\n        {section==="catalog" && <CatalogAdminPanel db={db} storage={storage} darkMode={darkMode}/>}\n\n        {/* ══════════════ PENDING MEMBERS ══════════════ */}\n',
    'admin catalog panel'
  );
}

if (!app.includes('new URLSearchParams(window.location.search).get("catalog")')) {
  app = mustReplace(
    app,
    '  const [activeTab, setActiveTab] = useState("home");\n',
    '  const [activeTab, setActiveTab] = useState(()=>new URLSearchParams(window.location.search).get("catalog") ? "catalog" : "home");\n',
    'catalog deep link'
  );
}

fs.writeFileSync(APP, app);

let rules = fs.readFileSync(FIRESTORE, 'utf8');
const catalogRules = `    // ----------------------------------------------------------\n    // FINISHING MATERIALS CATALOG\n    // New isolated collections; existing collections stay unchanged.\n    // Public visitors can read active records only. Admin manages all.\n    // ----------------------------------------------------------\n    match /catalogCategories/{categoryId} {\n      allow get, list: if isAdmin() || resource.data.active == true;\n      allow create, update, delete: if isAdmin();\n    }\n\n    match /catalogBusinesses/{businessId} {\n      allow get, list: if isAdmin() || resource.data.active == true;\n      allow create, update, delete: if isAdmin();\n    }\n\n    match /catalogProducts/{productId} {\n      allow get, list: if isAdmin() || resource.data.active == true;\n      allow create, update, delete: if isAdmin();\n    }\n\n    match /catalogAttributes/{attributeId} {\n      allow get, list: if isAdmin() || resource.data.active == true;\n      allow create, update, delete: if isAdmin();\n    }\n\n`;
if (!rules.includes('match /catalogCategories/{categoryId}')) {
  const anchor = '    // Server-only collections (config/adminSecrets, rate-limit docs, etc.) and\n';
  if (!rules.includes(anchor)) throw new Error('Catalog patch failed: Firestore rules anchor not found');
  rules = rules.replace(anchor, catalogRules + anchor);
  fs.writeFileSync(FIRESTORE, rules);
}

let storage = fs.readFileSync(STORAGE, 'utf8');
const catalogStorage = `    // كتالوج مواد التشطيب — الصور عامة للعرض، والرفع/الحذف للأدمن فقط\n    match /catalog/businesses/{businessId}/{fileName} {\n      allow read: if true;\n      allow create, update: if isAdmin() && imageUnder8MB();\n      allow delete: if isAdmin();\n    }\n\n    match /catalog/products/{productId}/{fileName} {\n      allow read: if true;\n      allow create, update: if isAdmin() && imageUnder8MB();\n      allow delete: if isAdmin();\n    }\n\n`;
if (!storage.includes('match /catalog/businesses/{businessId}/{fileName}')) {
  const anchor = '    // أي مسار آخر غير معروف مقفول.\n';
  if (!storage.includes(anchor)) throw new Error('Catalog patch failed: Storage rules anchor not found');
  storage = storage.replace(anchor, catalogStorage + anchor);
  fs.writeFileSync(STORAGE, storage);
}

console.log('✅ Finishing materials catalog patch applied');
