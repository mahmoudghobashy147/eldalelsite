const fs = require('fs');

const FILE = 'firestore.rules';
let rules = fs.readFileSync(FILE, 'utf8');

const oldBlock = `      // An approved store owner may submit a product, but every new product is\n      // forced into pending + inactive state until an admin reviews it.\n      allow create: if signedIn()\n        && request.resource.data.ownerId == request.auth.uid\n        && request.resource.data.businessId is string\n        && exists(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId))\n        && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('ownerId', '') == request.auth.uid\n        && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('approvalStatus', 'approved') == 'approved'\n        && request.resource.data.approvalStatus == 'pending'\n        && request.resource.data.active == false\n        && request.resource.data.featured == false;`;

const newBlock = `      // Admin may create catalog products directly. An approved store owner may\n      // submit a product only as pending + inactive until an admin reviews it.\n      allow create: if isAdmin()\n        || (signedIn()\n          && request.resource.data.ownerId == request.auth.uid\n          && request.resource.data.businessId is string\n          && exists(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId))\n          && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('ownerId', '') == request.auth.uid\n          && get(/databases/$(database)/documents/catalogBusinesses/$(request.resource.data.businessId)).data.get('approvalStatus', 'approved') == 'approved'\n          && request.resource.data.approvalStatus == 'pending'\n          && request.resource.data.active == false\n          && request.resource.data.featured == false);`;

if (rules.includes(newBlock)) {
  console.log('✓ admin catalog product creation already allowed');
} else {
  if (!rules.includes(oldBlock)) throw new Error('Catalog admin create fix: rule anchor not found');
  rules = rules.replace(oldBlock, newBlock);
  fs.writeFileSync(FILE, rules);
  console.log('✓ allowed admin product creation while preserving owner pending workflow');
}
