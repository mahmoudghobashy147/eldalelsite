'use strict';
const {GoogleAuth}=require('../functions/node_modules/google-auth-library');
async function main(){
 const client=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
 for(const name of ['getPendingPhoneAccess','listPendingPhones','listPendingMembers']){
  const {data}=await client.request({url:`https://cloudfunctions.googleapis.com/v2/projects/eldalel-elshamel/locations/us-central1/functions/${name}`});
  if(data.state!=='ACTIVE'||data.buildConfig?.entryPoint!==name)throw Error('Function not active');
  const r=await fetch(`https://us-central1-eldalel-elshamel.cloudfunctions.net/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{}}),signal:AbortSignal.timeout(30000)});
  const body=await r.json();if(r.status!==401||body.error?.status!=='UNAUTHENTICATED')throw Error('Unauthenticated access was not rejected');
  console.log(name+': ACTIVE; authentication required');
 }
 // Read-only server verification of an existing capability. Never print account
 // identifiers, profile fields or phone values and never grant or change a role.
 const admin=require('../functions/node_modules/firebase-admin');
 if(!admin.apps.length)admin.initializeApp({projectId:'eldalel-elshamel'});
 const roles=await admin.firestore().collection('staffPermissions').where('pendingPhoneViewer','==',true).limit(10).get();
 const target=roles.docs.find(d=>d.data().active===true);if(!target)throw Error('No enabled pending viewer available for verification');
 const {listPendingMembers}=require('../functions/pending-phones/index.cjs');
 const result=await listPendingMembers.run({auth:{uid:target.id},data:{}});
 if(!Array.isArray(result.members)||result.members.length>30||Object.keys(result).some(k=>!['members','nextCursor','serverNowMs'].includes(k)))throw Error('Unexpected detail projection');
 for(const m of result.members)if(Object.keys(m).sort().join(',')!=='name,phone,profession,registeredAtMs,registrationOrdinal'||typeof m.name!=='string'||typeof m.profession!=='string'||!/^01[0125][0-9]{8}$/.test(m.phone))throw Error('Unexpected member detail fields');
 for(let i=1;i<result.members.length;i++)if(result.members[i].registrationOrdinal<=result.members[i-1].registrationOrdinal)throw Error('Registration order incorrect');
 const recent=await listPendingMembers.run({auth:{uid:target.id},data:{recent:true}});
 const registration=require('../functions/pending-phones/registration.cjs');if(recent.members.some(m=>!registration.registrationInfo(m,recent.serverNowMs).isNew))throw Error('Recent filter includes old or unknown registration');
 console.log('Verified oldest-first registration numbers, dates and recent filter; private values omitted. No roles or profiles changed.');
}
main().catch(()=>{console.error('Restricted member release verification failed; no private values logged.');process.exitCode=1;});
