const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'functions', 'index.js');
let src = fs.readFileSync(file, 'utf8');
const oldDef = 'exports.secureAdminLogin = onCall(async (request) => {';
const newDef = 'exports.secureAdminLogin = onCall({ invoker: "public" }, async (request) => {';

if (!src.includes(newDef)) {
  if (!src.includes(oldDef)) throw new Error('secureAdminLogin definition anchor not found');
  src = src.replace(oldDef, newDef);
  fs.writeFileSync(file, src, 'utf8');
  console.log('✅ secureAdminLogin transport set to public invoker');
} else {
  console.log('✓ secureAdminLogin public invoker already applied');
}
