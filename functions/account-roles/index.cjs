'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https'),admin=require('firebase-admin');
const {convertAccount}=require('./policy.cjs');
exports.adminConvertMemberAccount=onCall({region:'us-central1',invoker:'public',maxInstances:5},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','سجّل الدخول أولًا');
 try{const actor=await admin.auth().getUser(request.auth.uid);if(actor.disabled)throw new HttpsError('permission-denied','الحساب موقوف');const result=await convertAccount(admin.firestore(),request.auth.uid,request.data,{timestamp:()=>admin.firestore.FieldValue.serverTimestamp()});return {...result,memberPatch:Object.fromEntries(Object.entries(result.memberPatch).filter(([key])=>['accountKind','type','plan','status'].includes(key)))};}
 catch(error){if(error instanceof HttpsError)throw error;if(['invalid-argument','permission-denied','failed-precondition','not-found'].includes(error.code))throw new HttpsError(error.code,error.message);throw new HttpsError('internal','تعذر تغيير نوع الحساب. لم يتم تأكيد العملية، حدّث القائمة وحاول مجددًا');}
});
