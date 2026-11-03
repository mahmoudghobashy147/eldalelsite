'use strict';
const plans=new Set(['starter','basic','premium','vip','company','elite']);
const types=new Set([...plans,'craftsman','engineer','contractor','supplier']);
const customer=m=>m?.accountKind==='customer'||(!m?.accountKind&&(m?.type==='customer'||m?.plan==='customer'));
const millis=t=>{try{const v=t?.toMillis?.()??t?.toDate?.()?.getTime?.()??(t instanceof Date?t.getTime():typeof t==='number'?t:typeof t==='string'?Date.parse(t):null);return Number.isFinite(v)?v:null;}catch{return null;}};
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
function professionalSnapshot(m){const fields=['plan','type','status','subscriptionStart','subscriptionEnd','approvedAt','billingProvider'];const out={};for(const key of fields)if(m[key]!==undefined)out[key]=m[key];return out;}
function conversion(member,state,kind,now=Date.now()){
 if(!['customer','craftsman'].includes(kind))fail('invalid-argument','نوع الحساب غير صحيح');
 if(member.isAdmin===true)fail('failed-precondition','حساب الإدارة لا يتحول إلى عميل أو مشترك');
 const oldKind=customer(member)?'customer':'craftsman';if(oldKind===kind)return {changed:false,memberPatch:{accountKind:kind},restoreNeeded:false};
 if(kind==='customer')return {changed:true,professional:professionalSnapshot(member),memberPatch:{accountKind:'customer',type:'customer',plan:'customer',status:'pending'},restoreNeeded:false};
 const previous=state?.professional||{},plan=plans.has(previous.plan)?previous.plan:'starter',type=types.has(previous.type)?previous.type:plan,end=millis(previous.subscriptionEnd),activeManual=previous.status==='approved'&&end!==null&&end>now&&previous.billingProvider!=='google_play';
 const memberPatch={accountKind:'craftsman',type,plan,status:activeManual?'approved':'pending'};
 // Existing payment/token fields and uploaded content are never erased. Only an
 // unexpired prior manual term is restored; Google purchases require real verification.
 if(activeManual){memberPatch.subscriptionEnd=previous.subscriptionEnd;if(previous.subscriptionStart!==undefined)memberPatch.subscriptionStart=previous.subscriptionStart;}
 return {changed:true,memberPatch,restoreNeeded:previous.billingProvider==='google_play'&&end!==null&&end>now};
}
async function convertAccount(db,actorUid,data,{now=Date.now(),timestamp=()=>new Date()}={}){
 const target=data?.memberId,kind=data?.accountKind;if(typeof target!=='string'||!target||target.length>128||target.includes('/'))fail('invalid-argument','الحساب غير صحيح');if(!['customer','craftsman'].includes(kind))fail('invalid-argument','نوع الحساب غير صحيح');
 const actorRef=db.collection('members').doc(actorUid),targetRef=db.collection('members').doc(target),stateRef=db.collection('memberRoleState').doc(target);
 return db.runTransaction(async tx=>{const [actor,member,state]=await Promise.all([tx.get(actorRef),tx.get(targetRef),tx.get(stateRef)]);
  if(actor.data()?.isAdmin!==true)fail('permission-denied','هذه العملية للإدارة فقط');if(!member.exists)fail('not-found','الحساب غير موجود');
  if(target===actorUid)fail('failed-precondition','لا يمكن تغيير نوع حساب الإدارة من هنا');
  const result=conversion(member.data(),state.data(),kind,now);if(!result.changed)return {changed:false,memberPatch:result.memberPatch,restoreNeeded:false};
  tx.update(targetRef,{...result.memberPatch,accountKindChangedAt:timestamp()});
  tx.set(stateRef,{...(result.professional?{professional:result.professional}:{}),lastKind:kind,lastChangedBy:actorUid,lastChangedAt:timestamp()},{merge:true});
  tx.create(stateRef.collection('history').doc(),{from:customer(member.data())?'customer':'craftsman',to:kind,actorUid,changedAt:timestamp(),restoredManualTerm:kind==='craftsman'&&result.memberPatch.status==='approved'});
  return {changed:true,memberPatch:result.memberPatch,restoreNeeded:result.restoreNeeded};
 });
}
module.exports={customer,millis,professionalSnapshot,conversion,convertAccount};
