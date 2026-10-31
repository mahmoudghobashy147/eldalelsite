'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
for(const name of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])if(!process.env[name])throw Error('Emulator only');
if(process.env.GCLOUD_PROJECT!=='demo-daleel-deletion')throw Error('Demo project only');
const admin=require('../functions/node_modules/firebase-admin');
admin.initializeApp({projectId:'demo-daleel-deletion',storageBucket:'demo-daleel-deletion.firebasestorage.app'});
const {run}=require('./fulfill-account-deletion.cjs');
async function main(){
 const db=admin.firestore(),auth=admin.auth(),bucket=admin.storage().bucket(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'deletion-test-'));
 await auth.createUser({uid:'deletion-alice',disabled:true});await auth.createUser({uid:'deletion-bob'});
 const docs={
  'members/deletion-alice':{name:'Synthetic Alice'},'members/deletion-bob':{name:'Synthetic Bob'},
  'accountDeletionRequests/deletion-alice':{uid:'deletion-alice',status:'processing',disabledAtMs:Date.now()-70*60000},
  'posts/mine':{authorId:'deletion-alice'},'posts/mine/comments/other':{authorId:'deletion-bob'},
  'posts/theirs':{authorId:'deletion-bob',likedBy:['deletion-alice','deletion-bob']},
  'posts/missing-parent/comments/orphan':{authorId:'deletion-alice'},
  'chats/test':{users:['deletion-alice','deletion-bob'],lastMessage:'Synthetic private preview'},
  'chats/test/messages/mine':{senderId:'deletion-alice',message:'Synthetic'},
  'chats/test/messages/theirs':{senderId:'deletion-bob',message:'Keep this'},
  'playPurchases/test':{uid:'deletion-alice'},'memberPhoneIndex/01000000001':{uid:'deletion-alice'}
 };
 for(const [key,value] of Object.entries(docs))await db.doc(key).set(value);
 await bucket.file('avatars/deletion-alice').save('synthetic-avatar',{contentType:'text/plain'});
 await bucket.file('avatars/deletion-bob').save('keep-other-avatar',{contentType:'text/plain'});
 const file=path.join(dir,'plan.json');await run(['--uid','deletion-alice','--plan',file]);
 let plan=JSON.parse(fs.readFileSync(file));assert(plan.deletes.some(r=>r.path==='posts/missing-parent/comments/orphan'));assert.equal(plan.review.length,0);
 await assert.rejects(run(['--uid','deletion-alice','--mode','execute','--plan',file,'--confirm','deletion-bob','--fingerprint',plan.fingerprint]),/confirmation/);
 assert((await db.doc('members/deletion-alice').get()).exists);
 await run(['--uid','deletion-alice','--mode','execute','--plan',file,'--confirm','deletion-alice','--fingerprint',plan.fingerprint]);
 for(const key of ['members/deletion-alice','posts/mine','posts/mine/comments/other','posts/missing-parent/comments/orphan','chats/test/messages/mine','playPurchases/test','accountDeletionRequests/deletion-alice'])assert(!(await db.doc(key).get()).exists,key);
 assert((await db.doc('members/deletion-bob').get()).exists);assert((await db.doc('chats/test/messages/theirs').get()).exists);
 assert.deepEqual((await db.doc('posts/theirs').get()).data().likedBy,['deletion-bob']);
 assert.deepEqual((await db.doc('chats/test').get()).data().users,['deletion-bob']);
 assert(!(await bucket.file('avatars/deletion-alice').exists())[0]);assert((await bucket.file('avatars/deletion-bob').exists())[0]);
 await assert.rejects(auth.getUser('deletion-alice'),{code:'auth/user-not-found'});assert((await auth.getUser('deletion-bob')).uid);
 fs.rmSync(dir,{recursive:true});console.log('PASS: deletion completed in Auth, Firestore and Storage emulators; other account and messages preserved.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
