'use strict';
// Only a trusted release operator can run this script. The target is encrypted for
// the existing deployment identity so contact details never enter source or logs.
const fs=require('node:fs'),crypto=require('node:crypto');
const admin=require('../functions/node_modules/firebase-admin');
const {normalizePhone}=require('../functions/phone-registration/policy.cjs');
async function main(){
 const credentials=JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
 if(credentials.project_id!=='eldalel-elshamel')throw Error('Unexpected project');
 const encrypted=fs.readFileSync('.github/pending-staff-binding.enc','utf8').trim();
 const payload=JSON.parse(crypto.privateDecrypt({key:credentials.private_key,oaepHash:'sha256'},Buffer.from(encrypted,'base64')).toString());
 const phone=normalizePhone(payload.phone);
 if(!phone||payload.capability!=='pendingPhoneViewer'||!Number.isFinite(payload.expiresAt)||payload.expiresAt<Date.now())throw Error('Invalid or expired staff binding');
 admin.initializeApp({credential:admin.credential.cert(credentials),projectId:'eldalel-elshamel'});
 const db=admin.firestore();
 const all=await db.collection('members').select('phone','phoneNormalized','isAdmin').get();
 const matches=all.docs.filter(d=>normalizePhone(d.data().phone)===phone||normalizePhone(d.data().phoneNormalized)===phone);
 if(matches.length!==1)throw Error('Staff binding requires exactly one matching registered account');
 const target=matches[0];const user=await admin.auth().getUser(target.id);
 if(user.disabled||user.email!==`${phone}@daleel.app`||target.data().isAdmin===true||user.customClaims?.admin===true||user.customClaims?.isAdmin===true)throw Error('Staff account identity or existing privilege check failed');
 const roleRef=db.doc(`staffPermissions/${target.id}`),old=await roleRef.get();
 if(old.exists&&Object.keys(old.data()).some(k=>!['active','pendingPhoneViewer','cursorKey','grantedAt','grantRevision'].includes(k)))throw Error('Unexpected existing staff capabilities; review required');
 console.log('Verified exactly one enabled registered account with matching sign-in identity. No contact details logged.');
 if(!process.argv.includes('--execute')){console.log('Read-only preflight passed; no permission changed.');return;}
 await db.runTransaction(async tx=>{
  const [current,role]=await Promise.all([tx.get(target.ref),tx.get(roleRef)]);
  if(!current.exists||!(normalizePhone(current.data().phone)===phone||normalizePhone(current.data().phoneNormalized)===phone)||current.data().isAdmin===true)throw Error('Account changed during binding');
  if(role.exists&&Object.keys(role.data()).some(k=>!['active','pendingPhoneViewer','cursorKey','grantedAt','grantRevision'].includes(k)))throw Error('Staff capabilities changed during binding');
  tx.set(roleRef,{active:true,pendingPhoneViewer:true,cursorKey:role.data()?.cursorKey||crypto.randomBytes(32).toString('hex'),grantedAt:role.data()?.grantedAt||admin.firestore.FieldValue.serverTimestamp(),grantRevision:'pending-phone-viewer-v1'});
 });
 const check=(await roleRef.get()).data();
 if(check.active!==true||check.pendingPhoneViewer!==true)throw Error('Staff binding verification failed');
 const handlers=require('../functions/pending-phones/index.cjs');
 const request={auth:{uid:target.id},data:{}};
 const allowed=await handlers.getPendingPhoneAccess.run(request);
 const result=await handlers.listPendingPhones.run(request);
 if(allowed.allowed!==true||!Array.isArray(result.phones)||Object.keys(result).some(k=>!['phones','nextCursor'].includes(k)))throw Error('Read-only capability failed verification');
 console.log('Authorized server read verified; phone values omitted from logs.');
 console.log('Granted and verified pending-phone read-only capability. Member profile, subscription and admin privileges unchanged.');
}
main().catch(()=>{console.error('Limited staff binding failed safely. No private identity details logged.');process.exitCode=1;});
