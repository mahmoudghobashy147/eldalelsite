const fs = require("fs");
const path = require("path");

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`✓ ${label} already applied`);
    return { source, changed: false };
  }
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  console.log(`✓ ${label} applied`);
  return { source: source.replace(oldText, newText), changed: true };
}

// ── Client: route requests through callable function ─────────────
const appPath = path.join(__dirname, "..", "src", "App.jsx");
let app = fs.readFileSync(appPath, "utf8");
let appChanged = false;

let result = replaceOnce(
  app,
`      const ref = await addDoc(collection(db,"serviceRequests"), {
        text: data.text,
        gov: data.gov || "",
        city: data.city || "",
        userId: data.userId || null,
        userName: data.userName || "",
        phone: data.phone || "",
        status: "open",
        createdAt: new Date(),
      });
      return ref.id;`,
`      const createServiceRequest = httpsCallable(functions, "createServiceRequest");
      const response = await createServiceRequest({
        text: data.text,
        gov: data.gov || "",
        city: data.city || "",
        userName: data.userName || "",
        phone: data.phone || "",
      });
      return response.data?.id || "";`,
  "route quick service requests through server"
);
app = result.source; appChanged ||= result.changed;
if (appChanged) fs.writeFileSync(appPath, app, "utf8");

// ── Firestore rules: browsers cannot bypass callable validation ──
const rulesPath = path.join(__dirname, "..", "firestore.rules");
let rules = fs.readFileSync(rulesPath, "utf8");
let rulesChanged = false;

result = replaceOnce(
  rules,
`    match /serviceRequests/{requestId} {
      allow create: if request.resource.data.text is string
        && request.resource.data.text.size() > 0
        && request.resource.data.text.size() <= 1500;
      allow read, update, delete: if isAdmin();
    }`,
`    match /serviceRequests/{requestId} {
      // Quick requests are created by a trusted callable Cloud Function so
      // validation + rate limiting cannot be bypassed from the browser.
      allow create, read, update, delete: if isAdmin();
    }`,
  "block direct client service-request creation"
);
rules = result.source; rulesChanged ||= result.changed;
if (rulesChanged) fs.writeFileSync(rulesPath, rules, "utf8");

// ── Rules tests ──────────────────────────────────────────────────
const testPath = path.join(__dirname, "test-firestore-rules.js");
let tests = fs.readFileSync(testPath, "utf8");
let testsChanged = false;

result = replaceOnce(
  tests,
`    const requestRef = doc(anon, "serviceRequests", "request1");
    await assertSucceeds(setDoc(requestRef, { text: "محتاج سباك في القاهرة" }));
    await assertFails(getDoc(requestRef));
    await assertSucceeds(getDoc(doc(admin, "serviceRequests", "request1")));`,
`    const requestRef = doc(anon, "serviceRequests", "request1");
    await assertFails(setDoc(requestRef, { text: "محتاج سباك في القاهرة" }));
    const adminRequestRef = doc(admin, "serviceRequests", "request1");
    await assertSucceeds(setDoc(adminRequestRef, {
      text: "محتاج سباك في القاهرة", status: "open"
    }));
    await assertFails(getDoc(requestRef));
    await assertSucceeds(getDoc(adminRequestRef));`,
  "test callable-only service-request writes"
);
tests = result.source; testsChanged ||= result.changed;
if (testsChanged) fs.writeFileSync(testPath, tests, "utf8");

console.log("Service-request security patches ready");
