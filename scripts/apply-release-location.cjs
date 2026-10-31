'use strict';
const fs=require('node:fs');let s=fs.readFileSync('src/App.jsx','utf8');
if(!s.includes('./location'))s='import {getApproximateNativeLocation} from "./location";\n'+s;
const anchor='const getMyLocation = (onSuccess, onError) => {';
if(!s.includes('native-approximate-location')){if(!s.includes(anchor))throw Error('Location entry missing');s=s.replace(anchor,()=>anchor+`\n  // native-approximate-location: only a user initiated, foreground, coarse request.
  if(Capacitor.isNativePlatform()){
    getApproximateNativeLocation().then(onSuccess).catch(error=>onError(error.message==='location-denied'?"إذن الموقع مرفوض. يمكنك تفعيله من إعدادات التطبيق، أو تكمل بدون موقع.":"تعذر تحديد الموقع التقريبي. شغّل خدمة الموقع وحاول مرة أخرى، أو أكمل بدون موقع."));
    return;
  }`);}
s=s.replace('يساعد العملاء يلاقوك بسهولة على خرائط جوجل من صفحة بروفايلك','موقع اختياري وتقريبي يظهر في ملفك المهني. راجعه قبل حفظه ومشاركته، ويمكنك إزالته.');fs.writeFileSync('src/App.jsx',s);console.log('Optional native foreground approximate location staged.');
