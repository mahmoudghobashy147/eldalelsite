import React,{useState} from 'react';
import {getFunctions,httpsCallable} from 'firebase/functions';
import accountRole from './account-role';
export default function AdminAccountKindControl({member,onChanged}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 if(member.isAdmin)return null;
 const isCustomer=accountRole.isCustomerAccount(member),kind=isCustomer?'craftsman':'customer';
 async function change(){
  const text=isCustomer?'تحويل الحساب إلى مشترك؟ سيحتاج التفعيل إذا لم يكن له اشتراك يدوي ساري، مع الاحتفاظ بكل بياناته.':'تحويل الحساب إلى عميل مجاني؟ ستتوقف صلاحيات النشر والكتالوج المهني، مع الاحتفاظ بأعماله وبياناته ومدفوعاته. هذا لا يلغي اشتراك Google Play أو يرد أموالًا.';
  if(!window.confirm(text))return;setBusy(true);setError('');setNotice('');
  try{const r=(await httpsCallable(getFunctions(),'adminConvertMemberAccount')({memberId:member.id,accountKind:kind})).data;onChanged(r.memberPatch);setNotice(r.restoreNeeded?'تم التحويل. لاستعادة باقة Google Play افتح استعادة المشتريات من التطبيق للتحقق منها.':'تم تغيير نوع الحساب بنجاح');}
  catch(e){setError(e.code==='functions/permission-denied'?'تغيير نوع الحساب متاح للإدارة فقط.':e.code==='functions/not-found'?'الحساب لم يعد موجودًا.':'تعذر تأكيد تغيير نوع الحساب. حدّث القائمة وحاول مرة أخرى.');}finally{setBusy(false);}
 }
 return <div style={{border:'1px solid #c8b36f',borderRadius:12,padding:10,margin:'10px 0',background:'#f7f3e6',color:'#193d2e'}}><span style={{fontWeight:800,fontSize:12}}>نوع الحساب: {isCustomer?'عميل مجاني':'مشترك'}</span><button type="button" disabled={busy} onClick={change} style={{display:'block',width:'100%',minHeight:42,marginTop:7,padding:8,borderRadius:9,border:'1px solid #a8914f',background:'linear-gradient(135deg,#e9d99c,#c4a74f)',color:'#193d2e',fontWeight:800,fontFamily:'inherit',cursor:'pointer'}}>{busy?'جارٍ تغيير نوع الحساب…':isCustomer?'تحويل إلى مشترك':'تحويل إلى عميل'}</button>{error&&<p role="alert" style={{fontSize:12}}>{error}</p>}{notice&&<p role="status" style={{fontSize:12}}>{notice}</p>}</div>;
}
