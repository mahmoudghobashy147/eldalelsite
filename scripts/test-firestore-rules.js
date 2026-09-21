const fs = require("fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
} = require("firebase/firestore");

const PROJECT_ID = "demo-daleel-rules";

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });

  try {
    await testEnv.clearFirestore();

    // Seed authoritative fixtures without applying security rules.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "members", "admin1"), {
        uid: "admin1",
        name: "Admin",
        status: "approved",
        isAdmin: true,
        type: "engineer",
        plan: "vip",
      });
      await setDoc(doc(db, "members", "alice"), {
        uid: "alice",
        name: "Alice",
        status: "pending",
        type: "craftsman",
        plan: "starter",
      });
      await setDoc(doc(db, "members", "bob"), {
        uid: "bob",
        name: "Bob",
        status: "approved",
        type: "engineer",
        plan: "basic",
      });
      await setDoc(doc(db, "config", "appSettings"), {
        appName: "الدليل الشامل",
        maintenanceMode: false,
      });
    });

    const anon = testEnv.unauthenticatedContext().firestore();
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const admin = testEnv.authenticatedContext("admin1").firestore();
    const newbie = testEnv.authenticatedContext("newbie").firestore();

    // Public/member visibility.
    await assertSucceeds(getDoc(doc(anon, "members", "bob")));
    await assertFails(getDoc(doc(anon, "members", "alice")));
    await assertSucceeds(getDoc(doc(alice, "members", "alice")));
    await assertFails(getDoc(doc(bob, "members", "alice")));
    await assertSucceeds(getDoc(doc(admin, "members", "alice")));

    // New account can create only its own safe pending record.
    await assertSucceeds(setDoc(doc(newbie, "members", "newbie"), {
      uid: "newbie",
      name: "New User",
      status: "pending",
      type: "craftsman",
      plan: "starter",
    }));
    const attacker = testEnv.authenticatedContext("attacker").firestore();
    await assertFails(setDoc(doc(attacker, "members", "attacker"), {
      uid: "attacker",
      name: "Attacker",
      status: "approved",
      isAdmin: true,
      type: "craftsman",
      plan: "vip",
    }));

    // Owner edits normal profile fields, but cannot promote/approve self.
    await assertSucceeds(updateDoc(doc(alice, "members", "alice"), {
      name: "Alice Updated",
      specialty: "سباكة",
    }));
    await assertFails(updateDoc(doc(alice, "members", "alice"), { isAdmin: true }));
    await assertFails(updateDoc(doc(alice, "members", "alice"), { status: "approved" }));

    // Approved member cannot upgrade own paid plan.
    await assertFails(updateDoc(doc(bob, "members", "bob"), { plan: "vip" }));

    // Admin can approve and change plans.
    await assertSucceeds(updateDoc(doc(admin, "members", "alice"), {
      status: "approved",
      plan: "premium",
    }));

    // Payments/config are admin-only writes.
    await assertFails(addDoc(collection(alice, "payments"), {
      memberId: "alice",
      amount: 600,
      status: "success",
    }));
    await assertSucceeds(addDoc(collection(admin, "payments"), {
      memberId: "alice",
      amount: 250,
      status: "success",
    }));
    await assertSucceeds(getDoc(doc(anon, "config", "appSettings")));
    await assertFails(updateDoc(doc(alice, "config", "appSettings"), { maintenanceMode: true }));
    await assertSucceeds(updateDoc(doc(admin, "config", "appSettings"), { maintenanceMode: true }));

    // Visitor can submit a quick service request, but cannot read it back.
    const requestRef = doc(anon, "serviceRequests", "request1");
    await assertSucceeds(setDoc(requestRef, { text: "محتاج سباك في القاهرة" }));
    await assertFails(getDoc(requestRef));

    // Post ownership rules.
    await assertSucceeds(setDoc(doc(alice, "posts", "post1"), {
      authorId: "alice",
      content: "شغل جديد",
      likes: 0,
    }));
    await assertFails(deleteDoc(doc(bob, "posts", "post1")));
    await assertSucceeds(deleteDoc(doc(alice, "posts", "post1")));

    console.log("✅ Firestore behavioral security tests passed");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error("❌ Firestore behavioral security tests failed");
  console.error(err);
  process.exit(1);
});
