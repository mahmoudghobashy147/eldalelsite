'use strict';
const fs=require('node:fs');fs.copyFileSync('functions/pending-phones/registration.cjs','src/registration-policy.js');
const path='src/App.jsx';let s=fs.readFileSync(path,'utf8').replaceAll('./registration-policy.cjs','./registration-policy.js');
if(!s.includes('// registration-details-v1')){
 function once(a,b){if(s.split(a).length!==2)throw Error('Registration details anchor: '+a.slice(0,85));s=s.replace(a,b);}
 const start=s.indexOf('  const pendingList = useMemo('),end=s.indexOf('  const filteredPending = useMemo',start);
 if(start<0||end<start)throw Error('Pending list anchors missing');
 s=s.slice(0,start)+`  const [showRecentRegistrations,setShowRecentRegistrations]=useState(false);\n  const [registrationNow,setRegistrationNow]=useState(()=>Date.now());\n  useEffect(()=>{const timer=setInterval(()=>setRegistrationNow(Date.now()),60000);return()=>clearInterval(timer);},[]);\n  const registrationMembers=useMemo(()=>registrationPolicy.indexRegistrations(members,registrationNow),[members,registrationNow]);\n  const pendingList = useMemo(()=>registrationMembers.filter(m=>needsPaidActivation(m)&&(!m.status||m.status==="pending")),[registrationMembers]);\n`+s.slice(end);
 once('    if (!pendingSearch) return pendingList;','    const visiblePending=showRecentRegistrations?pendingList.filter(m=>registrationPolicy.isRecentRegistration(m,registrationNow)):pendingList;\n    if (!pendingSearch) return visiblePending;');
 once('return pendingList.filter(m =>','return visiblePending.filter(m =>');
 once('[pendingList, pendingSearch]','[pendingList, pendingSearch, showRecentRegistrations, registrationNow]');
 once('    return members.filter(m =>\n      (!memberSearch','    return registrationMembers.filter(m =>\n      (!showRecentRegistrations||registrationPolicy.isRecentRegistration(m,registrationNow)) &&\n      (!memberSearch');
 once('[members, memberSearch, memberStatusFilter, memberTypeFilter, memberGovFilter, memberAccountFilter]','[registrationMembers, memberSearch, memberStatusFilter, memberTypeFilter, memberGovFilter, memberAccountFilter, showRecentRegistrations, registrationNow]');
 once('{filteredPending.slice(0,pendingVisibleCount).map((m,i)=>(', '<RecentRegistrationFilter active={showRecentRegistrations} onChange={v=>{setShowRecentRegistrations(v);setPendingVisibleCount(30);}}/>\n            {filteredPending.slice(0,pendingVisibleCount).map((m,i)=>(');
 once('{filteredMembers.slice(0,memberVisibleCount).map((m,i)=>(', '<RecentRegistrationFilter active={showRecentRegistrations} onChange={v=>{setShowRecentRegistrations(v);setMemberVisibleCount(30);}}/>\n            {filteredMembers.slice(0,memberVisibleCount).map((m,i)=>(');
 // Replace all index-based badge numbers inside the two admin member lists only.
 const from=s.indexOf('{filteredPending.slice'),to=s.indexOf('{filteredMembers.length > memberVisibleCount',from);if(from<0||to<from)throw Error('Admin card range missing');
 let cards=s.slice(from,to);cards=cards.replaceAll('{i+1}','{m.registrationOrdinal}');
 cards=cards.replace('{m.createdAt && <span>🕐 {tAgo(m.createdAt)}</span>}','<RegistrationDetails member={m} now={registrationNow}/>');
 // All-members cards have a separate status/edit row; place details before the edit controls.
 const mapStart=cards.indexOf('{filteredMembers.slice');
 // A robust keyed-card insertion avoids relying on select controls that other role patches wrap.
 const cardRoot=cards.indexOf('<div key={m.id}',mapStart),firstInnerEnd=cards.indexOf('>',cardRoot);
 if(mapStart<0||cardRoot<0||firstInnerEnd<0)throw Error('All-member card missing');
 cards=cards.slice(0,firstInnerEnd+1)+'\n                <RegistrationDetails member={m} now={registrationNow}/>'+cards.slice(firstInnerEnd+1);
 s=s.slice(0,from)+cards+s.slice(to);
 s=s.replace('pendingSearch?"لا توجد نتائج مطابقة":"لا توجد طلبات معلقة"','pendingSearch?"لا توجد نتائج مطابقة":showRecentRegistrations?"لا يوجد مسجّلون جدد خلال آخر ٣ أيام":"لا توجد طلبات معلقة"').replace('pendingSearch?"جرّب كلمة بحث مختلفة":"جميع الطلبات تمت مراجعتها"','pendingSearch?"جرّب كلمة بحث مختلفة":showRecentRegistrations?"اضغط عرض جميع المسجّلين للعودة للقائمة الكاملة":"جميع الطلبات تمت مراجعتها"');
 s='// registration-details-v1\nimport registrationPolicy from "./registration-policy.js";\nimport RegistrationDetails,{RecentRegistrationFilter} from "./RegistrationDetails";\n'+s;
}
fs.writeFileSync(path,s);
