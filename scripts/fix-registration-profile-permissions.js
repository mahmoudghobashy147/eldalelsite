const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const appPath = path.join(root, "src", "App.jsx");
const rulesPath = path.join(root, "firestore.rules");
const testsPath = path.join(root, "scripts", "test-firestore-rules.js");

let app = fs.readFileSync(appPath, "utf8");
let rules = fs.readFileSync(rulesPath, "utf8");
let tests = fs.readFileSync(testsPath, "utf8");
let changed = false;

// Registration step 1 already creates the member document and its server/client-managed
// counters. Step 2 must only write editable profile fields. Rewriting createdAt/counters
// causes Firestore security rules to reject the whole merge.
const oldProfilePayload = `        plan: form.plan||"starter",\n        status: "pending",\n        available: false,\n        views:0, calls:0, waMessages:0, saves:0, rating:0, reviews:0,\n        createdAt: new Date(), updatedAt: new Date(),`;
const newProfilePayload = `        plan: form.plan||"starter",\n        status: "pending",\n        available: false,\n        updatedAt: new Date(),`;
if (!app.includes(newProfilePayload)) {
  if (!app.includes(oldProfilePayload)) {
    throw new Error("Registration profile patch: doSaveProfile payload anchor not found");
  }
  app = app.replace(oldProfilePayload, newProfilePayload);
  changed = true;
}

// A few accounts may already have been created by step 1 before the fix and therefore
// have no status field. Let the owner initialize *only* a missing status to pending once.
// Existing pending/approved/rejected statuses remain protected from owner changes.
const oldProtectedHead = `        'uid',\n        'isAdmin',\n        'status',\n        'verified',`;
const newProtectedHead = `        'uid',\n        'isAdmin',\n        'verified',`;
if (rules.includes(oldProtectedHead)) {
  rules = rules.replace(oldProtectedHead, newProtectedHead);
  changed = true;
}

const engagementFnAnchor = `    function memberEngagementFieldsUnchanged() {`;
const statusFn = `    function memberStatusChangeAllowed() {\n      let changedKeys = request.resource.data.diff(resource.data).affectedKeys();\n      return !changedKeys.hasAny(['status'])\n        || (!('status' in resource.data)\n          && request.resource.data.get('status', '') == 'pending');\n    }\n\n`;
if (!rules.includes("function memberStatusChangeAllowed()")) {
  if (!rules.includes(engagementFnAnchor)) {
    throw new Error("Registration profile patch: rules function anchor not found");
  }
  rules = rules.replace(engagementFnAnchor, statusFn + engagementFnAnchor);
  changed = true;
}

const oldUpdateGuard = `          && memberProtectedFieldsUnchanged()\n          && memberEngagementFieldsUnchanged()`;
const newUpdateGuard = `          && memberProtectedFieldsUnchanged()\n          && memberStatusChangeAllowed()\n          && memberEngagementFieldsUnchanged()`;
if (!rules.includes(newUpdateGuard)) {
  if (!rules.includes(oldUpdateGuard)) {
    throw new Error("Registration profile patch: member update guard anchor not found");
  }
  rules = rules.replace(oldUpdateGuard, newUpdateGuard);
  changed = true;
}

// Behavioral regression test for an account created before profile step 2 completes.
const seedAnchor = `      await setDoc(doc(db, "members", "bob"), {\n        uid: "bob", name: "Bob", status: "approved",\n        type: "engineer", plan: "basic", views: 0, calls: 0, waMessages: 0,\n        saves: 0, followersCount: 0, rating: 0, reviews: 0,\n      });`;
const seedWithLegacy = seedAnchor + `\n      await setDoc(doc(db, "members", "legacySignup"), {\n        uid: "legacySignup", name: "Legacy Signup", phone: "01110000000",\n        type: "starter", views: 0, calls: 0, waMessages: 0, saves: 0,\n        rating: 0, reviews: 0, createdAt: new Date(),\n      });`;
if (!tests.includes('"legacySignup"), {\n        uid: "legacySignup"')) {
  if (!tests.includes(seedAnchor)) {
    throw new Error("Registration profile patch: rules test seed anchor not found");
  }
  tests = tests.replace(seedAnchor, seedWithLegacy);
  changed = true;
}

const contextAnchor = `    const eve = testEnv.authenticatedContext("eve").firestore();`;
const contextWithLegacy = contextAnchor + `\n    const legacySignup = testEnv.authenticatedContext("legacySignup").firestore();`;
if (!tests.includes('authenticatedContext("legacySignup")')) {
  if (!tests.includes(contextAnchor)) {
    throw new Error("Registration profile patch: rules test context anchor not found");
  }
  tests = tests.replace(contextAnchor, contextWithLegacy);
  changed = true;
}

const editsAnchor = `    await assertSucceeds(updateDoc(doc(alice, "members", "alice"), {\n      name: "Alice Updated", specialty: "سباكة",\n    }));`;
const editsWithLegacy = editsAnchor + `\n    // Registration step 2: an existing self-owned doc with no status may initialize\n    // status to pending while saving normal professional profile fields.\n    await assertSucceeds(updateDoc(doc(legacySignup, "members", "legacySignup"), {\n      status: "pending", type: "craftsman", specialty: "بناء", gov: "الفيوم",\n      city: "إطسا", plan: "starter", available: false, updatedAt: new Date(),\n    }));\n    // Once initialized, the owner still cannot promote/approve themselves or rewrite createdAt.\n    await assertFails(updateDoc(doc(legacySignup, "members", "legacySignup"), { status: "approved" }));\n    await assertFails(updateDoc(doc(legacySignup, "members", "legacySignup"), { createdAt: new Date() }));`;
if (!tests.includes("Registration step 2: an existing self-owned doc")) {
  if (!tests.includes(editsAnchor)) {
    throw new Error("Registration profile patch: rules test edit anchor not found");
  }
  tests = tests.replace(editsAnchor, editsWithLegacy);
  changed = true;
}

fs.writeFileSync(appPath, app, "utf8");
fs.writeFileSync(rulesPath, rules, "utf8");
fs.writeFileSync(testsPath, tests, "utf8");
console.log(changed ? "✅ Registration profile permission fix applied" : "✓ Registration profile permission fix already applied");
