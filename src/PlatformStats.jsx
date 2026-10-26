import {useEffect,useState} from 'react';
import {collection,doc,getDoc,getCountFromServer,query,where} from 'firebase/firestore';
import './platform-stats.css';

// Owner-confirmed historical balance on 2026-10-26: 37,770.
// Anchor observed legacy counter 33,046; preserve subsequent tracked increments.
const HISTORICAL_VISITS=37770, LEGACY_COUNTER_AT_RESTORE=33046;
export function recordedVisits(data){
 const total=data?.totalVisits;
 return Number.isSafeInteger(total)&&total>=LEGACY_COUNTER_AT_RESTORE?HISTORICAL_VISITS+(total-LEGACY_COUNTER_AT_RESTORE):null;
}
const format=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('ar-EG'):'—';
export default function PlatformStats({db,specialtyCount}){
 const [stats,setStats]=useState({members:null,visits:null});
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;setLoading(true);setStats({members:null,visits:null});
  Promise.allSettled([
   getCountFromServer(query(collection(db,'members'),where('status','==','approved'))).then(s=>s.data().count),
   getDoc(doc(db,'config','stats')).then(s=>s.exists()?recordedVisits(s.data()):null)
  ]).then(results=>{if(!live)return;const value=i=>results[i].status==='fulfilled'?results[i].value:null;setStats({members:value(0),visits:value(1)});setLoading(false);});
  return()=>{live=false;};
 },[db]);
 const cards=[
  {value:stats.members,label:'عضو بالدليل',detail:'ملفات مقدمي الخدمة المعتمدة للعرض',icon:'people'},
  {value:stats.visits,label:'زيارة مسجلة',detail:'رصيد تاريخي تؤكده الإدارة مع الزيارات الجديدة',icon:'eye'},
  {value:specialtyCount,label:'تخصص متاح',detail:'خدمات تقدر تلاقيها في الدليل',icon:'grid'}
 ];
 return <section className="platform-stats" aria-labelledby="platform-stats-title" dir="rtl">
  <h2 id="platform-stats-title" className="sr-only">نشاط الدليل في أرقام</h2>
  <div className="platform-stats-grid" aria-busy={loading}>{cards.map((card,index)=><article key={card.icon}>
   <span className="platform-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{card.icon==='people'?<><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/></>:card.icon==='eye'?<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>:card.icon==='posts'?<><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></>:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>}</svg></span>
   <strong className="platform-stat-number">{loading&&index!==2?'…':format(card.value)}</strong><h3>{card.label}</h3><p>{loading&&index!==2?'جاري تحميل العدد':card.value===null?'العدد غير متاح حاليًا':card.detail}</p>
  </article>)}</div>
  <details className="platform-stats-info"><summary>عن الأرقام</summary><p className="platform-stats-note">الأعضاء هم الملفات المعتمدة للعرض، وليس عدد الاشتراكات المدفوعة. الزيارات قد تتكرر للشخص نفسه؛ تشمل رصيدًا تاريخيًا قدره ٣٧٬٧٧٠ أقرّته إدارة الدليل، مع الزيارات المسجلة بعد استعادته.</p></details>
 </section>;
}
