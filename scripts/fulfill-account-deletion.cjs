'use strict';
// Operator tool: default is a read-only private plan. No scheduled/bulk deletion.
const fs=require('node:fs'),path=require('node:path');
const admin=require('../functions/node_modules/firebase-admin');
const {identifier}=require('../functions/play-safety/core.cjs');
const {buildPlan,assertExecutable}=require('../functions/play-safety/deletion-plan.cjs');
const emulatorKeys=['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'];
const emulated=emulatorKeys.some(k=>process.env[k]);
if(emulated&&!emulatorKeys.every(k=>process.env[k]))throw Error('All three emulators are required; partial emulation is unsafe');
const PROJECT=emulated?'demo-daleel-deletion':'eldalel-elshamel',BUCKET=PROJECT+'.firebasestorage.app';
function args(argv){const result={};for(let i=0;i<argv.length;i++){const k=argv[i];if(!['--uid','--mode','--plan','--confirm','--fingerprint'].includes(k)||result[k]!==undefined||!argv[i+1])throw Error('Invalid arguments');result[k]=argv[++i];}return result;}
async function inventory(db,bucket){
 const records=[],queue=[...await db.listCollections()];
 // Collection reads and child discovery are bounded; no source doc is mutated.
 while(queue.length){
  const round=queue.splice(0,12);
  const results=await Promise.all(round.map(async collection=>{
   const refs=await collection.listDocuments(),children=[];
   for(let i=0;i<refs.length;i+=12){const group=refs.slice(i,i+12),snapshots=await db.getAll(...group);
    for(const doc of snapshots)if(doc.exists)records.push({path:doc.ref.path,version:{seconds:doc.updateTime.seconds,nanoseconds:doc.updateTime.nanoseconds},data:doc.data()});
    children.push(...(await Promise.all(group.map(ref=>ref.listCollections()))).flat());
   }
   return children;
  }));queue.push(...results.flat());
 }
 const [files]=await bucket.getFiles();return {records,files:files.map(file=>({name:file.name,generation:file.metadata.generation}))};
}
async function run(argv=process.argv.slice(2)){
 const options=args(argv),uid=identifier(options['--uid']),mode=options['--mode']||'plan';
 if(!['plan','disable','execute'].includes(mode))throw Error('Use plan, disable or execute');
 if(!admin.apps.length)admin.initializeApp({projectId:PROJECT,storageBucket:BUCKET});
 if(admin.app().options.projectId!==PROJECT)throw Error('Project mismatch');
 const db=admin.firestore(),auth=admin.auth(),bucket=admin.storage().bucket(BUCKET),requestRef=db.doc(`accountDeletionRequests/${uid}`);
 const [request,member]=await Promise.all([requestRef.get(),db.doc(`members/${uid}`).get()]);
 if(!request.exists||request.data().uid!==uid||!['pending','processing'].includes(request.data().status))throw Error('No matching account deletion request');
 if(member.data()?.isAdmin===true)throw Error('Transfer admin ownership and review separately');
 const confirm=()=>{if(options['--confirm']!==uid)throw Error('Explicit target confirmation is required');};
 if(mode==='disable'){
  confirm();await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);
  // Starting the clock after revocation ensures all previously minted ID tokens
  // expire before content is purged. Repeating this step safely restarts the clock.
  await requestRef.update({status:'processing',disabledAtMs:Date.now()});
  console.log('Sign-in disabled and refresh tokens revoked. Wait at least 65 minutes, then prepare a fresh private plan.');return;
 }
 const source=await inventory(db,bucket),current=buildPlan({uid,...source});
 if(mode==='plan'){
  if(!options['--plan'])throw Error('Choose a private plan path outside the repository');
  const destination=path.resolve(options['--plan']);
  if(destination.startsWith(path.resolve(__dirname,'..')+path.sep))throw Error('Do not store personal deletion plans inside the repository');
  fs.writeFileSync(destination,JSON.stringify(current,null,2),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({mode:'read-only',documents:current.deletes.length,updates:current.updates.length,files:current.media.length,manualReview:current.review.length,fingerprint:current.fingerprint}));return;
 }
 confirm();const plan=JSON.parse(fs.readFileSync(options['--plan'],'utf8'));
 if(options['--fingerprint']!==plan.fingerprint)throw Error('Confirm the reviewed plan fingerprint');
 let user;try{user=await auth.getUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;user={disabled:true};}
 assertExecutable(plan,current,{disabled:user.disabled,disabledAt:request.data().disabledAtMs,requestStatus:request.data().status});
 // Generation/precondition guards prevent deleting a replaced object/document.
 for(const file of current.media){if(!file.generation)throw Error('Missing media generation');await bucket.file(file.name,{preconditionOpts:{ifGenerationMatch:file.generation}}).delete();}
 for(const change of current.updates){const patch={};for(const [key,value] of Object.entries(change.patch))patch[key]=value?.deleteField===true?admin.firestore.FieldValue.delete():value;await db.doc(change.path).update(patch,{lastUpdateTime:new admin.firestore.Timestamp(change.version.seconds,change.version.nanoseconds)});}
 for(const record of current.deletes){if(record.path===requestRef.path)continue;await db.doc(record.path).delete({lastUpdateTime:new admin.firestore.Timestamp(record.version.seconds,record.version.nanoseconds)});}
 // Do not report completion if a late reference remains or a trigger recreated
 // related data. A retry starts with a newly reviewed plan after partial work.
 const remaining=buildPlan({uid,...await inventory(db,bucket)});
 if(remaining.deletes.some(r=>r.path!==requestRef.path)||remaining.updates.length||remaining.media.length||remaining.review.length)throw Error('Related data remains; review a new plan before completing deletion');
 try{await auth.deleteUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
 await requestRef.delete();console.log('Account deletion completed and verified.');
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={inventory,args,run};
