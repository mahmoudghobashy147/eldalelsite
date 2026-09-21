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

const rulesPath = path.join(__dirname, "..", "firestore.rules");
let rules = fs.readFileSync(rulesPath, "utf8");
let rulesChanged = false;

for (const [oldText, newText, label] of [
  [
    `        || (signedIn() && plusOrMinusOneNonNegative('saves'))\n`,
    `        // saves aggregate is server-managed from saved-document triggers.\n`,
    "block direct saves aggregate updates",
  ],
  [
    `        || (signedIn() && plusOrMinusOneNonNegative('followersCount'))\n`,
    `        // followersCount aggregate is server-managed from follower-document triggers.\n`,
    "block direct follower aggregate updates",
  ],
  [
    `        || (signedIn() && reviewAggregateUpdate());`,
    `        // rating/reviews aggregates are server-managed from review triggers;\n        // no browser/mobile client may update them directly.\n        ;`,
    "block direct review aggregate updates",
  ],
]) {
  const result = replaceOnce(rules, oldText, newText, label);
  rules = result.source;
  rulesChanged ||= result.changed;
}

if (rulesChanged) fs.writeFileSync(rulesPath, rules, "utf8");

const testPath = path.join(__dirname, "test-firestore-rules.js");
let tests = fs.readFileSync(testPath, "utf8");
let testsChanged = false;

for (const [oldText, newText, label] of [
  [
    `    await assertSucceeds(updateDoc(doc(alice, "members", "bob"), { saves: 1 }));`,
    `    await assertFails(updateDoc(doc(alice, "members", "bob"), { saves: 1 }));`,
    "test direct save aggregate rejection",
  ],
  [
    `    await assertSucceeds(updateDoc(doc(alice, "members", "bob"), { followersCount: 1 }));`,
    `    await assertFails(updateDoc(doc(alice, "members", "bob"), { followersCount: 1 }));`,
    "test direct follower aggregate rejection",
  ],
  [
    `    await assertSucceeds(updateDoc(doc(alice, "members", "bob"), { reviews: 1, rating: 5 }));`,
    `    await assertFails(updateDoc(doc(alice, "members", "bob"), { reviews: 1, rating: 5 }));`,
    "test direct review aggregate rejection",
  ],
]) {
  const result = replaceOnce(tests, oldText, newText, label);
  tests = result.source;
  testsChanged ||= result.changed;
}

if (testsChanged) fs.writeFileSync(testPath, tests, "utf8");

console.log("Engagement security rule patches ready");
