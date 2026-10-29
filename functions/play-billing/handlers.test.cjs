const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const {accountId,hash}=require('./policy.cjs');
function harness(){
 const rows=new Map([['members/alice',{accountKind:'subscriber',status:'pending'}],['members/bob',{accountKind:'subscriber',status:'pending'}]]);
 let acknowledgements=0;
 let purchase={subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',startTime:new Date().toISOString(),externalAccountIdentifiers:{obfuscatedExternalAccountId:accountId('alice')},acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:'eldalel_basic_annual',prepaidPlan:{},offerDetails:{basePlanId:'annual-prepaid'},expiryTime:new Date(Date.now()+86400000).toISOString()}]};
 const ref=path=>({path,get:async()=>snap(path)}),snap=path=>({exists:rows.has(path),data:()=>rows.get(path)});
 const db={collection:name=>({doc:id=>ref(name+'/'+id)}),runTransaction:async fn=>{const changes=[];await fn({get:async r=>snap(r.path),set:(r,d)=>changes.push([r.path,{...rows.get(r.path),...d}]),update:(r,d)=>changes.push([r.path,{...rows.get(r.path),...d}])});changes.forEach(([k,v])=>rows.set(k,v))}};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
 const context={exports:{},console,require:name=>{
 if(name==='firebase-functions/v2/https')return {onCall:fn=>fn,HttpsError};
 if(name==='firebase-functions/v2/pubsub')return {onMessagePublished:(_,fn)=>fn};
 if(name==='firebase-functions/v2/scheduler')return {onSchedule:(_,fn)=>fn};
 if(name==='firebase-admin'){const firestore=()=>db;firestore.Timestamp={fromMillis:n=>({toMillis:()=>n}),fromDate:d=>({toMillis:()=>+d})};firestore.FieldValue={serverTimestamp:()=>Date.now()};return {firestore}}
 if(name==='google-auth-library')return {GoogleAuth:class{async getClient(){return {request:async options=>{if(options.method==='POST'){acknowledgements++;return {data:{}}}return {data:purchase}}}}}};
 if(name==='./policy.cjs')return require('./policy.cjs');throw Error(name);
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('./index.cjs'),'utf8'),context);
 return {rows,api:context.exports,setPurchase:p=>{purchase=p},getPurchase:()=>purchase,acks:()=>acknowledgements};
}
const request=(uid='alice')=>({auth:{uid},data:{purchaseToken:'valid-purchase-token-123'}});
test('unauthenticated verification rejected',async()=>{const h=harness();await assert.rejects(h.api.verifyPlayPurchase({data:{}}),{code:'unauthenticated'})});
test('wrong account never gets activated',async()=>{const h=harness();await assert.rejects(h.api.verifyPlayPurchase(request('bob')),{code:'permission-denied'});assert.equal(h.rows.get('members/bob').status,'pending')});
test('retries never extend expiry or create duplicate ledger records',async()=>{const h=harness();await h.api.verifyPlayPurchase(request());const end=h.rows.get('members/alice').subscriptionEnd.toMillis();await h.api.verifyPlayPurchase(request());assert.equal(h.rows.get('members/alice').subscriptionEnd.toMillis(),end);assert.equal([...h.rows.keys()].filter(k=>k.startsWith('playPurchases/')).length,1)});
test('pending purchase is recorded but not granted or acknowledged',async()=>{const h=harness();h.getPurchase().subscriptionState='SUBSCRIPTION_STATE_PENDING';await h.api.verifyPlayPurchase(request());assert.equal(h.rows.get('members/alice').status,'pending');assert.equal(h.acks(),0)});
test('refunded/revoked state removes only matching Play entitlement',async()=>{const h=harness();await h.api.verifyPlayPurchase(request());h.getPurchase().subscriptionState='SUBSCRIPTION_STATE_EXPIRED';await h.api.verifyPlayPurchase(request());assert.equal(h.rows.get('members/alice').status,'pending')});
test('stale expired Play token cannot remove newer manual entitlement',async()=>{const h=harness();await h.api.verifyPlayPurchase(request());h.rows.set('members/alice',{status:'approved',billingProvider:'manual',subscriptionEnd:{toMillis:()=>Date.now()+999999}});h.getPurchase().subscriptionState='SUBSCRIPTION_STATE_EXPIRED';await h.api.verifyPlayPurchase(request());assert.equal(h.rows.get('members/alice').status,'approved')});
test('active manual subscription cannot be overwritten by Play',async()=>{const h=harness();h.rows.set('members/alice',{status:'approved',subscriptionEnd:{toMillis:()=>Date.now()+999999}});await assert.rejects(h.api.verifyPlayPurchase(request()),{code:'failed-precondition'});assert.equal(h.acks(),0)});
test('token ledger prevents reassignment even if Google response owner changed',async()=>{const h=harness();await h.api.verifyPlayPurchase(request());h.getPurchase().externalAccountIdentifiers.obfuscatedExternalAccountId=accountId('bob');await assert.rejects(h.api.verifyPlayPurchase(request('bob')),{code:'permission-denied'});assert.equal(h.rows.get('playPurchases/'+hash(request().data.purchaseToken)).uid,'alice')});
