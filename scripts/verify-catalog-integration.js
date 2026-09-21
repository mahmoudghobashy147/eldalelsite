const fs = require('fs');

const app = fs.readFileSync('src/App.jsx','utf8');
const catalog = fs.readFileSync('src/catalog.jsx','utf8');
const firestore = fs.readFileSync('firestore.rules','utf8');
const storage = fs.readFileSync('storage.rules','utf8');

function requireText(haystack, needle, label){
  if(!haystack.includes(needle)) throw new Error(`Missing integration invariant: ${label}`);
}

// Existing core screens/features must still exist.
[
  ['const HomeScreen', 'HomeScreen'],
  ['const SearchScreen', 'SearchScreen'],
  ['const ProfileScreen', 'ProfileScreen'],
  ['const MyProfileScreen', 'MyProfileScreen'],
  ['const JobsScreen', 'JobsScreen code retained'],
  ['const AdminScreen', 'AdminScreen'],
  ['homeAds', 'existing ads data path'],
  ['posts', 'existing posts code'],
  ['QuickRequestModal', 'existing quick service request'],
  ['DirectMessagesScreen', 'existing messages'],
].forEach(([needle,label])=>requireText(app,needle,label));

// Only the jobs navigation item is removed; the Jobs screen/function stays in source.
if (/\{id:"jobs",\s*icon:"💼",\s*label:"الوظائف"\}/.test(app)) {
  throw new Error('Jobs navigation icon must be removed');
}
requireText(app, 'activeTab==="jobs"', 'Jobs route retained');

// New catalog wiring.
requireText(app, 'from "./catalog"', 'catalog import');
requireText(app, '<CatalogHomeSection db={db}', 'catalog homepage section');
requireText(app, 'activeTab==="catalog"', 'catalog screen route');
requireText(app, '["catalog","🧱","كتالوج مواد التشطيب"]', 'catalog admin navigation');
requireText(app, '<CatalogAdminPanel db={db}', 'catalog admin panel');

// Catalog capabilities requested by the product brief.
[
  ['كتالوج مواد التشطيب','catalog title'],
  ['catalogCategories','managed categories'],
  ['catalogBusinesses','businesses'],
  ['catalogProducts','products'],
  ['catalogAttributes','extensible attributes'],
  ['تواصل مع المورد','supplier contact'],
  ['واتساب','WhatsApp'],
  ['اتصال','phone call'],
  ['شارك المنتج','product share'],
  ['أحدث المنتجات والعروض','latest products and offers'],
  ['تحميل QR','QR download'],
  ['طباعة QR','QR print'],
  ['mainImage','main product image'],
  ['images:[]','multiple product images'],
  ['showPrice','optional price visibility'],
  ['availability','availability'],
  ['discount','discount/offers'],
  ['filterable','extensible filters'],
].forEach(([needle,label])=>requireText(catalog,needle,label));

// New rules are additive and isolated under catalog paths.
['catalogCategories','catalogBusinesses','catalogProducts','catalogAttributes'].forEach(name=>requireText(firestore,`match /${name}/`,`${name} Firestore rules`));
requireText(storage,'match /catalog/businesses/','catalog business media rules');
requireText(storage,'match /catalog/products/','catalog product media rules');

console.log('✅ Existing-site and finishing-catalog integration invariants passed');
