import React,{useEffect,useRef,useState} from 'react';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {getAuth} from 'firebase/auth';
import './pending-phones.css';
const call=async(name,data={})=>(await httpsCallable(getFunctions(),name)(data)).data;
export default function PendingPhoneViewer({uid}){
 const [allowed,setAllowed]=useState(false),[open,setOpen]=useState(false),[phones,setPhones]=useState([]),[cursor,setCursor]=useState(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{const g=++generation.current;setAllowed(false);setOpen(false);setPhones([]);setCursor(null);setLoaded(false);setBusy(false);setError('');if(uid)call('getPendingPhoneAccess').then(data=>{if(generation.current===g&&getAuth().currentUser?.uid===uid)setAllowed(data.allowed===true);}).catch(()=>{});return()=>{generation.current++;};},[uid]);
 async function load(more=false){const g=generation.current;setBusy(true);setError('');try{const data=await call('listPendingPhones',more?{cursor}:{});if(g!==generation.current||getAuth().currentUser?.uid!==uid)return;setPhones(old=>[...new Set(more?[...old,...data.phones]:data.phones)]);setCursor(data.nextCursor);setLoaded(true);}catch(e){if(g!==generation.current)return;if(e.code==='functions/permission-denied'||e.code==='functions/unauthenticated'){setAllowed(false);setPhones([]);setOpen(false);}else setError(e.code==='functions/invalid-argument'?'انتهت صلاحية الصفحة. اضغط تحديث القائمة.':'تعذر تحميل الأرقام. تأكد من الإنترنت وحاول مرة أخرى.');}finally{if(g===generation.current)setBusy(false);}}
 if(!allowed)return null;
 return <section className="pending-phone-viewer" dir="rtl" aria-label="أرقام المشتركين غير المفعّلين"><button className="pending-phone-toggle" onClick={()=>{const show=!open;setOpen(show);if(show)load();}} aria-expanded={open}>أرقام المشتركين غير المفعّلين <span>{open?'−':'+'}</span></button>{open&&<div className="pending-phone-body"><p>عرض الأرقام فقط. لا تشمل حسابات العملاء المجانية.</p><button onClick={()=>load()} disabled={busy}>تحديث القائمة</button>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">جارٍ تحميل الأرقام…</p>}<ul>{phones.map(phone=><li key={phone}><a href={`tel:${phone}`} dir="ltr">{phone}</a></li>)}</ul>{loaded&&!busy&&!phones.length&&!cursor&&!error&&<p>لا توجد أرقام غير مفعّلة متاحة.</p>}{cursor&&<button onClick={()=>load(true)} disabled={busy}>عرض المزيد</button>}</div>}</section>;
}
