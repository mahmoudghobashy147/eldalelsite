const fs = require('fs');
const path = require('path');

function must(condition, message) {
  if (!condition) throw new Error(`Catalog owner verification failed: ${message}`);
}

const owner = fs.readFileSync('src/catalog-owner.jsx', 'utf8');
const catalog = fs.readFileSync('src/catalog.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const firestore = fs.readFileSync('firestore.rules', 'utf8');
const storage = fs.readFileSync('storage.rules', 'utf8');

must(owner.includes('export function CatalogOwnerPortal'), 'owner portal component missing');
must(owner.includes('export function CatalogOwnerRequestsPanel'), 'admin review component missing');
must(owner.includes('إرسال طلب الإضافة'), 'owner request flow missing');
must(owner.includes('approvalStatus:"pending"'), 'new products are not forced into pending state');
must(catalog.includes('from "./catalog-owner"'), 'catalog owner import missing');
must(catalog.includes('data-catalog-owner-entry="true"'), 'catalog owner entry button missing');
must(catalog.includes('<CatalogOwnerPortal'), 'owner portal route missing');
must(catalog.includes('<CatalogOwnerRequestsPanel'), 'admin review panel missing');
must(app.includes('storage={storage} user={user} onRequireAuth={()=>setShowAuth(true)}'), 'existing auth/user not passed into catalog');
must(firestore.includes('match /catalogBusinessRequests/{requestId}'), 'business request rules missing');
must(firestore.includes("request.resource.data.approvalStatus == 'pending'"), 'pending-product security rule missing');
must(storage.includes('match /catalog/owners/{ownerId}/{allPaths=**}'), 'owner media storage path missing');

const buildDir = path.join('build', 'static', 'js');
const built = fs.existsSync(buildDir)
  ? fs.readdirSync(buildDir).filter(x => x.endsWith('.js')).map(x => fs.readFileSync(path.join(buildDir, x), 'utf8')).join('\n')
  : '';
must(built.includes('لوحة متجري') || built.includes('إضافة نشاطك للكتالوج'), 'owner portal text missing from production bundle');
must(built.includes('طلبات أصحاب الأنشطة والمنتجات'), 'admin review text missing from production bundle');

console.log('✅ Catalog owner portal integration verified');
