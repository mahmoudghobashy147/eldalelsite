const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');const crypto=require('node:crypto');
const policy=require('./policy.cjs');
const db=admin.firestore();
async function limitRequests(request){
 const ip=String(request.rawRequest?.ip||'unknown');
 const key=crypto.createHash('sha256').update(ip).digest('hex');
 const ref=db.collection('registrationAttempts').doc(key),now=Date.now();
 await db.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.data()||{};const same=now-Number(old.startMs||0)<3600000;const count=same?Number(old.count||0):0;if(count>=60)throw new HttpsError('resource-exhausted','محاولات تسجيل كثيرة. حاول لاحقًا');tx.set(ref,{startMs:same?old.startMs:now,count:count+1,expiresAt:admin.firestore.Timestamp.fromMillis(now+86400000)})});
}
function safeError(error){if(error instanceof HttpsError)return error;if(['already-exists','invalid-argument','permission-denied'].includes(error.code))return new HttpsError(error.code,error.message);return new HttpsError('unavailable','تعذر إكمال التسجيل. حاول مرة أخرى');}
exports.assertMemberPhoneAvailable=onCall({invoker:'public'},async request=>{try{await limitRequests(request);return await policy.assertAvailable(db,request.data?.phone)}catch(e){throw safeError(e)}});
exports.completeMemberRegistration=onCall({invoker:'public'},async request=>{if(!request.auth?.uid)throw new HttpsError('unauthenticated','سجّل الدخول لإكمال التسجيل');try{await limitRequests(request);return await policy.completeRegistration(db,request.auth.uid,request.auth.token.email,request.data)}catch(e){throw safeError(e)}});

// Preserve compatibility with already distributed clients that create a canonical profile.
exports.indexMemberPhone=require('firebase-functions/v2/firestore').onDocumentCreated('members/{uid}',async event=>{
 const member=event.data?.data();if(!member)return;
 const phone=policy.normalizePhone(member.phoneNormalized)||policy.normalizePhone(member.phone);if(!phone)return;
 const ref=db.collection('memberPhoneIndex').doc(policy.phoneKey(phone));
 await db.runTransaction(async tx=>{
  const old=await tx.get(ref);
  if(old.exists){if(old.data().uid===event.params.uid||old.data().blocked===true)return;tx.set(ref,{uid:'',blocked:true,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});return;}
  tx.create(ref,{uid:event.params.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});
 });
});
