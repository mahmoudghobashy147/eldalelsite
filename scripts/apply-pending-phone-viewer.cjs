'use strict';
const fs=require('node:fs');const path='src/App.jsx';let s=fs.readFileSync(path,'utf8');
if(!s.includes('// pending-members-page-v2')){
 // Support a clean source build and a source that already contains the earlier account widget.
 s=s.replace('// pending-phone-viewer-v1\n','').replace('import PendingPhoneViewer from "./PendingPhoneViewer";\n','').replace('<PendingPhoneViewer uid={user.uid}/>','');
 function once(a,b){if(s.split(a).length!==2)throw Error('Pending members anchor missing or ambiguous: '+a.slice(0,65));s=s.replace(a,b);}
 once('  const isAdmin = Boolean(user && verifiedAdmin);','  const pendingPhoneAccess=usePendingPhoneAccess(user?.uid);\n  const isAdmin = Boolean(user && verifiedAdmin);');
 once('    {id:"profile", icon:"👤", label:"حسابي"},','    ...(pendingPhoneAccess ? [{id:"pendingMembers",icon:"☷",label:"غير المفعّلين"}] : []),\n    {id:"profile", icon:"👤", label:"حسابي"},');
 once('{activeTab==="profile"&&(user?', '{activeTab==="pendingMembers"&&(user&&pendingPhoneAccess?<ErrorBoundary><PendingPhoneViewer uid={user.uid} darkMode={darkMode} onBack={()=>setActiveTab("profile")}/></ErrorBoundary>:<div style={{padding:30,textAlign:"center"}}>هذه الصفحة متاحة للحساب المصرّح له فقط.</div>)}\n            {activeTab==="profile"&&(user?');
 once('className="tab-bar mobile-nav-modern"','className={`tab-bar mobile-nav-modern${pendingPhoneAccess?" has-pending-members":""}`}');
 s='// pending-members-page-v2\nimport PendingPhoneViewer,{usePendingPhoneAccess} from "./PendingPhoneViewer";\n'+s;
 fs.writeFileSync(path,s);
}
