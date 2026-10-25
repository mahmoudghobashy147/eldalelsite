import {useEffect,useState} from 'react';
import {collection,doc,getDoc,getCountFromServer,query,where} from 'firebase/firestore';
import './platform-stats.css';

// The legacy tracker starts at 10,000. Display only increments after that seed.
export function recordedVisits(data){
 const total=data?.totalVisits;
 return Number.isSafeInteger(total)&&total>=10000?total-10000:null;
}
const format=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('ar-EG'):'—';
export default function PlatformStats({db,specialtyCount,onJoin,signedIn}){
 const [stats,setStats]=useState({members:null,posts:null,visits:null});
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;setLoading(true);setStats({members:null,posts:null,visits:null});
  Promise.allSettled([
   getCountFromServer(query(collection(db,'members'),where('status','==','approved'))).then(s=>s.data().count),
   getCountFromServer(collection(db,'posts')).then(s=>s.data().count),
   getDoc(doc(db,'config','stats')).then(s=>s.exists()?recordedVisits(s.data()):null)
  ]).then(results=>{if(!live)return;const value=i=>results[i].status==='fulfilled'?results[i].value:null;setStats({members:value(0),posts:value(1),visits:value(2)});setLoading(false);});
  return()=>{live=false;};
 },[db]);
 const cards=[
  {value:stats.members,label:'عضو بالدليل',detail:'ملفات مقدمي الخدمة المعتمدة للعرض',icon:'people'},
  {value:stats.visits,label:'زيارة مسجلة',detail:'زيادات العداد بعد القيمة الافتتاحية القديمة',icon:'eye'},
  {value:stats.posts,label:'منشور على الدليل',detail:'منشورات موجودة حاليًا على المنصة',icon:'posts'},
  {value:specialtyCount,label:'تخصص متاح',detail:'خدمات تقدر تلاقيها في الدليل',icon:'grid'}
 ];
 return <section className="platform-stats" aria-labelledby="platform-stats-title" dir="rtl">
  <header><div><span className="platform-stats-kicker">مجتمع الدليل الشامل</span><h2 id="platform-stats-title">نشاط الدليل في أرقام</h2></div><button type="button" onClick={onJoin}>{signedIn?'كمّل ملفك':'خليك جزء من الدليل'} <span aria-hidden="true">←</span></button></header>
  <div className="platform-stats-grid" aria-busy={loading}>{cards.map((card,index)=><article key={card.icon}>
   <span className="platform-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{card.icon==='people'?<><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/></>:card.icon==='eye'?<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>:card.icon==='posts'?<><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></>:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>}</svg></span>
   <strong className="platform-stat-number">{loading&&index!==3?'…':format(card.value)}</strong><h3>{card.label}</h3><p>{loading&&index!==3?'جاري تحميل العدد':card.value===null?'العدد غير متاح حاليًا':card.detail}</p>
  </article>)}</div>
  <p className="platform-stats-note">الأعضاء هم الملفات المعتمدة للعرض، وليس عدد الاشتراكات المدفوعة. الزيارات قد تتكرر للشخص نفسه؛ لا تشمل القيمة الافتتاحية القديمة (١٠٬٠٠٠).</p>
 </section>;
}
