function normalizePhone(value){
 let digits=String(value??'').trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
 if(/[^0-9\s()+-]/.test(digits))return '';
 digits=digits.replace(/\D/g,'');
 if(digits.startsWith('0020'))digits=digits.slice(2);
 if(digits.length===12&&digits.startsWith('20'))digits='0'+digits.slice(2);
 if(digits.length===10&&digits.startsWith('1'))digits='0'+digits;
 return /^01[0125][0-9]{8}$/.test(digits)?digits:'';
}
const phoneKey=phone=>phone;
const duplicateMessage='رقم الموبايل مسجل بالفعل. سجّل الدخول بحسابك الحالي.';
function fail(code,message){const e=new Error(message);e.code=code;throw e}
function readInput(data){const phone=normalizePhone(data?.phone),name=String(data?.name||'').trim(),accountKind=data?.accountKind;if(!phone||name.length<1||name.length>100||!['customer','craftsman','technician','supplier'].includes(accountKind))fail('invalid-argument','راجع الاسم ورقم الموبايل ونوع الحساب');return {phone,name,accountKind}}
function matchesPhone(member,phone){return normalizePhone(member.phoneNormalized)===phone||normalizePhone(member.phone)===phone}
async function assertAvailable(db,rawPhone){const phone=normalizePhone(rawPhone);if(!phone)fail('invalid-argument','رقم الموبايل غير صحيح');const index=await db.collection('memberPhoneIndex').doc(phoneKey(phone)).get();if(index.exists)fail('already-exists',duplicateMessage);const members=await db.collection('members').select('phone','phoneNormalized').get();if(members.docs.some(d=>matchesPhone(d.data(),phone)))fail('already-exists',duplicateMessage);return {available:true}}
async function completeRegistration(db,uid,authEmail,data,now=new Date()){
 const {phone,name,accountKind}=readInput(data);
 if(!uid||authEmail!==`${phone}@daleel.app`)fail('permission-denied','تعذر مطابقة رقم الموبايل بحساب الدخول');
 const memberRef=db.collection('members').doc(uid),indexRef=db.collection('memberPhoneIndex').doc(phoneKey(phone));
 return db.runTransaction(async tx=>{
  const rejectedRef=db.collection('rejectedMemberRegistrations').doc(uid);
  const [index,own,all,rejected]=await Promise.all([tx.get(indexRef),tx.get(memberRef),tx.get(db.collection('members').select('phone','phoneNormalized','accountKind','type')),tx.get(rejectedRef)]);
  if(rejected.exists)fail('permission-denied','تم رفض التسجيل السابق. ابدأ تسجيلًا جديدًا');
  if(index.exists&&(!own.exists||index.data().uid!==uid))fail('already-exists',duplicateMessage);
  if(all.docs.some(d=>d.id!==uid&&matchesPhone(d.data(),phone)))fail('already-exists',duplicateMessage);
  if(own.exists){const existing=own.data();const kind=existing.accountKind||(existing.type==='customer'?'customer':'craftsman');if(!matchesPhone(existing,phone)||kind!==accountKind)fail('already-exists',duplicateMessage);return {success:true,alreadyCreated:true}}
  const customer=accountKind==='customer';
  tx.create(indexRef,{uid,accountKind,createdAt:now});
  tx.create(memberRef,{uid,name,phone,phoneNormalized:phone,accountKind,type:customer?'customer':'starter',plan:customer?'customer':'starter',...(customer?{}:{status:'pending'}),createdAt:now,views:0,calls:0,waMessages:0,saves:0,rating:0,reviews:0});
  return {success:true};
 });
}
async function rejectRegistration(db, auth, actorUid, uid, now = new Date()) {
 if(typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/') || uid === actorUid) {
  fail('invalid-argument', 'طلب التسجيل غير صحيح');
 }
 const members = db.collection('members');
 const actorRef = members.doc(actorUid);
 const memberRef = members.doc(uid);
 const rejectedRef = db.collection('rejectedMemberRegistrations').doc(uid);

 const shouldDelete = await db.runTransaction(async tx => {
  const [actor, member, rejected] = await Promise.all([tx.get(actorRef), tx.get(memberRef), tx.get(rejectedRef)]);
  if(actor.data()?.isAdmin !== true) fail('permission-denied', 'رفض الطلبات متاح للإدارة فقط');
  if(!member.exists) {
   if(rejected.exists) return false;
   fail('not-found', 'طلب التسجيل غير موجود');
  }
  const data = member.data();
  if(data.isAdmin || data.accountKind === 'customer' || data.type === 'customer' ||
     ![undefined, '', 'pending', 'rejected'].includes(data.status) ||
     data.approvedAt || data.subscriptionStart || data.subscriptionEnd || data.billingProvider) {
   fail('failed-precondition', 'الحذف متاح لطلبات التسجيل غير المفعّلة فقط');
  }
  try {
   const login = await auth.getUser(uid);
   if(login.customClaims?.admin || login.customClaims?.isAdmin) {
    fail('failed-precondition', 'لا يمكن حذف حساب إدارة');
   }
  } catch(error) {
   if(error.code !== 'auth/user-not-found') throw error;
  }
  if(!rejected.exists) tx.create(rejectedRef, { rejectedAt: now });
  return true;
 });
 if(!shouldDelete) return { success: true };

 // Keep the reservation until Auth deletion succeeds. Either stage can be retried.
 try {
  await auth.deleteUser(uid);
 } catch(error) {
  if(error.code !== 'auth/user-not-found') throw error;
 }
 await db.runTransaction(async tx => {
  const member = await tx.get(memberRef);
  if(!member.exists) return;
  const data = member.data();
  const phones = new Set([normalizePhone(data.phoneNormalized), normalizePhone(data.phone)].filter(Boolean));
  const indexes = await Promise.all([...phones].map(phone => tx.get(db.collection('memberPhoneIndex').doc(phoneKey(phone)))));
  for(const index of indexes) {
   if(index.data()?.uid === uid && index.data()?.blocked !== true) tx.delete(index.ref);
  }
  tx.delete(memberRef);
 });
 return { success: true };
}
module.exports={normalizePhone,phoneKey,duplicateMessage,assertAvailable,completeRegistration,rejectRegistration};
