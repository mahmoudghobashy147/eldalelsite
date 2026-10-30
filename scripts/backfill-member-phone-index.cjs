'use strict';
const admin=require('../functions/node_modules/firebase-admin');
const {normalizePhone}=require('../functions/phone-registration/policy.cjs');
if(!admin.apps.length)admin.initializeApp({projectId:'eldalel-elshamel'});
const db=admin.firestore();
async function main(){
 const execute=process.argv.includes('--execute');
 const snap=await db.collection('members').select('phone','phoneNormalized').get();
 const groups=new Map();let invalid=0;
 for(const doc of snap.docs){const phones=new Set([normalizePhone(doc.data().phoneNormalized),normalizePhone(doc.data().phone)].filter(Boolean));if(!phones.size){invalid++;continue;}for(const phone of phones){if(!groups.has(phone))groups.set(phone,new Set());groups.get(phone).add(doc.id);}}
 const entries=[...groups];const conflicts=entries.filter(([,owners])=>owners.size>1).length;
 if(execute){
  let next=0;
  async function worker(){
   while(next<entries.length){
    const [phone,owners]=entries[next++];const uid=owners.size===1?[...owners][0]:'';
    const ref=db.collection('memberPhoneIndex').doc(phone);
    await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists&&(old.data().blocked===true||old.data().uid===uid))return;const blocked=!uid||(old.exists&&old.data().uid!==uid);tx.set(ref,{uid:blocked?'':uid,...(blocked?{blocked:true}:{}),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true})});
   }
  }
  await Promise.all(Array.from({length:12},()=>worker()));
 }

 if(execute)await db.collection('config').doc('phoneRegistrationPolicy').set({legacyIndexReady:true,indexVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
 console.log(JSON.stringify({mode:execute?'applied':'read-only',members:snap.size,phoneKeys:groups.size,conflicts,invalidPhones:invalid,memberProfilesChanged:0}));
}
main().catch(error=>{console.error('Phone index preparation failed',{code:error.code||'unknown'});process.exitCode=1});
