const fs=require('fs');
function patch(path,oldValue,newValue){let s=fs.readFileSync(path,'utf8');if(s.includes(newValue))return;const n=s.split(oldValue).length-1;if(n!==1)throw Error(`${path}: expected one anchor, got ${n}`);fs.writeFileSync(path,s.replace(oldValue,newValue));}
const fire='scripts/test-firestore-rules.js';
patch(fire,'    // ── Catalog owner approval workflow ──',`    // Subscription gate: owner needs an approved plan costing at least 600 EGP.
    await assertFails(setDoc(doc(alice, "catalogBusinessRequests", "alice"), { ownerId:"alice", name:"Alice store", status:"pending" }));
    await assertFails(setDoc(doc(bob, "catalogBusinessRequests", "bob"), { ownerId:"bob", name:"Bob store", status:"pending" }));
    await assertSucceeds(updateDoc(doc(admin, "members", "bob"), { plan:"vip" }));
    // ── Catalog owner approval workflow ──`);
patch(fire,'    // ── Catalog owner quick hide/show controls ──',`    // A downgraded owner cannot change the catalog; published products remain public.
    await assertSucceeds(updateDoc(doc(admin, "members", "bob"), { plan:"basic" }));
    await assertFails(updateDoc(doc(bob, "catalogBusinesses", "bob"), { description:"blocked", updatedAt:new Date() }));
    await assertFails(updateDoc(doc(bob, "catalogProducts", "bob-product-1"), { description:"blocked", updatedAt:new Date() }));
    await assertSucceeds(getDoc(doc(anon, "catalogProducts", "bob-product-1")));
    await assertSucceeds(updateDoc(doc(admin, "members", "bob"), { plan:"vip" }));
    // ── Catalog owner quick hide/show controls ──`);
const storage='scripts/test-storage-rules.js';
patch(storage,'        name: "Alice",\n        status: "approved",\n        isAdmin: false,','        name: "Alice",\n        status: "approved",\n        plan: "vip",\n        isAdmin: false,');
patch(storage,'    // ── Catalog owner media ──',`    // A lower-tier member cannot upload catalog media for their own store.
    await testEnv.withSecurityRulesDisabled(async (ctx)=>setDoc(doc(ctx.firestore(), "members", "bob"), {uid:"bob",status:"approved",plan:"basic"}));
    await assertFails(uploadBytes(ref(bob, "catalog/owners/bob/products/1/image.jpg"), image, {contentType:"image/jpeg"}));
    // ── Catalog owner media ──`);
console.log('Catalog subscription behavior tests staged.');
