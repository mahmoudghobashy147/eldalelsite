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
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
  });

  try {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "members", "admin1"), {
        uid: "admin1", name: "Admin", status: "approved", isAdmin: true,
        type: "engineer", plan: "vip", views: 0, calls: 0, waMessages: 0,
        saves: 0, followersCount: 0, rating: 0, reviews: 0,
      });
      await setDoc(doc(db, "members", "alice"), {
        uid: "alice", name: "Alice", status: "pending",
        type: "craftsman", plan: "starter", views: 0, calls: 0, waMessages: 0,
        saves: 0, followersCount: 0, rating: 0, reviews: 0,
      });
      await setDoc(doc(db, "members", "bob"), {
        uid: "bob", name: "Bob", status: "approved",
        type: "engineer", plan: "basic", views: 0, calls: 0, waMessages: 0,
        saves: 0, followersCount: 0, rating: 0, reviews: 0,
      });
      await setDoc(doc(db, "config", "appSettings"), {
        appName: "الدليل الشامل", maintenanceMode: false,
      });
      await setDoc(doc(db, "notifications", "broadcast1"), {
        recipientId: null, body: "عام", readBy: [],
      });
      await setDoc(doc(db, "notifications", "broadcastExisting"), {
        recipientId: null, body: "عام مقروء من بوب", readBy: ["bob"],
      });
      await setDoc(doc(db, "notifications", "bobOnly"), {
        recipientId: "bob", body: "خاص ببوب", read: false,
      });
    });

    const anon = testEnv.unauthenticatedContext().firestore();
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const admin = testEnv.authenticatedContext("admin1").firestore();
    const newbie = testEnv.authenticatedContext("newbie").firestore();
    const eve = testEnv.authenticatedContext("eve").firestore();

    // ── Member visibility ────────────────────────────────────────
    await assertSucceeds(getDoc(doc(anon, "members", "bob")));
    await assertFails(getDoc(doc(anon, "members", "alice")));
    await assertSucceeds(getDoc(doc(alice, "members", "alice")));
    await assertFails(getDoc(doc(bob, "members", "alice")));
    await assertSucceeds(getDoc(doc(admin, "members", "alice")));

    // ── Account creation / privilege escalation ─────────────────
    await assertSucceeds(setDoc(doc(newbie, "members", "newbie"), {
      uid: "newbie", name: "New User", status: "pending",
      type: "craftsman", plan: "starter",
    }));
    await assertFails(setDoc(doc(eve, "members", "eve"), {
      uid: "eve", name: "Eve", status: "approved", isAdmin: true,
      type: "craftsman", plan: "vip",
    }));
    await assertFails(setDoc(doc(eve, "members", "someoneElse"), {
      uid: "someoneElse", name: "Forged", status: "pending",
      type: "craftsman", plan: "starter",
    }));

    // ── Owner profile edits ──────────────────────────────────────
    await assertSucceeds(updateDoc(doc(alice, "members", "alice"), {
      name: "Alice Updated", specialty: "سباكة",
    }));
    await assertFails(updateDoc(doc(alice, "members", "alice"), { isAdmin: true }));
    await assertFails(updateDoc(doc(alice, "members", "alice"), { status: "approved" }));
    await assertFails(updateDoc(doc(alice, "members", "alice"), { createdAt: new Date() }));
    await assertFails(updateDoc(doc(alice, "members", "alice"), { views: 999 }));

    await assertSucceeds(updateDoc(doc(alice, "members", "alice"), { plan: "premium" }));
    await assertFails(updateDoc(doc(bob, "members", "bob"), { plan: "vip" }));

    // ── Shared engagement counters ───────────────────────────────
    await assertSucceeds(updateDoc(doc(anon, "members", "bob"), { views: 1 }));
    await assertFails(updateDoc(doc(anon, "members", "bob"), { views: 10 }));
    await assertSucceeds(updateDoc(doc(anon, "members", "bob"), { calls: 1 }));
    await assertSucceeds(updateDoc(doc(anon, "members", "bob"), { waMessages: 1 }));
    await assertFails(updateDoc(doc(anon, "members", "bob"), { name: "Hacked" }));

    await assertFails(updateDoc(doc(anon, "members", "bob"), { saves: 1 }));
    await assertSucceeds(updateDoc(doc(alice, "members", "bob"), { saves: 1 }));
    await assertFails(updateDoc(doc(alice, "members", "bob"), { saves: 9 }));
    await assertSucceeds(updateDoc(doc(alice, "members", "bob"), { followersCount: 1 }));
    await assertFails(updateDoc(doc(alice, "members", "bob"), { followersCount: -1 }));

    await assertSucceeds(updateDoc(doc(alice, "members", "bob"), { reviews: 1, rating: 5 }));
    await assertFails(updateDoc(doc(alice, "members", "bob"), { reviews: 3, rating: 5 }));
    await assertFails(updateDoc(doc(alice, "members", "bob"), { reviews: 2, rating: 9 }));
    await assertFails(updateDoc(doc(alice, "members", "bob"), { reviews: 2, rating: 4, status: "pending" }));

    await assertSucceeds(updateDoc(doc(admin, "members", "alice"), {
      status: "approved", plan: "premium",
    }));

    // ── Saved/followers subcollections ───────────────────────────
    await assertSucceeds(setDoc(doc(alice, "members", "alice", "saved", "bob"), {
      memberId: "bob", savedAt: new Date(),
    }));
    await assertFails(getDoc(doc(bob, "members", "alice", "saved", "bob")));
    await assertSucceeds(setDoc(doc(alice, "members", "bob", "followers", "alice"), {
      followerId: "alice", followedAt: new Date(),
    }));
    await assertFails(setDoc(doc(eve, "members", "bob", "followers", "alice"), {
      followerId: "alice", followedAt: new Date(),
    }));

    // ── Chats / first-message compatibility ─────────────────────
    await assertSucceeds(setDoc(doc(alice, "chats", "alice_bob"), {
      users: ["alice", "bob"], lastMessage: "", lastTime: new Date(), updatedAt: new Date(),
    }));
    await assertSucceeds(addDoc(collection(alice, "chats", "alice_bob", "messages"), {
      senderId: "alice", senderName: "Alice", message: "Hello", time: new Date(), read: false,
    }));
    await assertSucceeds(getDoc(doc(bob, "chats", "alice_bob")));
    await assertFails(getDoc(doc(eve, "chats", "alice_bob")));
    await assertFails(addDoc(collection(eve, "chats", "alice_bob", "messages"), {
      senderId: "eve", senderName: "Eve", message: "Intrusion", time: new Date(), read: false,
    }));
    await assertFails(updateDoc(doc(alice, "chats", "alice_bob"), {
      users: ["alice", "eve"],
    }));
    await assertSucceeds(updateDoc(doc(bob, "chats", "alice_bob"), {
      lastMessage: "Reply", lastTime: new Date(), updatedAt: new Date(),
    }));

    // ── Payments/config ──────────────────────────────────────────
    await assertFails(addDoc(collection(alice, "payments"), {
      memberId: "alice", amount: 600, status: "success",
    }));
    await assertSucceeds(addDoc(collection(admin, "payments"), {
      memberId: "alice", amount: 250, status: "success",
    }));
    await assertSucceeds(getDoc(doc(anon, "config", "appSettings")));
    await assertFails(updateDoc(doc(alice, "config", "appSettings"), { maintenanceMode: true }));
    await assertSucceeds(updateDoc(doc(admin, "config", "appSettings"), { maintenanceMode: true }));

    // ── Notifications ────────────────────────────────────────────
    await assertSucceeds(getDoc(doc(bob, "notifications", "broadcast1")));
    await assertSucceeds(getDoc(doc(bob, "notifications", "bobOnly")));
    await assertFails(getDoc(doc(alice, "notifications", "bobOnly")));

    // Browser clients cannot manufacture personal notifications anymore.
    await assertFails(addDoc(collection(anon, "notifications"), {
      recipientId: "bob", body: "anon spam",
    }));
    await assertFails(addDoc(collection(alice, "notifications"), {
      recipientId: "bob", body: "signed-in spam",
    }));
    await assertSucceeds(addDoc(collection(admin, "notifications"), {
      recipientId: "bob", body: "admin message",
    }));

    // Recipient may mark personal notification read, but may not revert or edit payload.
    await assertSucceeds(updateDoc(doc(bob, "notifications", "bobOnly"), { read: true }));
    await assertFails(updateDoc(doc(bob, "notifications", "bobOnly"), { read: false }));
    await assertFails(updateDoc(doc(bob, "notifications", "bobOnly"), { body: "changed" }));

    // Broadcast readBy only permits appending the current user's uid, preserving all existing readers.
    await assertSucceeds(updateDoc(doc(alice, "notifications", "broadcast1"), { readBy: ["alice"] }));
    await assertSucceeds(updateDoc(doc(alice, "notifications", "broadcastExisting"), { readBy: ["bob", "alice"] }));
    await assertFails(updateDoc(doc(alice, "notifications", "broadcastExisting"), { readBy: ["alice"] }));
    await assertFails(updateDoc(doc(alice, "notifications", "broadcastExisting"), { readBy: ["bob", "eve", "alice"] }));

    // ── Service request ──────────────────────────────────────────
    const requestRef = doc(anon, "serviceRequests", "request1");
    await assertSucceeds(setDoc(requestRef, { text: "محتاج سباك في القاهرة" }));
    await assertFails(getDoc(requestRef));
    await assertSucceeds(getDoc(doc(admin, "serviceRequests", "request1")));

    // ── Posts ────────────────────────────────────────────────────
    await assertSucceeds(setDoc(doc(alice, "posts", "post1"), {
      authorId: "alice", content: "شغل جديد", likes: 0,
    }));
    await assertFails(updateDoc(doc(bob, "posts", "post1"), { content: "hacked" }));
    await assertSucceeds(updateDoc(doc(bob, "posts", "post1"), { likes: 1, likedBy: ["bob"] }));
    await assertFails(deleteDoc(doc(bob, "posts", "post1")));
    await assertSucceeds(deleteDoc(doc(alice, "posts", "post1")));

    // ── Jobs ─────────────────────────────────────────────────────
    await assertSucceeds(setDoc(doc(alice, "jobs", "job1"), {
      postedBy: "alice", title: "نجار", applicants: 0,
    }));
    await assertFails(setDoc(doc(bob, "jobs", "forgedJob"), {
      postedBy: "alice", title: "Fake", applicants: 0,
    }));
    await assertSucceeds(updateDoc(doc(bob, "jobs", "job1"), { applicants: 1 }));
    await assertFails(updateDoc(doc(bob, "jobs", "job1"), { applicants: 3 }));

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
