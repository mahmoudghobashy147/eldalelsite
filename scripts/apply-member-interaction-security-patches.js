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

// Client: all analytics counters go through a rate-limited callable.
const appPath = path.join(__dirname, "..", "src", "App.jsx");
let app = fs.readFileSync(appPath, "utf8");
let result = replaceOnce(
  app,
`  async trackStat(memberId, stat) {
    try {
      await updateDoc(doc(db,"members",memberId), { [stat]: increment(1) });
    } catch(e) { console.log("trackStat error:", e); }
  },`,
`  async trackStat(memberId, stat) {
    try {
      const recordMemberInteraction = httpsCallable(functions, "recordMemberInteraction");
      await recordMemberInteraction({ memberId, stat });
    } catch(e) { console.log("trackStat error:", e?.message || e); }
  },`,
  "route member interaction counters through server"
);
app = result.source;
if (result.changed) fs.writeFileSync(appPath, app, "utf8");

// Rules: no browser/mobile client may edit interaction aggregates directly.
const rulesPath = path.join(__dirname, "..", "firestore.rules");
let rules = fs.readFileSync(rulesPath, "utf8");
result = replaceOnce(
  rules,
`        || plusOne('views')
        || plusOne('calls')
        || plusOne('waMessages')
        // saves aggregate is server-managed from saved-document triggers.`,
`        // views/calls/waMessages are server-managed by recordMemberInteraction.
        // saves aggregate is server-managed from saved-document triggers.`,
  "block direct member interaction aggregate updates"
);
rules = result.source;
if (result.changed) fs.writeFileSync(rulesPath, rules, "utf8");

// Behavioral tests: direct analytics mutations must fail for anonymous/signed-in clients.
const testPath = path.join(__dirname, "test-firestore-rules.js");
let tests = fs.readFileSync(testPath, "utf8");
result = replaceOnce(
  tests,
`    await assertSucceeds(updateDoc(doc(anon, "members", "bob"), { views: 1 }));
    await assertFails(updateDoc(doc(anon, "members", "bob"), { views: 10 }));
    await assertSucceeds(updateDoc(doc(anon, "members", "bob"), { calls: 1 }));
    await assertSucceeds(updateDoc(doc(anon, "members", "bob"), { waMessages: 1 }));`,
`    await assertFails(updateDoc(doc(anon, "members", "bob"), { views: 1 }));
    await assertFails(updateDoc(doc(anon, "members", "bob"), { views: 10 }));
    await assertFails(updateDoc(doc(anon, "members", "bob"), { calls: 1 }));
    await assertFails(updateDoc(doc(anon, "members", "bob"), { waMessages: 1 }));
    await assertFails(updateDoc(doc(alice, "members", "bob"), { views: 1 }));`,
  "test server-only member interaction counters"
);
tests = result.source;
if (result.changed) fs.writeFileSync(testPath, tests, "utf8");

console.log("Member interaction security patches ready");
