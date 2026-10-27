const fs=require('fs');function patch(a,b){let p='scripts/test-firestore-rules.js',s=fs.readFileSync(p,'utf8');if(s.includes(b))return;if(s.split(a).length!==2)throw Error('test anchor missing '+a.slice(0,80));fs.writeFileSync(p,s.replace(a,b))}
patch('    // ── Catalog owner approval workflow ──',`    // Reading the caller's absent request must not block first-time direct setup.
    await assertSucceeds(getDoc(doc(bob, "catalogBusinessRequests", "bob")));
    // ── Catalog owner approval workflow ──`);
patch(`    // A normal owner cannot create/approve their own business document.
    await assertFails(setDoc(doc(bob, "catalogBusinesses", "bob"), {
      ownerId: "bob", name: "Self Approved", active: true, approvalStatus: "approved", featured: false,
    }));`,`    // An eligible owner can publish their own catalog but cannot feature or forge ownership.
    await assertFails(setDoc(doc(bob, "catalogBusinesses", "other"), {ownerId:"bob",name:"Forged",activityType:"محل",governorate:"القاهرة",phones:"01000000000",active:true,approvalStatus:"approved",featured:false}));
    await assertFails(setDoc(doc(bob, "catalogBusinesses", "bob"), {ownerId:"bob",name:"Featured",activityType:"محل",governorate:"القاهرة",phones:"01000000000",active:true,approvalStatus:"approved",featured:true}));
    await assertFails(setDoc(doc(alice, "catalogBusinesses", "alice"), {ownerId:"alice",name:"Lower plan",activityType:"محل",governorate:"القاهرة",phones:"01000000000",active:true,approvalStatus:"approved",featured:false}));
    await assertSucceeds(setDoc(doc(bob, "catalogBusinesses", "bob"), {ownerId:"bob",name:"Direct",activityType:"محل",governorate:"القاهرة",phones:"01000000000",active:true,approvalStatus:"approved",featured:false}));
    await assertSucceeds(getDoc(doc(anon,"catalogBusinesses","bob")));`);
patch('      active: false, featured: false, approvalStatus: "pending", createdAt: new Date(), updatedAt: new Date(),','      active: true, featured: false, approvalStatus: "approved", createdAt: new Date(), updatedAt: new Date(),');
patch('    await assertFails(getDoc(doc(alice, "catalogProducts", "bob-product-1")));\n    await assertFails(getDoc(doc(anon, "catalogProducts", "bob-product-1")));','    await assertSucceeds(getDoc(doc(alice, "catalogProducts", "bob-product-1")));\n    await assertSucceeds(getDoc(doc(anon, "catalogProducts", "bob-product-1")));');
patch('      active: true, featured: false, approvalStatus: "approved",\n    }));\n    await assertFails(setDoc(doc(alice, "catalogProducts", "alice-forged-product")','      active: true, featured: true, approvalStatus: "approved",\n    }));\n    await assertFails(setDoc(doc(alice, "catalogProducts", "alice-forged-product")');
patch('    // A downgraded owner cannot change the catalog; published products remain public.',`    // An existing pending product can be published by its eligible owner; a rejected one cannot.
    await assertSucceeds(setDoc(doc(bob,"catalogProducts","old-client-pending"),{ownerId:"bob",businessId:"bob",name:"Old client",categoryId:"ceramic",active:false,featured:false,approvalStatus:"pending"}));
    await assertFails(getDoc(doc(anon,"catalogProducts","old-client-pending")));
    await assertSucceeds(setDoc(doc(admin,"catalogProducts","legacy-pending"),{ownerId:"bob",businessId:"bob",name:"Pending",categoryId:"ceramic",active:false,featured:false,approvalStatus:"pending"}));
    await assertSucceeds(updateDoc(doc(bob,"catalogProducts","legacy-pending"),{approvalStatus:"approved",active:true,updatedAt:new Date()}));
    await assertSucceeds(getDoc(doc(anon,"catalogProducts","legacy-pending")));
    await assertSucceeds(setDoc(doc(admin,"catalogProducts","blocked-product"),{ownerId:"bob",businessId:"bob",name:"Blocked",categoryId:"ceramic",active:false,featured:false,approvalStatus:"rejected"}));
    await assertFails(updateDoc(doc(bob,"catalogProducts","blocked-product"),{approvalStatus:"pending",active:false,updatedAt:new Date()}));
    // A downgraded owner cannot change the catalog; published products remain public.`);
console.log('Direct publishing behavior tests staged.');
const verifyFile='scripts/verify-catalog-owner-portal.js';let v=fs.readFileSync(verifyFile,'utf8');
for(const [a,b] of [
["must(owner.includes('إرسال طلب الإضافة'), 'owner request flow missing');","must(owner.includes('نشر النشاط'), 'direct catalog publishing action missing');"],
["must(owner.includes('approvalStatus:\"pending\"'), 'new products are not forced into pending state');","must(owner.includes('approvalStatus:\"approved\",active:true,featured:false'), 'direct product publishing missing');"],
["must(firestore.includes(\"request.resource.data.approvalStatus == 'pending'\"), 'pending-product security rule missing');","must(firestore.includes(\"request.resource.data.approvalStatus == 'approved'\"), 'direct publishing security rule missing');"]]){if(v.includes(b))continue;if(v.split(a).length!==2)throw Error('verify anchor missing');v=v.replace(a,b)}fs.writeFileSync(verifyFile,v);
