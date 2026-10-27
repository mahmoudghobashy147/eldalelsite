const fs=require('fs');function edit(file,a,b){let s=fs.readFileSync(file,'utf8');if(s.includes(b))return;if(s.split(a).length!==2)throw Error('Test anchor missing '+file);fs.writeFileSync(file,s.replace(a,b))}
edit('scripts/test-firestore-rules.js','    // ── Owner profile edits ──────────────────────────────────────',`    // Incomplete and unpaid professional members cannot publish work, even after choosing a paid plan.
    await assertFails(setDoc(doc(alice,"posts","pending-post"),{authorId:"alice",content:"unpaid",images:[]}));
    await assertFails(updateDoc(doc(alice,"members","alice"),{workPhotos:["image"]}));
    await assertSucceeds(updateDoc(doc(alice,"members","alice"),{plan:"vip"}));
    await assertFails(setDoc(doc(alice,"posts","pending-post"),{authorId:"alice",content:"unpaid",images:[]}));
    await assertFails(updateDoc(doc(alice,"members","alice"),{status:"approved"}));
    // ── Owner profile edits ──────────────────────────────────────`);
edit('scripts/test-storage-rules.js','    // ── Work photos / post media ────────────────────────────────',`    await testEnv.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),"members","pendingTest"),{uid:"pendingTest",status:"pending",plan:"vip"}));
    const pending=testEnv.authenticatedContext("pendingTest").storage();
    await assertFails(uploadBytes(ref(pending,"workPhotos/pendingTest/1.jpg"),image,{contentType:"image/jpeg"}));
    await assertFails(uploadBytes(ref(pending,"postImages/pendingTest/1.jpg"),image,{contentType:"image/jpeg"}));
    await assertFails(uploadBytes(ref(pending,"postVideos/pendingTest/1.mp4"),video,{contentType:"video/mp4"}));
    // ── Work photos / post media ────────────────────────────────`);
console.log('Unpaid professional security tests staged.');
