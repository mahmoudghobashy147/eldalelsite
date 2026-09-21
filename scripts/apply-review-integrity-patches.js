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

// ── Client code ──────────────────────────────────────────────────
const appPath = path.join(__dirname, "..", "src", "App.jsx");
let app = fs.readFileSync(appPath, "utf8");
let appChanged = false;

let result = replaceOnce(
  app,
`  async addReview(memberId, review) {
    try {
      await addDoc(collection(db,\`members/\${memberId}/reviews\`), { ...review, time: new Date() });
      // rating/reviews aggregates are updated by a trusted Cloud Function trigger.
    } catch(e) { console.error("addReview error:", e); }
  },`,
`  async addReview(memberId, review) {
    try {
      const reviewerId = String(review?.reviewerId || auth.currentUser?.uid || "");
      if (!reviewerId || reviewerId === String(memberId)) return false;
      // reviewId = Firebase UID guarantees one review per account for this member.
      // A second write becomes an update and Firestore Rules reject it.
      await setDoc(doc(db, \`members/\${memberId}/reviews\`, reviewerId), {
        ...review,
        reviewerId,
        time: new Date(),
      });
      // rating/reviews aggregates are updated by a trusted Cloud Function trigger.
      return true;
    } catch(e) {
      console.error("addReview error:", e);
      return false;
    }
  },`,
  "use reviewer UID as review document id"
);
app = result.source; appChanged ||= result.changed;

result = replaceOnce(
  app,
`    await DB.addReview(member.id,{name:currentUser?.displayName||"مستخدم",rating:reviewRating,text:reviewText});`,
`    const reviewSaved = await DB.addReview(member.id,{reviewerId:currentUser?.uid,name:currentUser?.displayName||"مستخدم",rating:reviewRating,text:reviewText});
    if (!reviewSaved) {
      alert("تعذر إضافة التقييم. مسموح بتقييم واحد لكل حساب، ولا يمكنك تقييم حسابك الشخصي.");
      setSubmitting(false);
      return;
    }`,
  "handle duplicate or self review in UI"
);
app = result.source; appChanged ||= result.changed;

if (appChanged) fs.writeFileSync(appPath, app, "utf8");

// ── Firestore Rules ──────────────────────────────────────────────
const rulesPath = path.join(__dirname, "..", "firestore.rules");
let rules = fs.readFileSync(rulesPath, "utf8");
let rulesChanged = false;

result = replaceOnce(
  rules,
`        allow create: if signedIn()
          && request.resource.data.rating is number
          && request.resource.data.rating >= 1
          && request.resource.data.rating <= 5
          && request.resource.data.text is string
          && request.resource.data.text.size() <= 2000;`,
`        allow create: if signedIn()
          && request.auth.uid == reviewId
          && request.auth.uid != memberId
          && request.resource.data.reviewerId == request.auth.uid
          && request.resource.data.rating is number
          && request.resource.data.rating >= 1
          && request.resource.data.rating <= 5
          && request.resource.data.text is string
          && request.resource.data.text.size() > 0
          && request.resource.data.text.size() <= 2000;`,
  "enforce one review per user and block self review"
);
rules = result.source; rulesChanged ||= result.changed;
if (rulesChanged) fs.writeFileSync(rulesPath, rules, "utf8");

// ── Rules tests ──────────────────────────────────────────────────
const testPath = path.join(__dirname, "test-firestore-rules.js");
let tests = fs.readFileSync(testPath, "utf8");
let testsChanged = false;

const marker = `    // ── Saved/followers subcollections ───────────────────────────`;
const inserted = `    // ── Review integrity ─────────────────────────────────────────\n    await assertSucceeds(setDoc(doc(alice, "members", "bob", "reviews", "alice"), {\n      reviewerId: "alice", name: "Alice", rating: 5, text: "ممتاز", time: new Date(),\n    }));\n    // Same UID cannot create a second review because this is now an update.\n    await assertFails(setDoc(doc(alice, "members", "bob", "reviews", "alice"), {\n      reviewerId: "alice", name: "Alice", rating: 1, text: "تغيير", time: new Date(),\n    }));\n    await assertFails(setDoc(doc(bob, "members", "bob", "reviews", "bob"), {\n      reviewerId: "bob", name: "Bob", rating: 5, text: "self", time: new Date(),\n    }));\n    await assertFails(setDoc(doc(eve, "members", "bob", "reviews", "forged-id"), {\n      reviewerId: "eve", name: "Eve", rating: 5, text: "forged", time: new Date(),\n    }));\n\n${marker}`;
result = replaceOnce(tests, marker, inserted, "test review uniqueness and identity");
tests = result.source; testsChanged ||= result.changed;
if (testsChanged) fs.writeFileSync(testPath, tests, "utf8");

console.log("Review integrity patches ready");
