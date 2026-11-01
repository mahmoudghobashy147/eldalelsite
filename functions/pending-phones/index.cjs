'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');const policy=require('./policy.cjs');
const db=admin.firestore();
async function access(request){
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','سجّل الدخول أولًا');
 const uid=request.auth.uid;
 const [role,member,user]=await Promise.all([db.doc(`staffPermissions/${uid}`).get(),db.doc(`members/${uid}`).get(),admin.auth().getUser(uid)]);
 if(!member.exists||user.disabled||!policy.permitted(role.data()))throw new HttpsError('permission-denied','الحساب لا يملك صلاحية عرض هذه الأرقام');
 return {uid,role:role.data()};
}
exports.getPendingPhoneAccess=onCall({region:'us-central1',invoker:'public'},async request=>{
 try{await access(request);return {allowed:true};}catch(e){if(['permission-denied','auth/user-not-found'].includes(e.code))return {allowed:false};throw e;}
});
async function listPending(request,details=false){
 const {uid,role}=await access(request);
 let last='';if(request.data?.cursor){try{last=policy.unseal(request.data.cursor,role.cursorKey,uid)}catch{throw new HttpsError('invalid-argument','انتهت صلاحية الصفحة. افتح القائمة من جديد');}}
 const phones=[],members=[],seen=new Set();let exhausted=false;
 // Bounded server-only projection. Details add only the authorized name and profession; no IDs or billing data.
 for(let batch=0;batch<3&&phones.length<30;batch++){
  const fields=['phone','phoneNormalized','status','accountKind','type','plan','isAdmin'];if(details)fields.push('name','specialty');
  let q=db.collection('members').orderBy(admin.firestore.FieldPath.documentId()).select(...fields).limit(150);
  if(last)q=q.startAfter(last);
  const snap=await q.get();if(snap.empty){exhausted=true;break;}
  let consumed=0;
  for(const doc of snap.docs){last=doc.id;consumed++;const phone=policy.phoneOnly(doc.data());if(phone&&!seen.has(phone)){seen.add(phone);phones.push(phone);if(details)members.push(policy.memberSummary(doc.data()));}if(phones.length===30)break;}
  if(consumed===snap.size&&snap.size<150){exhausted=true;break;}
 }
 // Revocation racing a page fetch must prevent disclosing that page.
 const current=await db.doc(`staffPermissions/${uid}`).get();
 if(!policy.permitted(current.data())||current.data().cursorKey!==role.cursorKey)throw new HttpsError('permission-denied','انتهت صلاحية العرض');
 const nextCursor=exhausted?null:policy.seal(last,role.cursorKey,uid);
 return details?{members,nextCursor}:{phones,nextCursor};
}
const options={region:'us-central1',invoker:'public',maxInstances:5,concurrency:20};
// Retain the published phone-only endpoint for old website sessions.
exports.listPendingPhones=onCall(options,request=>listPending(request,false));
exports.listPendingMembers=onCall(options,request=>listPending(request,true));
