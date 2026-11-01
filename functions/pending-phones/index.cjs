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
exports.listPendingPhones=onCall({region:'us-central1',invoker:'public',maxInstances:5,concurrency:20},async request=>{
 const {uid,role}=await access(request);
 let last='';if(request.data?.cursor){try{last=policy.unseal(request.data.cursor,role.cursorKey,uid)}catch{throw new HttpsError('invalid-argument','انتهت صلاحية الصفحة. افتح القائمة من جديد');}}
 const phones=[],seen=new Set();let exhausted=false;
 // Bounded server-only projection: no customer documents, IDs, names or billing data leave this function.
 for(let batch=0;batch<3&&phones.length<30;batch++){
  let q=db.collection('members').orderBy(admin.firestore.FieldPath.documentId()).select('phone','phoneNormalized','status','accountKind','type','plan','isAdmin').limit(150);
  if(last)q=q.startAfter(last);
  const snap=await q.get();if(snap.empty){exhausted=true;break;}
  let consumed=0;
  for(const doc of snap.docs){last=doc.id;consumed++;const phone=policy.phoneOnly(doc.data());if(phone&&!seen.has(phone)){seen.add(phone);phones.push(phone);}if(phones.length===30)break;}
  if(consumed===snap.size&&snap.size<150){exhausted=true;break;}
 }
 // Revocation racing a page fetch must prevent disclosing that page.
 const current=await db.doc(`staffPermissions/${uid}`).get();
 if(!policy.permitted(current.data())||current.data().cursorKey!==role.cursorKey)throw new HttpsError('permission-denied','انتهت صلاحية العرض');
 return {phones,nextCursor:exhausted?null:policy.seal(last,role.cursorKey,uid)};
});
