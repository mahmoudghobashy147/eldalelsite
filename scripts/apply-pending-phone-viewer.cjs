'use strict';
const fs=require('node:fs');const path='src/App.jsx';let s=fs.readFileSync(path,'utf8');
if(!s.includes('// pending-phone-viewer-v1')){
 const anchor='<ErrorBoundary><MyProfileScreen ';
 if(s.split(anchor).length!==2)throw Error('Pending phone account anchor missing or ambiguous');
 s='// pending-phone-viewer-v1\nimport PendingPhoneViewer from "./PendingPhoneViewer";\n'+s.replace(anchor,'<ErrorBoundary><PendingPhoneViewer uid={user.uid}/><MyProfileScreen ');
 fs.writeFileSync(path,s);
}
