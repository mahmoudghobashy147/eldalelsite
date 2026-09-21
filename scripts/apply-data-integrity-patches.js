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

// ── Client ───────────────────────────────────────────────────────
const appPath = path.join(__dirname, "..", "src", "App.jsx");
let app = fs.readFileSync(appPath, "utf8");
let appChanged = false;

let result = replaceOnce(
  app,
`      await addDoc(collection(db,"jobApplications"), { jobId, userId, ...data, status:"pending", appliedAt: new Date() });
      // بنزوّد عداد المتقدمين على الوظيفة نفسها — كان بيفضل 0 للأبد قبل كده
      await updateDoc(doc(db,"jobs",jobId), { applicants: increment(1) }).catch(()=>{});`,
`      // Deterministic id prevents duplicate applications from the same user for the same job.
      await setDoc(doc(db,"jobApplications", \`\${jobId}_\${userId}\`), {
        ...data, jobId, userId, status:"pending", appliedAt: new Date()
      });
      // applicants aggregate is updated by a trusted Cloud Function trigger.`,
  "make job applications unique and server-counted"
);
app = result.source; appChanged ||= result.changed;
if (appChanged) fs.writeFileSync(appPath, app, "utf8");

// ── Firestore rules ──────────────────────────────────────────────
const rulesPath = path.join(__dirname, "..", "firestore.rules");
let rules = fs.readFileSync(rulesPath, "utf8");
let rulesChanged = false;

for (const [oldText, newText, label] of [
  [
`      match /saved/{savedMemberId} {
        allow read, create, update, delete: if self(memberId) || isAdmin();
      }`,
`      match /saved/{savedMemberId} {
        allow read, delete: if self(memberId) || isAdmin();
        allow create: if self(memberId)
          && request.resource.data.memberId == savedMemberId;
        allow update: if isAdmin();
      }`,
    "bind saved document id to saved member id",
  ],
  [
`        allow create: if signedIn()
          && request.auth.uid == followerId
          && request.resource.data.followerId == request.auth.uid;`,
`        allow create: if signedIn()
          && request.auth.uid == followerId
          && memberId != request.auth.uid
          && request.resource.data.followerId == request.auth.uid;`,
    "block self follow documents",
  ],
  [
`      allow update: if isAdmin()
        || (signedIn() && resource.data.postedBy == request.auth.uid)
        || (signedIn()
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['applicants'])
          && request.resource.data.applicants == resource.data.get('applicants', 0) + 1);`,
`      allow update: if isAdmin()
        || (signedIn()
          && resource.data.postedBy == request.auth.uid
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['applicants']));`,
    "make job applicant count server-only",
  ],
  [
`      allow create: if signedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.status == 'pending';`,
`      allow create: if signedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.jobId is string
        && applicationId == request.resource.data.jobId + '_' + request.auth.uid
        && exists(/databases/$(database)/documents/jobs/$(request.resource.data.jobId))
        && request.resource.data.status == 'pending';`,
    "enforce one application per user and existing job",
  ],
]) {
  result = replaceOnce(rules, oldText, newText, label);
  rules = result.source; rulesChanged ||= result.changed;
}
if (rulesChanged) fs.writeFileSync(rulesPath, rules, "utf8");

// ── Tests ────────────────────────────────────────────────────────
const testPath = path.join(__dirname, "test-firestore-rules.js");
let tests = fs.readFileSync(testPath, "utf8");
let testsChanged = false;

result = replaceOnce(
  tests,
`    await assertSucceeds(setDoc(doc(alice, "members", "alice", "saved", "bob"), {
      memberId: "bob", savedAt: new Date(),
    }));`,
`    await assertSucceeds(setDoc(doc(alice, "members", "alice", "saved", "bob"), {
      memberId: "bob", savedAt: new Date(),
    }));
    await assertFails(setDoc(doc(alice, "members", "alice", "saved", "fake-path"), {
      memberId: "bob", savedAt: new Date(),
    }));`,
  "test saved target binding"
);
tests = result.source; testsChanged ||= result.changed;

result = replaceOnce(
  tests,
`    await assertFails(setDoc(doc(eve, "members", "bob", "followers", "alice"), {
      followerId: "alice", followedAt: new Date(),
    }));`,
`    await assertFails(setDoc(doc(eve, "members", "bob", "followers", "alice"), {
      followerId: "alice", followedAt: new Date(),
    }));
    await assertFails(setDoc(doc(bob, "members", "bob", "followers", "bob"), {
      followerId: "bob", followedAt: new Date(),
    }));`,
  "test self follow rejection"
);
tests = result.source; testsChanged ||= result.changed;

result = replaceOnce(
  tests,
`    await assertSucceeds(updateDoc(doc(bob, "jobs", "job1"), { applicants: 1 }));
    await assertFails(updateDoc(doc(bob, "jobs", "job1"), { applicants: 3 }));`,
`    await assertFails(updateDoc(doc(bob, "jobs", "job1"), { applicants: 1 }));
    await assertSucceeds(setDoc(doc(bob, "jobApplications", "job1_bob"), {
      jobId: "job1", userId: "bob", status: "pending", appliedAt: new Date(),
    }));
    await assertFails(setDoc(doc(bob, "jobApplications", "job1_bob"), {
      jobId: "job1", userId: "bob", status: "pending", appliedAt: new Date(),
    }));
    await assertFails(setDoc(doc(bob, "jobApplications", "random-id"), {
      jobId: "job1", userId: "bob", status: "pending", appliedAt: new Date(),
    }));`,
  "test server-only applicant count and unique applications"
);
tests = result.source; testsChanged ||= result.changed;

if (testsChanged) fs.writeFileSync(testPath, tests, "utf8");

console.log("Data integrity patches ready");
