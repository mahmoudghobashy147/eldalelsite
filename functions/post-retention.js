const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const RETENTION_DAYS = 30;
const STORAGE_BUCKET = "eldalel-elshamel.firebasestorage.app";
const POST_STORAGE_PREFIXES = [
  "posts/",
  "post-images/",
  "postImages/",
  "post-videos/",
  "postVideos/",
  "post_media/",
  "postMedia/",
  "uploads/posts/",
];

function cutoffTimestamp(days = RETENTION_DAYS) {
  return admin.firestore.Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
}

function storagePathFromUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/o\/(.+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch (_) {
    return null;
  }
}

function collectStoragePaths(value, output = new Set()) {
  if (typeof value === "string") {
    const p = storagePathFromUrl(value);
    if (p && POST_STORAGE_PREFIXES.some((prefix) => p.startsWith(prefix))) output.add(p);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStoragePaths(item, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStoragePaths(item, output));
  }
  return output;
}

async function deleteStorageForPost(bucket, postId, postData) {
  const paths = collectStoragePaths(postData);
  const prefixes = [
    `posts/${postId}/`,
    `post-images/${postId}/`,
    `postImages/${postId}/`,
    `post-videos/${postId}/`,
    `postVideos/${postId}/`,
    `post_media/${postId}/`,
    `postMedia/${postId}/`,
    `uploads/posts/${postId}/`,
  ];

  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix });
    files.forEach((file) => paths.add(file.name));
  }

  await Promise.allSettled(
    [...paths].map((path) => bucket.file(path).delete({ ignoreNotFound: true }))
  );
}

async function deleteExpiredByField(db, bucket, field, cutoff) {
  let deletedPosts = 0;

  while (true) {
    const snap = await db.collection("posts")
      .where(field, "<=", cutoff)
      .limit(100)
      .get();

    if (snap.empty) break;

    for (const postDoc of snap.docs) {
      await deleteStorageForPost(bucket, postDoc.id, postDoc.data()).catch((err) => {
        console.error("deleteStorageForPost", postDoc.id, err);
      });
      await db.recursiveDelete(postDoc.ref);
      deletedPosts += 1;
    }
  }

  return deletedPosts;
}

async function deleteExpiredPostDocuments(db, bucket, days = RETENTION_DAYS) {
  const cutoff = cutoffTimestamp(days);
  let deletedPosts = 0;

  deletedPosts += await deleteExpiredByField(db, bucket, "createdAt", cutoff);
  deletedPosts += await deleteExpiredByField(db, bucket, "time", cutoff);

  return deletedPosts;
}

async function runPostRetentionCleanup() {
  const db = admin.firestore();
  const bucket = admin.storage().bucket(STORAGE_BUCKET);
  const deletedPosts = await deleteExpiredPostDocuments(db, bucket, RETENTION_DAYS);
  console.log(`Post retention cleanup finished: posts=${deletedPosts}, bucket=${STORAGE_BUCKET}`);
  return { deletedPosts, bucket: STORAGE_BUCKET };
}

exports.runPostRetentionCleanup = runPostRetentionCleanup;

exports.cleanupExpiredPosts = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "Africa/Cairo",
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => runPostRetentionCleanup()
);
