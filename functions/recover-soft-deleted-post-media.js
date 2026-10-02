const { GoogleAuth } = require("google-auth-library");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "eldalel-elshamel";
const BUCKET = "eldalel-elshamel.firebasestorage.app";
const PREFIXES = [
  "posts/",
  "post-images/",
  "postImages/",
  "post-videos/",
  "postVideos/",
  "post_media/",
  "postMedia/",
  "uploads/posts/",
];
// التنظيف الذي حذف ملفات المنشورات اشتغل تقريبًا بين 07:01 و07:03 UTC.
const FROM = new Date(process.env.RECOVERY_MEDIA_FROM || "2026-10-02T07:00:00Z");
const TO = new Date(process.env.RECOVERY_MEDIA_TO || "2026-10-02T07:10:00Z");

async function accessToken() {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function storageFetch(url, options = {}) {
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

async function listSoftDeleted(prefix) {
  const results = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      softDeleted: "true",
      prefix,
      maxResults: "1000",
      projection: "noAcl",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const body = await storageFetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o?${params}`);
    results.push(...(body?.items || []));
    pageToken = body?.nextPageToken || "";
  } while (pageToken);
  return results;
}

function isFromCleanupWindow(obj) {
  const when = new Date(obj?.softDeleteTime || "");
  return Number.isFinite(when.getTime()) && when >= FROM && when <= TO;
}

async function restoreObject(obj) {
  const objectName = encodeURIComponent(obj.name);
  const params = new URLSearchParams({
    generation: String(obj.generation),
    ifGenerationMatch: "0",
  });
  if (obj.restoreToken) params.set("restoreToken", obj.restoreToken);
  try {
    await storageFetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o/${objectName}/restore?${params}`, {
      method: "POST",
    });
    return { status: "restored" };
  } catch (err) {
    // 412 هنا معناها إن فيه نسخة live بالفعل؛ ما نكتبش فوقها.
    if (err.status === 412) return { status: "already-live" };
    return { status: "failed", error: err.message };
  }
}

(async () => {
  console.log("Checking Cloud Storage soft-deleted post media", {
    bucket: BUCKET,
    from: FROM.toISOString(),
    to: TO.toISOString(),
  });

  let all = [];
  for (const prefix of PREFIXES) {
    try {
      const items = await listSoftDeleted(prefix);
      console.log(`Soft-deleted objects under ${prefix}: ${items.length}`);
      all.push(...items);
    } catch (err) {
      console.warn(`Could not list soft-deleted objects for ${prefix}:`, err.message);
    }
  }

  const unique = new Map();
  for (const obj of all) unique.set(`${obj.name}#${obj.generation}`, obj);
  const candidates = [...unique.values()].filter(isFromCleanupWindow);
  console.log("MEDIA_RECOVERY_CANDIDATES", candidates.length);

  let restored = 0;
  let alreadyLive = 0;
  const failures = [];

  for (const obj of candidates) {
    const result = await restoreObject(obj);
    if (result.status === "restored") {
      restored += 1;
      console.log("RESTORED_MEDIA", obj.name, obj.generation);
    } else if (result.status === "already-live") {
      alreadyLive += 1;
    } else {
      failures.push({ name: obj.name, generation: obj.generation, error: result.error });
      console.error("FAILED_MEDIA", obj.name, result.error);
    }
  }

  console.log("MEDIA_RECOVERY_SUMMARY", JSON.stringify({
    project: PROJECT_ID,
    bucket: BUCKET,
    candidates: candidates.length,
    restored,
    alreadyLive,
    failed: failures.length,
    failures,
  }, null, 2));
})();
