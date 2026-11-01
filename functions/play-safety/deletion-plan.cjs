'use strict';
const {createHash}=require('node:crypto');
const {identifier}=require('./core.cjs');
const OWNED=new Set(['posts','catalogBusinesses','catalogProducts','catalogBusinessRequests','catalogCategories','serviceRequests','serviceRequestApplications','jobs','jobApplications','payments','playPurchases','notifications','safetyReports','memberInteractionRate','profileViewNotificationRate']);
const OWNER_FIELDS=['uid','postedBy','authorId','ownerId','userId','memberId','applicantId','reviewerId','reporterId','recipientId'];
const ARRAYS=['likedBy','readBy','savedBy','followers','users'];
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inside=(path,root)=>path===root||path.startsWith(root+'/');
function strings(value,out=[],seen=new WeakSet()){
 if(typeof value==='string')out.push(value);
 else if(value&&typeof value==='object'&&!seen.has(value)){
  seen.add(value);
  if(typeof value.path==='string'&&value.firestore)out.push(value.path);
  else Object.values(value).forEach(v=>strings(v,out,seen));
 }
 return out;
}
function ownsFile(name,uid,otherIds=[]){
 if(name===`avatars/${uid}`||name.startsWith(`avatars/${uid}/`))return true;
 if(['workPhotos','postImages','postVideos'].some(p=>name.startsWith(`${p}/${uid}/`))||name.startsWith(`catalog/owners/${uid}/`))return true;
 if(name===`covers/${uid}`)return true;
 return name.startsWith(`covers/${uid}_`)&&!otherIds.some(other=>other!==uid&&(name===`covers/${other}`||name.startsWith(`covers/${other}_`)));
}
function buildPlan({uid,records,files=[],now=Date.now()}){
 identifier(uid);const member=records.find(r=>r.path===`members/${uid}`);
 if(member?.data?.isAdmin===true)throw Error('Admin accounts require a separate transfer and review');
 const roots=new Set([`members/${uid}`,`catalogBusinessRequests/${uid}`,`staffPermissions/${uid}`]);
 for(const r of records){const [collection,,...rest]=r.path.split('/');if(!rest.length&&OWNED.has(collection)&&OWNER_FIELDS.some(k=>r.data[k]===uid))roots.add(r.path);}
 const personal=[member?.data?.phone,member?.data?.phoneNormalized,member?.data?.email].filter(v=>typeof v==='string'&&v.length>=7);
 const deletes=[],updates=[],review=[];
 for(const r of records){
  const parts=r.path.split('/'),collection=parts[0],data=r.data;
  if([...roots].some(root=>inside(r.path,root))||
    ((collection==='memberPhoneIndex')&&data.uid===uid)||
    (r.path===`accountDeletionRequests/${uid}`)||
    (parts.length>2&&['reviews','comments'].includes(parts.at(-2))&&OWNER_FIELDS.some(k=>data[k]===uid))||
    (parts.length===4&&parts[0]==='members'&&['saved','followers','blockedUsers'].includes(parts[2])&&parts[3]===uid)||
    (OWNED.has(collection)&&(data.meta?.senderId===uid||data.meta?.memberId===uid))){deletes.push({path:r.path,version:r.version});continue;}
  const patch={};
  for(const field of ARRAYS)if(Array.isArray(data[field])&&data[field].includes(uid))patch[field]=data[field].filter(v=>v!==uid);
  if(patch.likedBy&&Number.isFinite(data.likes))patch.likes=Math.max(0,data.likes-(data.likedBy.length-patch.likedBy.length));
  if(collection==='chats'&&patch.users){
   // Preserve the other participant's messages, remove the deleted sender's
   // messages separately, and erase cached identities and message previews.
   for(const [key,value] of Object.entries(data))if(!['users','lastMessage','lastTime','updatedAt'].includes(key))patch[key]={deleteField:true};
   patch.lastMessage='';
  }
  if(collection==='chats'&&parts.at(-2)==='messages'&&data.senderId===uid){deletes.push({path:r.path,version:r.version});continue;}
  const remaining={...data,...patch};
  const values=strings(remaining);
  const otherProfile=collection==='members'&&parts.length===2&&parts[1]!==uid;
  if(values.some(v=>v===uid||v===`members/${uid}`)||parts.some((part,i)=>i%2===1&&part===uid)||(!otherProfile&&personal.some(p=>values.some(v=>v.includes(p)))))review.push(r.path);
  if(Object.keys(patch).length)updates.push({path:r.path,version:r.version,patch});
 }
 const deleted=new Set(deletes.map(r=>r.path));
 const affectedReviews=new Set(),affectedComments=new Set();
 for(const item of deletes){const p=item.path.split('/');if(p.length===4&&p[0]==='members'&&p[2]==='reviews'&&p[1]!==uid)affectedReviews.add(p[1]);if(p.length===4&&p[0]==='posts'&&p[2]==='comments'&&!deleted.has(`posts/${p[1]}`))affectedComments.add(p[1]);}
 function mergeAggregate(record,patch){if(!record)return;const existing=updates.find(r=>r.path===record.path);if(existing)Object.assign(existing.patch,patch);else updates.push({path:record.path,version:record.version,patch});}
 for(const memberId of affectedReviews){const prefix=`members/${memberId}/reviews/`;const ratings=records.filter(r=>r.path.startsWith(prefix)&&r.path.split('/').length===4&&!deleted.has(r.path)).map(r=>Number(r.data.rating)).filter(v=>Number.isFinite(v)&&v>=1&&v<=5);mergeAggregate(records.find(r=>r.path===`members/${memberId}`),{reviews:ratings.length,rating:ratings.length?Math.round(10*ratings.reduce((a,b)=>a+b,0)/ratings.length)/10:0});}
 for(const postId of affectedComments){const prefix=`posts/${postId}/comments/`;const count=records.filter(r=>r.path.startsWith(prefix)&&r.path.split('/').length===4&&!deleted.has(r.path)).length;mergeAggregate(records.find(r=>r.path===`posts/${postId}`),{comments:count});}
 // Quota docs contain only a hash, but are still derived from this account.
 const quota=`safetyReportQuotas/${digest([uid])}`;
 for(const r of records)if(r.path===quota&&!deletes.some(d=>d.path===r.path))deletes.push({path:r.path,version:r.version});
 const otherIds=records.filter(r=>/^members\/[^/]+$/.test(r.path)).map(r=>r.path.split('/')[1]);
 const media=files.filter(file=>ownsFile(file.name,uid,otherIds)).map(file=>({name:file.name,generation:String(file.generation)}));
 deletes.sort((a,b)=>b.path.split('/').length-a.path.split('/').length||a.path.localeCompare(b.path));updates.sort((a,b)=>a.path.localeCompare(b.path));media.sort((a,b)=>a.name.localeCompare(b.name));
 const result={version:1,uid,createdAt:now,deletes,updates,media,review:[...new Set(review)].sort()};
 result.fingerprint=digest({uid,deletes,updates,media,review:result.review});return result;
}
function assertExecutable(plan,current,{now=Date.now(),disabledAt,disabled,requestStatus}){
 if(!disabled||!Number.isFinite(disabledAt)||now-disabledAt<65*60*1000)throw Error('Disable sign-in, revoke refresh tokens and wait at least 65 minutes before deletion');
 if(requestStatus!=='processing'||plan.uid!==current.uid||plan.version!==1)throw Error('A verified processing request is required');
 if(!Number.isFinite(plan.createdAt)||now-plan.createdAt>15*60*1000||plan.createdAt>now+60000)throw Error('Prepare a fresh deletion plan');
 if(plan.review.length||current.review.length)throw Error('Unmapped references require manual review; deletion cannot be completed');
 if(plan.fingerprint!==current.fingerprint)throw Error('Account data changed; prepare and review a new plan');
}
module.exports={buildPlan,assertExecutable,ownsFile};
