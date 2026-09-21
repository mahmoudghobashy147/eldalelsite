const fs = require("fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where,
} = require("firebase/firestore");
const { ref, uploadBytes, deleteObject } = require("firebase/storage");

const PROJECT_ID = "demo-daleel-rules";
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
    storage: { rules: fs.readFileSync("storage.rules", "utf8") },
  });

  try {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "members", "admin1"), {
        uid: "admin1", name: "Admin", status: "approved", isAdmin: true,
      });
      await setDoc(doc(db, "members", "alice"), {
        uid: "alice", name: "Alice", status: "approved", isAdmin: false,
      });
      await setDoc(doc(db, "catalogCategories", "ceramic"), {
        name: "سيراميك وبورسلين", active: true,
      });
      await setDoc(doc(db, "catalogCategories", "draftCat"), {
        name: "مسودة", active: false,
      });
      await setDoc(doc(db, "catalogBusinesses", "store1"), {
        name: "متجر تجريبي", activityType: "محل", active: true,
      });
      await setDoc(doc(db, "catalogBusinesses", "draftStore"), {
        name: "متجر غير منشور", active: false,
      });
      await setDoc(doc(db, "catalogProducts", "product1"), {
        name: "سيراميك رمادي 60×60", categoryId: "ceramic", businessId: "store1", active: true,
      });
      await setDoc(doc(db, "catalogProducts", "draftProduct"), {
        name: "منتج مسودة", categoryId: "ceramic", businessId: "store1", active: false,
      });
      await setDoc(doc(db, "catalogAttributes", "finish"), {
        name: "التشطيب", key: "finish", values: "مطفي,لامع", active: true, filterable: true,
      });
      await setDoc(doc(db, "catalogAttributes", "hiddenAttr"), {
        name: "خاصية مخفية", key: "hidden", active: false,
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const adminDb = testEnv.authenticatedContext("admin1").firestore();

    // Public reads: active catalog content is visible; inactive drafts are private.
    await assertSucceeds(getDoc(doc(anonDb, "catalogCategories", "ceramic")));
    await assertFails(getDoc(doc(anonDb, "catalogCategories", "draftCat")));
    await assertSucceeds(getDoc(doc(anonDb, "catalogBusinesses", "store1")));
    await assertFails(getDoc(doc(anonDb, "catalogBusinesses", "draftStore")));
    await assertSucceeds(getDoc(doc(anonDb, "catalogProducts", "product1")));
    await assertFails(getDoc(doc(anonDb, "catalogProducts", "draftProduct")));
    await assertSucceeds(getDoc(doc(anonDb, "catalogAttributes", "finish")));
    await assertFails(getDoc(doc(anonDb, "catalogAttributes", "hiddenAttr")));

    // Public list queries must explicitly filter active records, matching the app queries.
    await assertSucceeds(getDocs(query(collection(anonDb, "catalogProducts"), where("active", "==", true))));
    await assertSucceeds(getDocs(query(collection(anonDb, "catalogBusinesses"), where("active", "==", true))));
    await assertFails(getDocs(collection(anonDb, "catalogProducts")));

    // Normal users cannot manufacture or alter catalog content.
    await assertFails(setDoc(doc(aliceDb, "catalogProducts", "fake"), {
      name: "منتج مزيف", active: true,
    }));
    await assertFails(updateDoc(doc(aliceDb, "catalogProducts", "product1"), { name: "تم الاختراق" }));
    await assertFails(deleteDoc(doc(aliceDb, "catalogBusinesses", "store1")));

    // Admin has complete catalog management access, including drafts.
    await assertSucceeds(getDoc(doc(adminDb, "catalogProducts", "draftProduct")));
    await assertSucceeds(getDocs(collection(adminDb, "catalogProducts")));
    await assertSucceeds(setDoc(doc(adminDb, "catalogProducts", "adminProduct"), {
      name: "منتج إدارة", active: true,
    }));
    await assertSucceeds(updateDoc(doc(adminDb, "catalogProducts", "adminProduct"), { active: false }));
    await assertSucceeds(deleteDoc(doc(adminDb, "catalogProducts", "adminProduct")));

    const anonStorage = testEnv.unauthenticatedContext().storage();
    const aliceStorage = testEnv.authenticatedContext("alice").storage();
    const adminStorage = testEnv.authenticatedContext("admin1").storage();

    // Catalog media is admin-managed only.
    await assertSucceeds(uploadBytes(ref(adminStorage, "catalog/businesses/store1/logo.jpg"), image, { contentType: "image/jpeg" }));
    await assertSucceeds(uploadBytes(ref(adminStorage, "catalog/products/product1/main.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(aliceStorage, "catalog/businesses/store1/fake.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(anonStorage, "catalog/products/product1/fake.jpg"), image, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(adminStorage, "catalog/products/product1/not-image.txt"), image, { contentType: "text/plain" }));
    await assertFails(deleteObject(ref(aliceStorage, "catalog/businesses/store1/logo.jpg")));
    await assertSucceeds(deleteObject(ref(adminStorage, "catalog/businesses/store1/logo.jpg")));

    console.log("✅ Catalog Firestore and Storage security tests passed");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error("❌ Catalog security tests failed");
  console.error(err);
  process.exit(1);
});
