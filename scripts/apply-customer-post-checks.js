const fs=require('fs');
const file='scripts/test-firestore-rules.js';let s=fs.readFileSync(file,'utf8');
function patch(a,b){if(s.includes(b))return;if(s.split(a).length!==2)throw new Error('Test anchor missing');s=s.replace(a,b)}
patch('    // ── Owner profile edits ──────────────────────────────────────',`    // A customer can create the exact minimal registration record, but cannot approve it.
    const customer = testEnv.authenticatedContext("customerTest").firestore();
    await assertSucceeds(setDoc(doc(customer, "members", "customerTest"), {
      name:"عميل تجريبي", phone:"01000000000", phoneNormalized:"01000000000",
      type:"customer", accountKind:"customer", plan:"starter", uid:"customerTest",
      createdAt:new Date(), views:0, calls:0, waMessages:0, saves:0, rating:0, reviews:0,
    }));
    await assertSucceeds(getDoc(doc(customer, "members", "customerTest")));
    await assertFails(getDoc(doc(anon, "members", "customerTest")));
    await assertFails(updateDoc(doc(customer, "members", "customerTest"), {status:"approved", isAdmin:true}));

    // ── Owner profile edits ──────────────────────────────────────`);
patch('      authorId: "alice", content: "شغل جديد", likes: 0,','      authorId: "alice", content: "شغل جديد", images: [], likes: 0,');
patch('    await assertFails(updateDoc(doc(bob, "posts", "post1"), { content: "hacked" }));',`    await assertSucceeds(updateDoc(doc(alice, "posts", "post1"), { content: "تعديل صاحب المنشور" }));
    await assertFails(updateDoc(doc(bob, "posts", "post1"), { content: "hacked" }));`);
fs.writeFileSync(file,s);console.log('Customer registration and post ownership checks staged.');
