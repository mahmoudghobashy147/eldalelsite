'use strict';
const DAY=86400000,NEW_WINDOW=3*DAY;
function dateMillis(value){
 try{
  if(value==null||value==='')return null;
  let n;
  if(value instanceof Date)n=value.getTime();
  else if(typeof value?.toMillis==='function')n=value.toMillis();
  else if(typeof value?.toDate==='function')n=value.toDate().getTime();
  else if(typeof value==='object'&&Number.isFinite(value.seconds??value._seconds))n=(value.seconds??value._seconds)*1000+Math.floor((value.nanoseconds??value._nanoseconds??0)/1e6);
  else if(typeof value==='number')n=value<1e11?value*1000:value;
  else if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))n=Date.parse(value);
  else return null;
  return Number.isFinite(n)&&n>=946684800000?n:null;
 }catch{return null;}
}
function registrationMillis(m,now=Date.now()){
 for(const value of [m?.registeredAtMs,m?.createdAt,m?.registeredAt,m?.joinDate,m?.joinedAt]){const n=dateMillis(value);if(n!==null&&n<=now)return n;}
 return null;
}
function registrationInfo(m,now=Date.now()){
 const at=registrationMillis(m,now);if(at===null)return {at:null,days:null,isNew:false,dateLabel:'تاريخ التسجيل غير متاح',durationLabel:'مدة التسجيل غير متاحة'};
 const elapsed=now-at,days=Math.floor(elapsed/DAY);
 const durationLabel=days===0?'مسجّل اليوم':days===1?'مسجّل من يوم':days===2?'مسجّل من يومين':`مسجّل من ${days} أيام`;
 return {at,days,isNew:elapsed<NEW_WINDOW,dateLabel:new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',day:'numeric',month:'long',year:'numeric'}).format(at),durationLabel:days>10?`مسجّل من ${days} يومًا`:durationLabel};
}
function indexRegistrations(members,now=Date.now()){
 return members.map(m=>({...m,registeredAtMs:registrationMillis(m,now)})).sort((a,b)=>{
  const av=a.registeredAtMs,bv=b.registeredAtMs;
  if(av===null&&bv!==null)return 1;if(bv===null&&av!==null)return -1;
  return (av===null?0:av-bv)||String(a.id||a.uid||'').localeCompare(String(b.id||b.uid||''),'en');
 }).map((m,i)=>({...m,registrationOrdinal:i+1}));
}
module.exports={DAY,NEW_WINDOW,dateMillis,registrationMillis,registrationInfo,indexRegistrations};
