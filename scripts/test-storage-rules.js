const fs = require("fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc } = require("firebase/firestore");
const { ref, uploadBytes, deleteObject } = require("firebase/storage");

const PROJECT_ID = "demo-daleel-rules";

const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const video = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112]);

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
    storage: { rules: fs.readFileSync("storage.rules", "utf8") },
  });

  try {
    await testEnv.clearStorage();

    // Storage Rules isAdmin() reads the Firestore member document, so seed a real
    // admin identity in the emulator without applying client rules to fixture setup.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "members", "admin1"), {
        uid: "admin1",
        name: "Admin",
        status: "approved",
        isAdmin: true,
      });
      await setDoc(doc(ctx.firestore(), "members", "alice"), {
        uid: "alice",
        name: "Alice",
        status: "approved",
        isAdmin: false,
      });
    });

    const anon = testEnv.unauthenticatedContext().storage();
    const alice = testEnv.authenticatedContext("alice").storage();
    const bob = testEnv.authenticatedContext("bob").storage();
    const admin = testEnv.authenticatedContext("admin1").storage();

    // ── Avatar / cover ownership ────────────────────────────────
    await assertSucceeds(uploadBytes(ref(alice, "avatars/alice"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(bob, "avatars/alice"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(anon, "avatars/anon"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(alice, "avatars/alice"), image, { contentType: "text/plain" }));

    await assertSucceeds(uploadBytes(ref(alice, "covers/alice"), image, { contentType: "image/png" }));
    await assertSucceeds(uploadBytes(ref(alice, "covers/alice_12345"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(bob, "covers/alice_12345"), image, { contentType: "image/jpeg" }));

    // ── Work photos / post media ────────────────────────────────
    await assertSucceeds(uploadBytes(ref(alice, "workPhotos/alice/1.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(bob, "workPhotos/alice/2.jpg"), image, { contentType: "image/jpeg" }));

    await assertSucceeds(uploadBytes(ref(alice, "postImages/alice/1.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(bob, "postImages/alice/2.jpg"), image, { contentType: "image/jpeg" }));

    await assertSucceeds(uploadBytes(ref(alice, "postVideos/alice/1.mp4"), video, { contentType: "video/mp4" }));
    await assertFails(uploadBytes(ref(alice, "postVideos/alice/not-video.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(bob, "postVideos/alice/2.mp4"), video, { contentType: "video/mp4" }));

    // ── Admin-only advertising assets ───────────────────────────
    await assertSucceeds(uploadBytes(ref(admin, "ads/banner.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(alice, "ads/fake.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(anon, "ads/anon.jpg"), image, { contentType: "image/jpeg" }));

    // Unknown paths stay closed.
    await assertFails(uploadBytes(ref(alice, "unknown/alice/file.jpg"), image, { contentType: "image/jpeg" }));

    // Owner can remove their own media; another member cannot remove it.
    await assertFails(deleteObject(ref(bob, "workPhotos/alice/1.jpg")));
    await assertSucceeds(deleteObject(ref(alice, "workPhotos/alice/1.jpg")));

    console.log("✅ Storage behavioral security tests passed");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error("❌ Storage behavioral security tests failed");
  console.error(err);
  process.exit(1);
});
