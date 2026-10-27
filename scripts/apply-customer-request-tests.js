const fs=require('fs');function edit(file,a,b){let s=fs.readFileSync(file,'utf8');if(s.includes(b))return;if(s.split(a).length!==2)throw Error('missing test anchor '+file);fs.writeFileSync(file,s.replace(a,b))}
edit('scripts/test-firestore-rules.js','    // ── Owner profile edits ──────────────────────────────────────',`    // Customer accounts cannot bypass their limited role to publish or upload work.
    await assertFails(setDoc(doc(customer, "posts", "customer-post"), {authorId:"customerTest",content:"no",images:[]}));
    await assertFails(updateDoc(doc(customer, "members", "customerTest"), {accountKind:"craftsman"}));
    await assertFails(updateDoc(doc(customer, "members", "customerTest"), {workPhotos:["image"]}));
    // ── Owner profile edits ──────────────────────────────────────`);
edit('scripts/test-storage-rules.js','    // ── Work photos / post media ────────────────────────────────',`    await testEnv.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),"members","customerTest"),{uid:"customerTest",accountKind:"customer"}));
    const customer = testEnv.authenticatedContext("customerTest").storage();
    await assertFails(uploadBytes(ref(customer,"workPhotos/customerTest/1.jpg"),image,{contentType:"image/jpeg"}));
    await assertFails(uploadBytes(ref(customer,"postImages/customerTest/1.jpg"),image,{contentType:"image/jpeg"}));
    await assertFails(uploadBytes(ref(customer,"postVideos/customerTest/1.mp4"),video,{contentType:"video/mp4"}));
    // ── Work photos / post media ────────────────────────────────`);
console.log('Customer restriction tests staged.');
