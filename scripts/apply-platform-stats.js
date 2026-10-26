const fs=require('fs');const file='src/App.jsx';let s=fs.readFileSync(file,'utf8');
const imp='import PlatformStats from "./PlatformStats";';
if(!s.includes(imp))s=imp+'\n'+s;
const anchor='<AdsCarousel ads={homeAds} fallbackImage={luxuryHero}/>';
const replacement=anchor+'\n        <PlatformStats db={db} specialtyCount={SPECIALTIES.length} signedIn={Boolean(user)} onJoin={()=>user?onNavigate("profile"):onRequireAuth()}/>';
if(!s.includes('<PlatformStats db={db}')){if(s.split(anchor).length!==2)throw Error('Expected exactly one homepage ad carousel');s=s.replace(anchor,replacement);}
fs.writeFileSync(file,s);
console.log('Homepage counters restored using public aggregate counts and owner-confirmed historical visits.');
