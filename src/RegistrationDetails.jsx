import React from 'react';
import registrationPolicy from './registration-policy.cjs';
import './registration-details.css';
export default function RegistrationDetails({member,now=Date.now()}){
 const info=registrationPolicy.registrationInfo(member,now);
 return <div className="registration-details"><div className="registration-labels"><span className="registration-number">رقم التسجيل {member.registrationOrdinal||'—'}</span>{info.isNew&&<span className="registration-new">جديد · آخر ٣ أيام</span>}</div><div className="registration-date">{info.at?<time dateTime={new Date(info.at).toISOString()}>تاريخ التسجيل: {info.dateLabel}</time>:info.dateLabel}</div><strong className="registration-duration">{info.durationLabel}</strong></div>;
}
export function RecentRegistrationFilter({active,onChange}){return <div className="registration-filter"><button type="button" aria-pressed={active} onClick={()=>onChange(!active)}>{active?'عرض جميع المسجّلين':'المسجّلون الجدد · آخر ٣ أيام'}</button><span>{active?'يعرض المسجّلين خلال آخر ٧٢ ساعة':'الأقدم أولًا · الترقيم لا يتغيّر مع البحث'}</span></div>;}
