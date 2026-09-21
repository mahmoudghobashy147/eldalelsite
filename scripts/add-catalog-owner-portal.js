const fs = require('fs');

const CATALOG = 'src/catalog.jsx';
const APP = 'src/App.jsx';
const FIRESTORE = 'firestore.rules';
const STORAGE = 'storage.rules';
const FIRESTORE_TEST = 'scripts/test-firestore-rules.js';
const STORAGE_TEST = 'scripts/test-storage-rules.js';

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Catalog owner patch failed: ${label} anchor not found`);
  return text.replace(from, to);
}

// ────────────────────────────────────────────────────────────────
// Catalog UI integration
// ────────────────────────────────────────────────────────────────
let catalog = fs.readFileSync(CATALOG, 'utf8');

if (!catalog.includes('from "./catalog-owner"')) {
  const anchor = 'import React, { useEffect, useMemo, useState } from "react";\n';
  catalog = replaceOnce(
    catalog,
    anchor,
    anchor + 'import { CatalogOwnerPortal, CatalogOwnerRequestsPanel } from "./catalog-owner";\n',
    'catalog owner import'
  );
}

catalog = replaceOnce(
  catalog,
  'export function CatalogScreen({db,darkMode}){',
  'export function CatalogScreen({db,storage,user,onRequireAuth,darkMode}){',
  'catalog screen owner props'
);

if (!catalog.includes('const [ownerOpen,setOwnerOpen]=useState(false);')) {
  const anchor = '  const [selectedBusiness,setSelectedBusiness]=useState(null),[selectedProduct,setSelectedProduct]=useState(null);\n';
  catalog = replaceOnce(
    catalog,
    anchor,
    anchor + '  const [ownerOpen,setOwnerOpen]=useState(false);\n',
    'owner portal state'
  );
}

if (!catalog.includes('if(ownerOpen) return <CatalogOwnerPortal')) {
  const anchor = '  if(selectedProduct) return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"25px 14px 100px":"34px 28px 70px"}}>';
  const block = '  if(ownerOpen) return <CatalogOwnerPortal db={db} storage={storage} user={user} darkMode={darkMode} onRequireAuth={onRequireAuth} onBack={()=>setOwnerOpen(false)}/>;\n' + anchor;
  catalog = replaceOnce(catalog, anchor, block, 'owner portal route');
}

if (!catalog.includes('data-catalog-owner-entry="true"')) {
  const anchor = '        <div style={{color:"rgba(255,255,255,.62)",fontSize:13,marginBottom:17}}>ابحث عن المنتج والخامة والمورد المناسب في مكان واحد</div>\n        <input value={search}';
  const replacement = '        <div style={{color:"rgba(255,255,255,.62)",fontSize:13,marginBottom:13}}>ابحث عن المنتج والخامة والمورد المناسب في مكان واحد</div>\n        <div data-catalog-owner-entry="true" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:13}}><Btn onClick={()=>{if(!user){onRequireAuth?.();return;}setOwnerOpen(true)}}>{user?"لوحة متجري / أضف نشاطك":"أضف نشاطك للكتالوج"}</Btn></div>\n        <input value={search}';
  catalog = replaceOnce(catalog, anchor, replacement, 'catalog owner entry button');
}

if (!catalog.includes('<CatalogOwnerRequestsPanel db={db}')) {
  const anchor = '    <div style={{display:"flex",gap:7,overflowX:"auto",marginBottom:13}}>{tabs.map(([id,icon,label])=>';
  const replacement = '    <CatalogOwnerRequestsPanel db={db} darkMode={darkMode} onChanged={load}/>\n' + anchor;
  catalog = replaceOnce(catalog, anchor, replacement, 'admin owner review panel');
}

catalog = catalog.replace(
  'export const CATALOG_COLLECTIONS = Object.freeze({categories:"catalogCategories",businesses:"catalogBusinesses",products:"catalogProducts",attributes:"catalogAttributes"});',
  'export const CATALOG_COLLECTIONS = Object.freeze({categories:"catalogCategories",businesses:"catalogBusinesses",products:"catalogProducts",attributes:"catalogAttributes",requests:"catalogBusinessRequests"});'
);

fs.writeFileSync(CATALOG, catalog);

// ────────────────────────────────────────────────────────────────
// App: pass the existing authenticated user + storage into catalog.
// This does not change the current authentication system.
// ────────────────────────────────────────────────────────────────
let app = fs.readFileSync(APP, 'utf8');
app = replaceOnce(
  app,
  '{activeTab==="catalog"&&<ErrorBoundary><CatalogScreen db={db} darkMode={darkMode}/></ErrorBoundary>}',
  '{activeTab==="catalog"&&<ErrorBoundary><CatalogScreen db={db} storage={storage} user={user} onRequireAuth={()=>setShowAuth(true)} darkMode={darkMode}/></ErrorBoundary>}',
  'catalog app owner props'
);
fs.writeFileSync(APP, app);

// ────────────────────────────────────────────────────────────────
// Firestore security: application -> admin approval -> owner store.
// Existing catalog records without ownerId remain admin-managed.
// ────────────────────────────────────────────────────────────────
let rules = fs.readFileSync(FIRESTORE, 'utf8');
if (!rules.includes('match /catalogBusinessRequests/{requestId}')) {
  const oldBlocks = `    match /catalogBusinesses/{businessId} {\n      allow get, list: if isAdmin() || resource.data.active == true;\n      allow create, update, delete: if isAdmin();\n    }\n\n    match /catalogProducts/{productId} {\n      allow get, list: if isAdmin() || resource.data.active == true;\n      allow create, update, delete: if isAdmin();\n    }`;
  const newBlocks = `    match /catalogBusinessRequests/{requestId} {\n      allow get: if isAdmin()\n        || (signedIn() && requestId == request.auth.uid && resource.data.ownerId == request.auth.uid);\n      allow list: if isAdmin();\n\n      allow create: if signedIn()\n        && requestId == request.auth.uid\n        && request.resource.data.ownerId == request.auth.uid\n        && request.resource.data.status == 'pending'\n        && !request.resource.data.keys().hasAny([\n          'businessId', 'approvedAt', 'reviewedAt', 'reviewedBy'\n        ]);\n\n      // A rejected/pending applicant may correct the same request and resubmit it,\n      // but cannot manufacture approval fields or approve themselves.\n      allow update: if isAdmin()\n        || (signedIn()\n          && requestId == request.auth.uid\n          && resource.data.ownerId == request.auth.uid\n          && resource.data.status != 'approved'\n          && request.resource.data.ownerId == request.auth.uid\n          && request.resource.data.status == 'pending'\n          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([\n            'name','activityType','description','governorate','area','address','branches',\n            'phones','whatsapp','mapUrl','facebook','instagram','website','logoUrl','coverUrl',\n            'offers','ownerName','ownerPhone','status','updatedAt'\n          ]));\n\n      allow delete: if isAdmin();\n    }\n\n    match /catalogBusinesses/{businessId} {\n      allow get, list: if isAdmin()\n        || resource.data.active == true\n        || (signedIn() && resource.data.get('ownerId', '') == request.auth.uid);\n\n      // Business creation/approval stays admin-only.\n      allow create: if isAdmin();\n\n      // Approved owners may edit presentation/contact data only. They cannot\n      // transfer ownership, self-feature, change approval, or self-activate.\n      allow update: if isAdmin()\n        || (signedIn()\n          && resource.data.get('ownerId', '') == request.auth.uid\n          && resource.data.get('approvalStatus', 'approved') == 'approved'\n          && request.resource.data.get('ownerId', '') == resource.data.get('ownerId', '')\n          && request.resource.data.get('approvalStatus', 'approved') == resource.data.get('approvalStatus', 'approved')\n          && request.resource.data.get('active', false) == resource.data.get('active', false)\n          && request.resource.data.get('featured', false) == resource.data.get('featured', false)\n          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([\n            'name','activityType','description','governorate','area','address','branches',\n            'phones','whatsapp','mapUrl','facebook','instagram','website','logoUrl','coverUrl',\n            'offers','updatedAt'\n          ]));\n\n      allow delete: if isAdmin();\n    }\n\n    match /catalogProducts/{productId} {\n      allow get, list: if isAdmin()\n        || resource.data.active == true\n        || (signedIn() && resource.data.get('ownerId', '') == request.auth.uid);\n\n      // An approved store owner may submit a product, but every new product is\n      // forced into pending + inactive state until an admin reviews it.\n      allow create: if signedIn()\n        && request.resource.data.ownerId == request.auth.uid\n        && request.resource.data.businessId is string\n        && exists(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId))\n        && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('ownerId', '') == request.auth.uid\n        && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('approvalStatus', 'approved') == 'approved'\n        && request.resource.data.approvalStatus == 'pending'\n        && request.resource.data.active == false\n        && request.resource.data.featured == false;\n\n      // Owners may edit their own product content. Approved products stay\n      // approved; pending products stay pending; rejected products may only be\n      // resubmitted as pending. Activation/featuring remains admin-controlled.\n      allow update: if isAdmin()\n        || (signedIn()\n          && resource.data.get('ownerId', '') == request.auth.uid\n          && request.resource.data.get('ownerId', '') == request.auth.uid\n          && request.resource.data.get('businessId', '') == resource.data.get('businessId', '')\n          && request.resource.data.get('featured', false) == resource.data.get('featured', false)\n          && exists(/databases/$(database)/documents/catalogBusinesses/$(resource.data.businessId))\n          && get(/databases/$(database)/documents/catalogBusinesses/$(resource.data.businessId)).data.get('ownerId', '') == request.auth.uid\n          && request.resource.data.diff(resource.data).affectedKeys().hasOnly([\n            'name','code','categoryId','subCategory','size','color','material','specs','description',\n            'price','showPrice','availability','discount','mainImage','images','attributes',\n            'approvalStatus','active','rejectionReason','updatedAt'\n          ])\n          && (\n            (resource.data.get('approvalStatus', 'approved') == 'approved'\n              && request.resource.data.get('approvalStatus', 'approved') == 'approved'\n              && request.resource.data.get('active', false) == resource.data.get('active', false))\n            || (resource.data.get('approvalStatus', 'pending') == 'pending'\n              && request.resource.data.get('approvalStatus', 'pending') == 'pending'\n              && request.resource.data.get('active', false) == false)\n            || (resource.data.get('approvalStatus', '') == 'rejected'\n              && request.resource.data.get('approvalStatus', '') == 'pending'\n              && request.resource.data.get('active', false) == false)\n          ));\n\n      allow delete: if isAdmin()\n        || (signedIn() && resource.data.get('ownerId', '') == request.auth.uid);\n    }`;
  rules = replaceOnce(rules, oldBlocks, newBlocks, 'catalog owner firestore rules');
}
fs.writeFileSync(FIRESTORE, rules);

