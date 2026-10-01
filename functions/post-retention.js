const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const RETENTION_DAYS = 30;
const POST_STORAGE_PREFIXES = [
  "posts/",
  "post-images/",
  "postImages/",
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

async function deleteExpiredPostDocuments(db, bucket, days = RETENTION_DAYS) {
  const cutoff = cutoffTimestamp(days);
  let deletedPosts = 0;

  while (true) {
    const snap = await db.collection("posts")
      .where("createdAt", "<=", cutoff)
      .limit(100)
      .get();

    if (snap.empty) break;

    for (const doc of snap.docs) {
      await deleteStorageForPost(bucket, doc.id, doc.data()).catch((err) => {
        console.error("deleteStorageForPost", doc.id, err);
      });
      await db.recursiveDelete(doc.ref);
      deletedPosts += 1;
    }
  }

  return deletedPosts;
}

async function deleteExpiredOrphanPostMedia(bucket, days = RETENTION_DAYS) {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  let deletedFiles = 0;

  for (const prefix of POST_STORAGE_PREFIXES) {
    let pageToken;
    do {
      const [files, , apiResponse] = await bucket.getFiles({
        prefix,
        autoPaginate: false,
        maxResults: 500,
        pageToken,
      });

      for (const file of files) {
        const createdMs = Date.parse(file.metadata.timeCreated || file.metadata.updated || "");
        if (Number.isFinite(createdMs) && createdMs <= cutoffMs) {
          await file.delete({ ignoreNotFound: true }).catch((err) => {
            console.error("delete orphan media", file.name, err);
          });
          deletedFiles += 1;
        }
      }

      pageToken = apiResponse?.nextPageToken;
    } while (pageToken);
  }

  return deletedFiles;
}

async function runPostRetentionCleanup() {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const deletedPosts = await deleteExpiredPostDocuments(db, bucket, RETENTION_DAYS);
  const deletedFiles = await deleteExpiredOrphanPostMedia(bucket, RETENTION_DAYS);
  console.log(`Post retention cleanup finished: posts=${deletedPosts}, files=${deletedFiles}`);
  return { deletedPosts, deletedFiles };
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
