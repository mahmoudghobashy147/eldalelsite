const fs = require('fs');
const file = 'scripts/test-firestore-rules.js';
let text = fs.readFileSync(file, 'utf8');

if (!text.includes('// ── Catalog owner quick hide/show controls ──')) {
  const anchor = '    await assertSucceeds(getDoc(doc(anon, "catalogProducts", "bob-product-1")));\n    await assertSucceeds(updateDoc(doc(bob, "catalogProducts", "bob-product-1"), { description: "تعديل من صاحب المتجر", updatedAt: new Date() }));';
  const replacement = `    await assertSucceeds(getDoc(doc(anon, "catalogProducts", "bob-product-1")));\n\n    // ── Catalog owner quick hide/show controls ──\n    // Only an already-approved product may be hidden/shown by its owner.\n    await assertSucceeds(updateDoc(doc(bob, "catalogProducts", "bob-product-1"), { active: false, updatedAt: new Date() }));\n    await assertFails(getDoc(doc(anon, "catalogProducts", "bob-product-1")));\n    await assertSucceeds(getDoc(doc(bob, "catalogProducts", "bob-product-1")));\n    await assertSucceeds(updateDoc(doc(bob, "catalogProducts", "bob-product-1"), { active: true, updatedAt: new Date() }));\n    await assertSucceeds(getDoc(doc(anon, "catalogProducts", "bob-product-1")));\n    await assertFails(updateDoc(doc(alice, "catalogProducts", "bob-product-1"), { active: false, updatedAt: new Date() }));\n\n    await assertSucceeds(updateDoc(doc(bob, "catalogProducts", "bob-product-1"), { description: "تعديل من صاحب المتجر", updatedAt: new Date() }));`;
  if (!text.includes(anchor)) throw new Error('Catalog management rule-test anchor not found');
  text = text.replace(anchor, replacement);
}

fs.writeFileSync(file, text);
console.log('✅ Catalog owner hide/show behavioral tests added');