// ────────────────────────────────────────────────────────────────
// Storage: owner-specific path keyed by Firebase uid.
// Existing admin upload paths stay unchanged.
// ────────────────────────────────────────────────────────────────
let storage = fs.readFileSync(STORAGE, 'utf8');
if (!storage.includes('match /catalog/owners/{ownerId}/{allPaths=**}')) {
  const anchor = '    // أي مسار آخر غير معروف مقفول.\n';
  const ownerRules = `    // صور يرفعها صاحب النشاط داخل مساحة مربوطة مباشرة بالـ uid الخاص به.\n    match /catalog/owners/{ownerId}/{allPaths=**} {\n      allow read: if true;\n      allow create, update: if (isAdmin() || (signedIn() && request.auth.uid == ownerId))\n        && imageUnder8MB();\n      allow delete: if isAdmin() || (signedIn() && request.auth.uid == ownerId);\n    }\n\n`;
  storage = replaceOnce(storage, anchor, ownerRules + anchor, 'catalog owner storage path');
}
fs.writeFileSync(STORAGE, storage);

// ────────────────────────────────────────────────────────────────
// Behavioral security tests are added idempotently so CI verifies that a
// normal member cannot bypass the approval workflow.
// ────────────────────────────────────────────────────────────────
let fireTest = fs.readFileSync(FIRESTORE_TEST, 'utf8');
if (!fireTest.includes('// ── Catalog owner approval workflow ──')) {
  const anchor = '    console.log("✅ Firestore behavioral security tests passed");';
  const tests = `    // ── Catalog owner approval workflow ──\n    await assertSucceeds(setDoc(doc(bob, "catalogBusinessRequests", "bob"), {\n      ownerId: "bob", ownerName: "Bob", ownerPhone: "01000000000",\n      name: "Bob Finishing", activityType: "محل", governorate: "القاهرة",\n      phones: "01000000000", status: "pending", createdAt: new Date(), updatedAt: new Date(),\n    }));\n    await assertFails(setDoc(doc(alice, "catalogBusinessRequests", "bob"), {\n      ownerId: "bob", name: "Forged", activityType: "محل", governorate: "القاهرة",\n      phones: "01000000000", status: "pending",\n    }));\n    await assertSucceeds(getDoc(doc(bob, "catalogBusinessRequests", "bob")));\n    await assertFails(getDoc(doc(alice, "catalogBusinessRequests", "bob")));\n    await assertSucceeds(getDoc(doc(admin, "catalogBusinessRequests", "bob")));\n\n    // A normal owner cannot create/approve their own business document.\n    await assertFails(setDoc(doc(bob, "catalogBusinesses", "bob"), {\n      ownerId: "bob", name: "Self Approved", active: true, approvalStatus: "approved", featured: false,\n    }));\n    await assertSucceeds(setDoc(doc(admin, "catalogBusinesses", "bob"), {\n      ownerId: "bob", name: "Bob Finishing", activityType: "محل", governorate: "القاهرة",\n      phones: "01000000000", active: true, featured: false, approvalStatus: "approved",\n    }));\n    await assertSucceeds(updateDoc(doc(bob, "catalogBusinesses", "bob"), { description: "Owner edit", updatedAt: new Date() }));\n    await assertFails(updateDoc(doc(bob, "catalogBusinesses", "bob"), { featured: true }));\n    await assertFails(updateDoc(doc(bob, "catalogBusinesses", "bob"), { ownerId: "alice" }));\n\n    // New owner products must be pending + inactive.\n    await assertSucceeds(setDoc(doc(bob, "catalogProducts", "bob-product-1"), {\n      ownerId: "bob", businessId: "bob", name: "سيراميك رمادي", categoryId: "ceramic",\n      active: false, featured: false, approvalStatus: "pending", createdAt: new Date(), updatedAt: new Date(),\n    }));\n    await assertSucceeds(getDoc(doc(bob, "catalogProducts", "bob-product-1")));\n    await assertFails(getDoc(doc(alice, "catalogProducts", "bob-product-1")));\n    await assertFails(getDoc(doc(anon, "catalogProducts", "bob-product-1")));\n    await assertFails(setDoc(doc(bob, "catalogProducts", "bob-product-bypass"), {\n      ownerId: "bob", businessId: "bob", name: "Bypass", categoryId: "ceramic",\n      active: true, featured: false, approvalStatus: "approved",\n    }));\n    await assertFails(setDoc(doc(alice, "catalogProducts", "alice-forged-product"), {\n      ownerId: "alice", businessId: "bob", name: "Forged", categoryId: "ceramic",\n      active: false, featured: false, approvalStatus: "pending",\n    }));\n\n    await assertSucceeds(updateDoc(doc(admin, "catalogProducts", "bob-product-1"), {\n      active: true, approvalStatus: "approved", approvedAt: new Date(),\n    }));\n    await assertSucceeds(getDoc(doc(anon, "catalogProducts", "bob-product-1")));\n    await assertSucceeds(updateDoc(doc(bob, "catalogProducts", "bob-product-1"), { description: "تعديل من صاحب المتجر", updatedAt: new Date() }));\n    await assertFails(updateDoc(doc(bob, "catalogProducts", "bob-product-1"), { featured: true }));\n    await assertSucceeds(deleteDoc(doc(bob, "catalogProducts", "bob-product-1")));\n\n`;
  fireTest = replaceOnce(fireTest, anchor, tests + anchor, 'catalog owner firestore tests');
}
fs.writeFileSync(FIRESTORE_TEST, fireTest);

