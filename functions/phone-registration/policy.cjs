const crypto=require('node:crypto');
function normalizePhone(value){
 let digits=String(value??'').trim().replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
 if(/[^0-9\s()+-]/.test(digits))return '';
 digits=digits.replace(/\D/g,'');
 if(digits.startsWith('0020'))digits=digits.slice(2);
 if(digits.length===12&&digits.startsWith('20'))digits='0'+digits.slice(2);
 if(digits.length===10&&digits.startsWith('1'))digits='0'+digits;
 return /^01[0125][0-9]{8}$/.test(digits)?digits:'';
}
const phoneKey=phone=>crypto.createHash('sha256').update(phone).digest('hex');
const duplicateMessage='رقم الموبايل مسجل بالفعل. سجّل الدخول بحسابك الحالي؛ لا يمكن استخدام نفس الرقم لحساب عميل ومشترك.';
function fail(code,message){const e=new Error(message);e.code=code;throw e}
function readInput(data){const phone=normalizePhone(data?.phone),name=String(data?.name||'').trim(),accountKind=data?.accountKind;if(!phone||name.length<1||name.length>100||!['customer','craftsman'].includes(accountKind))fail('invalid-argument','راجع الاسم ورقم الموبايل ونوع الحساب');return {phone,name,accountKind}}
function matchesPhone(member,phone){return normalizePhone(member.phoneNormalized)===phone||normalizePhone(member.phone)===phone}
async function assertAvailable(db,rawPhone){const phone=normalizePhone(rawPhone);if(!phone)fail('invalid-argument','رقم الموبايل غير صحيح');const index=await db.collection('phoneRegistrations').doc(phoneKey(phone)).get();if(index.exists)fail('already-exists',duplicateMessage);const members=await db.collection('members').select('phone','phoneNormalized').get();if(members.docs.some(d=>matchesPhone(d.data(),phone)))fail('already-exists',duplicateMessage);return {available:true}}
async function completeRegistration(db,uid,authEmail,data,now=new Date()){
 const {phone,name,accountKind}=readInput(data);
 if(!uid||authEmail!==`${phone}@daleel.app`)fail('permission-denied','تعذر مطابقة رقم الموبايل بحساب الدخول');
 const memberRef=db.collection('members').doc(uid),indexRef=db.collection('phoneRegistrations').doc(phoneKey(phone));
 return db.runTransaction(async tx=>{
  const [index,own,all]=await Promise.all([tx.get(indexRef),tx.get(memberRef),tx.get(db.collection('members').select('phone','phoneNormalized','accountKind','type'))]);
  if(index.exists&&(!own.exists||index.data().uid!==uid))fail('already-exists',duplicateMessage);
  if(all.docs.some(d=>d.id!==uid&&matchesPhone(d.data(),phone)))fail('already-exists',duplicateMessage);
  if(own.exists){const existing=own.data();const kind=existing.accountKind||(existing.type==='customer'?'customer':'craftsman');if(!matchesPhone(existing,phone)||kind!==accountKind)fail('already-exists',duplicateMessage);return {success:true,alreadyCreated:true}}
  const customer=accountKind==='customer';
  tx.create(indexRef,{uid,accountKind,createdAt:now});
  tx.create(memberRef,{uid,name,phone,phoneNormalized:phone,accountKind,type:customer?'customer':'starter',plan:customer?'customer':'starter',...(customer?{}:{status:'pending'}),createdAt:now,views:0,calls:0,waMessages:0,saves:0,rating:0,reviews:0});
  return {success:true};
 });
}
module.exports={normalizePhone,phoneKey,duplicateMessage,assertAvailable,completeRegistration};
