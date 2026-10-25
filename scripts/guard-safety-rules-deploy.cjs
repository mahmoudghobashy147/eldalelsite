'use strict';
// Read-only drift guard; uses the existing runner ADC credential, never logs it.
const {GoogleAuth}=require('../functions/node_modules/google-auth-library');
const fs=require('node:fs'),crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s.trim()).digest('hex');
async function main(){
 const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});const client=await auth.getClient();
 const project='eldalel-elshamel',base='https://firebaserules.googleapis.com/v1/';
 const release=(await client.request({url:base+`projects/${project}/releases/cloud.firestore`})).data;
 if(!release.rulesetName?.startsWith(`projects/${project}/rulesets/`))throw Error('Unexpected production ruleset reference');
 const rules=(await client.request({url:base+release.rulesetName})).data;
 const files=rules.source?.files;if(!Array.isArray(files)||files.length!==1||typeof files[0].content!=='string')throw Error('Unexpected production rules source');
 const current=hash(files[0].content),candidate=hash(fs.readFileSync('firestore.rules','utf8'));
 const expected='e32003ee2a89965ec1b361ffcfcb3f4379a0c0d15c15a6e96ecaf190e5b2c656';
 if(current!==expected&&current!==candidate)throw Error('Production Firestore rules changed since review; stop and review the new baseline.');
 console.log('Production rules baseline matches the reviewed snapshot or this release.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
