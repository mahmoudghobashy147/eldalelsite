import React,{createContext,useContext,useEffect,useState,useCallback} from 'react';
import {createPortal} from 'react-dom';
import {getAuth,onAuthStateChanged,reauthenticateWithCredential,EmailAuthProvider} from 'firebase/auth';
import {getFunctions,httpsCallable} from 'firebase/functions';
import './safety.css';
const Context=createContext({blocked:[],ready:false});
const call=async(name,data={})=>(await httpsCallable(getFunctions(),name)(data)).data;
const friendly=error=>({
 'functions/unauthenticated':'سجّل الدخول أولًا.',
 'functions/permission-denied':'لا يمكن إتمام هذا الإجراء.',
 'functions/not-found':'المحتوى غير متاح حاليًا.',
 'functions/resource-exhausted':'وصلت للحد المسموح، حاول لاحقًا.',
 'functions/unavailable':'الخدمة غير متاحة حاليًا. حاول لاحقًا.',
 'functions/failed-precondition':'أعد تسجيل الدخول لتأكيد هويتك.',
 'auth/invalid-credential':'كلمة السر غير صحيحة.',
 'auth/wrong-password':'كلمة السر غير صحيحة.',
 'auth/too-many-requests':'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.'
}[error?.code]||'تعذر إتمام العملية. لم يتم تأكيد حفظها؛ حاول مرة أخرى.');
export function SafetyProvider({children}){
 const [user,setUser]=useState(null),[blocked,setBlocked]=useState([]),[deletion,setDeletion]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{const current=getAuth().currentUser;if(!current){setBlocked([]);setDeletion(null);setReady(false);return;}const data=await call('getSafetyState');if(getAuth().currentUser?.uid!==current.uid)return;setBlocked(data.blocked||[]);setDeletion(data.deletion||null);setReady(true);setError('');},[]);
 useEffect(()=>onAuthStateChanged(getAuth(),u=>{setUser(u);setBlocked([]);setDeletion(null);setReady(false);setError('');if(u)refresh().catch(e=>setError(friendly(e)));}),[refresh]);
 return <Context.Provider value={{user,blocked,deletion,ready,error,refresh}}>{children}</Context.Provider>;
}
export const useSafety=()=>useContext(Context);
function Modal({title,onClose,children,busy}){
 const panel=React.useRef(null);
 useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';panel.current?.focus();const key=e=>{if(e.key==='Escape'&&!busy)onClose();if(e.key==='Tab'){const nodes=[...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href]')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus?.();};},[onClose,busy]);
 return createPortal(<div className="safety-overlay"><section className="safety-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel} dir="rtl"><header><h2>{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="إغلاق">×</button></header>{children}</section></div>,document.body);
}
export function SafetyActions({targetId,targetType='member',authorId,onRequireAuth}){
 const {user,blocked,refresh}=useSafety();const [mode,setMode]=useState(''),[reason,setReason]=useState('spam'),[details,setDetails]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 const close=useCallback(()=>setMode(''),[]);const owner=targetType==='member'?targetId:authorId;
 if(!targetId||user?.uid===owner)return null;
 const open=m=>{setError('');setResult('');if(!user){if(onRequireAuth)onRequireAuth();else setResult('سجل الدخول لاستخدام الإبلاغ والحظر.');return;}setMode(m);};
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{if(mode==='report'){if(reason==='other'&&details.trim().length<5)throw new Error('details');const data=await call('submitSafetyReport',{targetType,targetId,reason,details});setResult(data.duplicate?'سبق استلام بلاغك على هذا المحتوى.':'تم استلام البلاغ للمراجعة.');}else{await call('setSafetyBlock',{targetId:owner,blocked:!blocked.some(b=>b.id===owner)});await refresh();setResult('تم تحديث الحظر بنجاح.');}setMode('');}catch(e){setError(e.message==='details'?'وضّح السبب في ٥ أحرف على الأقل.':friendly(e));}finally{setBusy(false);}};
 return <div className="safety-actions"><button type="button" onClick={()=>open('report')}>⚑ إبلاغ</button>{owner&&<button type="button" onClick={()=>open('block')}>{blocked.some(b=>b.id===owner)?'إلغاء الحظر':'حظر العضو'}</button>}{result&&<p role="status">{result}</p>}{mode&&<Modal title={mode==='report'?'الإبلاغ عن المحتوى':'التحكم في الحظر'} onClose={close} busy={busy}><form onSubmit={submit}>{mode==='report'?<><p>البلاغ سري ويُراجع بواسطة الإدارة.</p><label>سبب البلاغ<select value={reason} onChange={e=>setReason(e.target.value)}><option value="spam">محتوى مزعج أو متكرر</option><option value="harassment">إساءة أو مضايقة</option><option value="fraud">اشتباه في احتيال</option><option value="unsafe">محتوى غير آمن</option><option value="other">سبب آخر</option></select></label><label>تفاصيل إضافية<textarea maxLength={1500} value={details} onChange={e=>setDetails(e.target.value)}/></label></>:<p>الحظر يمنع الرسائل الجديدة بينك وبين هذا العضو، ويخفي منشوراته من صفحتك الرئيسية. يمكنك إلغاءه من حسابي.</p>}{error&&<p role="alert">{error}</p>}<button className="safety-primary" disabled={busy}>{busy?'جاري الحفظ…':mode==='report'?'إرسال البلاغ':'تأكيد'}</button></form></Modal>}</div>;
}
export function SafetyAccount({deletionOnly=false}){
 const {user,blocked,deletion,refresh,error:loadError}=useSafety();const [mode,setMode]=useState(false),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const close=useCallback(()=>setMode(false),[]);
 const remove=async id=>{setBusy(true);setError('');try{await call('setSafetyBlock',{targetId:id,blocked:false});await refresh();setSuccess('تم إلغاء الحظر.');}catch(e){setError(friendly(e));}finally{setBusy(false);}};
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{if(confirmation.trim()!=='حذف'){setError('اكتب كلمة حذف لتأكيد الطلب.');return;}if(!user?.email)throw new Error('identity');await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));await user.getIdToken(true);await call('requestAccountDeletion',{confirmation:'DELETE'});await refresh();setMode(false);setPassword('');setSuccess('تم استلام طلب حذف حسابك وبياناته. الطلب قيد المراجعة، ولم يتم الحذف بعد.');}catch(e){setError(friendly(e));}finally{setBusy(false);}};
 return <section className="safety-account" dir="rtl"><h3>الخصوصية والتحكم في حسابك</h3>{!user?<p>سجّل الدخول لإدارة الحظر أو طلب حذف حسابك وبياناته.</p>:<>{loadError&&<p role="alert">{loadError}<button onClick={()=>refresh().catch(e=>setError(friendly(e)))}>إعادة المحاولة</button></p>}{!deletionOnly&&<><h4>الأعضاء المحظورون</h4>{blocked.length?blocked.map(b=><div className="safety-row" key={b.id}><span>{b.name||'عضو'}</span><button disabled={busy} onClick={()=>remove(b.id)}>إلغاء الحظر</button></div>):<p>لا يوجد أعضاء محظورون في القائمة المحملة.</p>}</>}<h4>حذف الحساب والبيانات</h4><p>يمكنك طلب حذف الحساب وبياناته المرتبطة. تُراجع الإدارة الطلب قبل التنفيذ؛ إرسال الطلب لا يعني إتمام الحذف.</p>{deletion?<p role="status">حالة الطلب: {deletion.status==='completed'?'مكتمل':'قيد المراجعة'}</p>:<button className="safety-danger" onClick={()=>{setError('');setPassword('');setConfirmation('');setMode(true);}}>طلب حذف الحساب والبيانات</button>}{success&&<p role="status">{success}</p>}{error&&!mode&&<p role="alert">{error}</p>}</>}{mode&&<Modal title="طلب حذف الحساب والبيانات" onClose={close} busy={busy}><form onSubmit={submit}><p>أكّد هويتك بكلمة السر الحالية. لن يُحذف الحساب فور إرسال الطلب.</p><label>كلمة السر الحالية<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><label>اكتب «حذف» لتأكيد الطلب<input value={confirmation} onChange={e=>setConfirmation(e.target.value)} required/></label>{error&&<p role="alert">{error}</p>}<button className="safety-danger" disabled={busy}>{busy?'جاري تأكيد الطلب…':'إرسال طلب الحذف'}</button></form></Modal>}</section>;
}
export function SafetyChatNotice({targetId}){
 const [text,setText]=useState('');useEffect(()=>{let active=true;setText('');if(!getAuth().currentUser||!targetId)return;call('getSafetyBlockStatus',{targetId}).then(d=>{if(active&&d.blocked)setText('المراسلة متوقفة بسبب إعدادات الحظر.');}).catch(()=>{});return()=>{active=false;};},[targetId]);return text?<p className="safety-notice" role="status">{text}</p>:null;
}
export function SafetyModeration(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);setError('');try{setData(await call('listSafetyModeration'));}catch(e){setError(friendly(e));}finally{setBusy(false);}};
 const resolve=async(id,status)=>{setBusy(true);setError('');try{await call('resolveSafetyReport',{reportId:id,status});await load();}catch(e){setError(friendly(e));}finally{setBusy(false);}};
 return <section className="safety-account"><h3>البلاغات وطلبات حذف الحسابات</h3><button disabled={busy} onClick={load}>{busy?'جاري التحميل…':'تحميل الطلبات'}</button>{error&&<p role="alert">{error}</p>}{data&&<><h4>البلاغات المعلقة ({data.reports.length})</h4>{data.reports.map(r=><div className="safety-row" key={r.id}><div><strong>{r.targetType}: {r.targetId}</strong><p>{r.reason}</p><p>{r.details}</p><small>مقدم البلاغ: {r.reporterId}</small></div><div><button disabled={busy} onClick={()=>resolve(r.id,'reviewed')}>تمت المراجعة</button><button disabled={busy} onClick={()=>resolve(r.id,'dismissed')}>حفظ بدون إجراء</button></div></div>)}<h4>طلبات الحذف ({data.deletions.length})</h4>{data.deletions.map(r=><p key={r.id}>{r.uid} — قيد المراجعة</p>)}<p>مراجعة البلاغ لا تحذف المحتوى تلقائيًا. طلبات الحذف لا تُعلّم كمكتملة دون تنفيذ الحذف والتحقق منه.</p></>}</section>;
}
