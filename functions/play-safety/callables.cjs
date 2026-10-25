'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
const {SafetyError}=require('./core.cjs');
const handlers=require('./handlers.cjs')(admin.firestore(),()=>admin.firestore.FieldValue.serverTimestamp());
for(const [name,handler] of Object.entries(handlers))exports[name]=onCall({region:'us-central1',invoker:'public'},async request=>{try{return await handler(request);}catch(e){if(e instanceof SafetyError)throw new HttpsError(e.code,e.message);throw new HttpsError('internal','تعذر إتمام الطلب. حاول مجددًا.');}});
