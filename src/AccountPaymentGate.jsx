import {useEffect,useState} from 'react';
import {doc,getDoc} from 'firebase/firestore';
import accountRole from './account-role';
export default function AccountPaymentGate({uid,db,onBack,children}){
 const [state,setState]=useState({uid:null,kind:'loading'});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;if(!uid)return()=>{live=false};setState({uid,kind:'loading'});getDoc(doc(db,'members',uid)).then(s=>{if(live)setState({uid,kind:!s.exists()?'error':accountRole.isCustomerAccount(s.data())?'customer':'professional'})}).catch(()=>{if(live)setState({uid,kind:'error'})});return()=>{live=false}},[uid,db,retry]);
 if(!uid)return children;
 const kind=state.uid===uid?state.kind:'loading';
 if(kind==='professional')return children;
 return <section dir="rtl" style={{background:'#f5f4ec',color:'#173f31',minHeight:'100vh',padding:24}}><button className="btn btn-outline" onClick={onBack}>رجوع</button>
  {kind==='loading'?<p role="status">جارٍ التحقق من نوع حسابك…</p>:kind==='customer'?<><h2>👤 باقة العميل</h2><strong>مجانية — بدون اشتراك مدفوع</strong><p>حسابك مخصص للبحث عن مقدم الخدمة وطلب صنايعي والتواصل معه. لا تحتاج إلى شراء باقة أو إرسال إيصال تفعيل.</p></>:<><p role="alert">تعذر التحقق من نوع الحساب. حاول مرة أخرى.</p><button className="btn btn-primary" onClick={()=>setRetry(n=>n+1)}>إعادة المحاولة</button></>}
 </section>;
}
