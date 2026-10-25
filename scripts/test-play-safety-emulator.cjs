'use strict';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator only; never execute against production');
const fs=require('node:fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc}=require('firebase/firestore');
const admin=require('../functions/node_modules/firebase-admin');
const makeHandlers=require('../functions/play-safety/handlers.cjs');
async function main(){
 const id='demo-daleel-rules';const env=await initializeTestEnvironment({projectId:id,firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 const app=admin.initializeApp({projectId:id},'play-safety-tests'),db=app.firestore(),h=makeHandlers(db,()=>admin.firestore.FieldValue.serverTimestamp());
 const req=(uid,data={})=>({auth:{uid,token:{auth_time:Date.now()/1000}},data});
 try{
 await env.clearFirestore();for(const name of ['alice','bob','eve','admin'])await db.doc(`members/${name}`).set({uid:name,name,status:'approved',isAdmin:name==='admin'});
 await db.doc('posts/safety-post').set({authorId:'alice',content:'original',images:[],likes:0,comments:0,shares:0});
 const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore(),eve=env.authenticatedContext('eve').firestore();
 await assertSucceeds(updateDoc(doc(alice,'posts','safety-post'),{content:'updated',images:['https://example.invalid/image.jpg']}));
 await assertFails(updateDoc(doc(bob,'posts','safety-post'),{content:'hijacked'}));
 await assertFails(updateDoc(doc(alice,'posts','safety-post'),{authorId:'bob'}));
 await assertFails(updateDoc(doc(alice,'posts','safety-post'),{content:''}));
 await assertFails(setDoc(doc(alice,'members','alice','blockedUsers','bob'),{active:true}));
 await assertFails(setDoc(doc(alice,'accountDeletionRequests','alice'),{status:'completed'}));
 await h.setSafetyBlock(req('alice',{targetId:'bob',blocked:true}));
 await assert.rejects(h.sendSafetyMessage(req('alice',{targetId:'bob',message:'blocked'})),{code:'permission-denied'});
 await assert.rejects(h.sendSafetyMessage(req('bob',{targetId:'alice',message:'reverse blocked'})),{code:'permission-denied'});
 await assertFails(setDoc(doc(bob,'chats','alice_bob'),{users:['alice','bob'],lastMessage:'bypass'}));
 await assertFails(setDoc(doc(bob,'chats','alice_bob','messages','bypass'),{senderId:'bob',message:'bypass'}));
 await h.setSafetyBlock(req('alice',{targetId:'bob',blocked:false}));
 const sent=await h.sendSafetyMessage(req('alice',{targetId:'bob',message:'hello'}));
 await assertSucceeds(getDoc(doc(bob,'chats','alice_bob','messages',sent.id)));
 await assertFails(getDoc(doc(eve,'chats','alice_bob','messages',sent.id)));
 await assertFails(updateDoc(doc(bob,'chats','alice_bob'),{lastMessage:'bypass'}));
 const reports=await Promise.all(Array.from({length:5},()=>h.submitSafetyReport(req('bob',{targetType:'post',targetId:'safety-post',reason:'spam'}))));
 assert.equal(reports.filter(r=>!r.duplicate).length,1);
 const list=await db.collection('safetyReports').get();assert.equal(list.size,1);
 await assertFails(getDoc(doc(bob,'safetyReports',list.docs[0].id)));
 await assert.rejects(h.listSafetyModeration(req('bob',{isAdmin:true})),{code:'permission-denied'});
 assert.equal((await h.listSafetyModeration(req('admin'))).reports.length,1);
 await h.requestAccountDeletion(req('alice',{confirmation:'DELETE'}));
 assert.equal((await db.doc('members/alice').get()).exists,true);
 assert.equal((await h.getSafetyState(req('alice'))).deletion.status,'pending');
 console.log('PASS: emulator verifies post owner edits, direct-write rejection, mutual blocking, atomic messaging, concurrent report deduplication, private reports and pending deletion requests.');
 }finally{await env.cleanup();await app.delete();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