let storageTest = fs.readFileSync(STORAGE_TEST, 'utf8');
if (!storageTest.includes('// ── Catalog owner media ──')) {
  const anchor = '    // Unknown paths stay closed.\n';
  const tests = `    // ── Catalog owner media ──\n    await assertSucceeds(uploadBytes(ref(alice, "catalog/owners/alice/businesses/alice/logo.jpg"), image, { contentType: "image/jpeg" }));\n    await assertFails(uploadBytes(ref(bob, "catalog/owners/alice/businesses/alice/hack.jpg"), image, { contentType: "image/jpeg" }));\n    await assertFails(uploadBytes(ref(anon, "catalog/owners/alice/businesses/alice/anon.jpg"), image, { contentType: "image/jpeg" }));\n    await assertFails(uploadBytes(ref(alice, "catalog/owners/alice/businesses/alice/not-image.txt"), image, { contentType: "text/plain" }));\n    await assertSucceeds(uploadBytes(ref(admin, "catalog/owners/alice/businesses/alice/admin.jpg"), image, { contentType: "image/jpeg" }));\n    await assertSucceeds(deleteObject(ref(alice, "catalog/owners/alice/businesses/alice/logo.jpg")));\n\n`;
  storageTest = replaceOnce(storageTest, anchor, tests + anchor, 'catalog owner storage tests');
}
fs.writeFileSync(STORAGE_TEST, storageTest);

console.log('✅ Catalog owner submission, approval, and store portal patch applied');
