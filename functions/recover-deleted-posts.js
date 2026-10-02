const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");

if (!admin.apps.length) admin.initializeApp();

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "eldalel-elshamel";
const DATABASE_ID = "(default)";
// قبل عملية الحذف التي بدأت حوالي 07:03 UTC يوم 2026-10-02.
const READ_TIME = process.env.RECOVERY_READ_TIME || "2026-10-02T06:55:00Z";

async function accessToken() {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function apiFetch(url, options = {}) {
  const token = await accessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText}: ${text}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const dbPath = `projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
const base = `https://firestore.googleapis.com/v1/${dbPath}`;

async function getDatabaseInfo() {
  try {
    const info = await apiFetch(base);
    console.log("Database recovery info:", JSON.stringify({
      name: info?.name,
      locationId: info?.locationId,
      type: info?.type,
      pointInTimeRecoveryEnablement: info?.pointInTimeRecoveryEnablement,
      earliestVersionTime: info?.earliestVersionTime,
      versionRetentionPeriod: info?.versionRetentionPeriod,
    }, null, 2));
    return info;
  } catch (err) {
    console.warn("Could not read database recovery info:", err.message);
    return null;
  }
}

async function runQuery(body) {
  const url = `${base}/documents:runQuery`;
  return apiFetch(url, {
    method: "POST",
    body: JSON.stringify({ ...body, readTime: READ_TIME }),
  });
}

async function historicalPosts() {
  const rows = await runQuery({
    structuredQuery: {
      from: [{ collectionId: "posts" }],
    },
  });
  return (rows || []).map((x) => x.document).filter(Boolean);
}

async function historicalComments() {
  try {
    const rows = await runQuery({
      structuredQuery: {
        from: [{ collectionId: "comments", allDescendants: true }],
      },
    });
    return (rows || []).map((x) => x.document).filter(Boolean);
  } catch (err) {
    console.warn("Historical comments query skipped:", err.message);
    return [];
  }
}

function docIdFromName(name) {
  return String(name || "").split("/").pop();
}

async function existsNow(documentName) {
  try {
    await apiFetch(`https://firestore.googleapis.com/v1/${documentName}`);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function restoreDocuments(documents, label) {
  let restored = 0;
  let alreadyExists = 0;
  const failures = [];

  for (const document of documents) {
    const name = document?.name;
    if (!name || !document?.fields) continue;

    try {
      if (await existsNow(name)) {
        alreadyExists += 1;
        continue;
      }

      await apiFetch(`${base}/documents:commit`, {
        method: "POST",
        body: JSON.stringify({
          writes: [{
            update: { name, fields: document.fields },
            currentDocument: { exists: false },
          }],
        }),
      });
      restored += 1;
      console.log(`Restored ${label}:`, name);
    } catch (err) {
      failures.push({ name, error: err.message });
      console.error(`Failed restoring ${label}:`, name, err.message);
    }
  }

  return { foundAtReadTime: documents.length, restored, alreadyExists, failures };
}

(async () => {
  console.log("Starting safe Firestore recovery attempt at readTime:", READ_TIME);
  await getDatabaseInfo();

  let posts;
  try {
    posts = await historicalPosts();
  } catch (err) {
    console.error("PITR/read-time recovery is not available for the requested timestamp:", err.message);
    process.exit(2);
  }

  console.log(`Historical posts found: ${posts.length}`);
  const postResult = await restoreDocuments(posts, "post");

  const comments = await historicalComments();
  console.log(`Historical comments found: ${comments.length}`);
  const commentResult = await restoreDocuments(comments, "comment");

  const summary = {
    readTime: READ_TIME,
    posts: postResult,
    comments: commentResult,
  };
  console.log("RECOVERY_SUMMARY", JSON.stringify(summary, null, 2));

  if (postResult.restored === 0 && postResult.alreadyExists === 0) {
    process.exitCode = 3;
  }
})();
