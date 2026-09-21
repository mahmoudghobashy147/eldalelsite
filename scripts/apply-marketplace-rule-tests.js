const fs = require("fs");
const path = require("path");

const rulesPath = path.join(__dirname, "..", "firestore.rules");
const testPath = path.join(__dirname, "test-firestore-rules.js");
let rules = fs.readFileSync(rulesPath, "utf8");
let tests = fs.readFileSync(testPath, "utf8");
let rulesChanged = false;
let testsChanged = false;

// Admins must be able to inspect drafts from the management interface, while
// public clients can only read entries explicitly published as active.
const publicRead = `allow read: if resource.data.get('status', '') == 'active';`;
const adminRead = `allow read: if resource.data.get('status', '') == 'active' || isAdmin();`;
if (rules.includes(publicRead)) {
  rules = rules.replaceAll(publicRead, adminRead);
  rulesChanged = true;
  console.log("✓ admins can read draft catalog entries");
}

const seedAnchor = `      await setDoc(doc(db, "notifications", "bobOnly"), {
        recipientId: "bob", body: "خاص ببوب", read: false,
      });`;
const seeded = `${seedAnchor}
      await setDoc(doc(db, "products", "activeProduct"), {
        name: "بورسلين تجريبي", category: "ceramic", status: "active", price: 450,
      });
      await setDoc(doc(db, "products", "draftProduct"), {
        name: "منتج مسودة", category: "ceramic", status: "draft",
      });
      await setDoc(doc(db, "stores", "activeStore"), {
        name: "متجر تجريبي", status: "active",
      });
      await setDoc(doc(db, "stores", "draftStore"), {
        name: "متجر مسودة", status: "draft",
      });`;
if (!tests.includes(`doc(db, "products", "activeProduct")`)) {
  if (!tests.includes(seedAnchor)) throw new Error("marketplace tests: seed anchor not found");
  tests = tests.replace(seedAnchor, seeded);
  testsChanged = true;
  console.log("✓ catalog fixtures added");
}

const testAnchor = `    // ── Payments/config ──────────────────────────────────────────`;
const catalogTests = `    // ── Product catalog / stores ─────────────────────────────────
    // Public visitors only see published entries.
    await assertSucceeds(getDoc(doc(anon, "products", "activeProduct")));
    await assertFails(getDoc(doc(anon, "products", "draftProduct")));
    await assertSucceeds(getDoc(doc(anon, "stores", "activeStore")));
    await assertFails(getDoc(doc(anon, "stores", "draftStore")));

    // Ordinary accounts cannot manufacture or edit catalog inventory.
    await assertFails(setDoc(doc(alice, "products", "forgedProduct"), {
      name: "Fake", category: "ceramic", status: "active",
    }));
    await assertFails(updateDoc(doc(alice, "products", "activeProduct"), { price: 1 }));
    await assertFails(deleteDoc(doc(alice, "products", "activeProduct")));
    await assertFails(setDoc(doc(alice, "stores", "forgedStore"), {
      name: "Fake store", status: "active",
    }));

    // Admin can manage active and draft catalog entries.
    await assertSucceeds(getDoc(doc(admin, "products", "draftProduct")));
    await assertSucceeds(getDoc(doc(admin, "stores", "draftStore")));
    await assertSucceeds(setDoc(doc(admin, "products", "adminProduct"), {
      name: "رخام إدارة", category: "marble", status: "draft",
    }));
    await assertSucceeds(updateDoc(doc(admin, "products", "adminProduct"), { status: "active" }));
    await assertSucceeds(deleteDoc(doc(admin, "products", "adminProduct")));

`;
if (!tests.includes("// ── Product catalog / stores")) {
  if (!tests.includes(testAnchor)) throw new Error("marketplace tests: assertion anchor not found");
  tests = tests.replace(testAnchor, catalogTests + testAnchor);
  testsChanged = true;
  console.log("✓ catalog security tests added");
}

if (rulesChanged) fs.writeFileSync(rulesPath, rules, "utf8");
if (testsChanged) fs.writeFileSync(testPath, tests, "utf8");
console.log(rulesChanged || testsChanged ? "Marketplace catalog rule tests ready" : "Marketplace catalog rule tests already present");
