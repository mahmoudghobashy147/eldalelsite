'use strict';
const fs=require('node:fs');let s=fs.readFileSync('src/App.jsx','utf8');
if(!s.includes('// admin-account-conversion-v1')){
 const anchor='<RegistrationDetails member={m} now={registrationNow}/>';
 if(s.split(anchor).length!==3)throw Error('Expected registration details in both admin lists');
 const extra='<AdminAccountKindControl member={m} onChanged={patch=>{setMembers(current=>{const next=current.map(row=>row.id===m.id?{...row,...patch}:row);setStats(DB.getAdminStats(next,payments));return next;});}}/>';
 // Only the all-members screen exposes role conversion; pending approval remains separate.
 const from=s.indexOf('{filteredMembers.slice(0,memberVisibleCount).map('),index=s.indexOf(anchor,from);if(from<0||index<0)throw Error('Admin all-member conversion anchor missing');
 s=s.slice(0,index)+anchor+extra+s.slice(index+anchor.length);
 const memberLoad='const all = membersSnap ? membersSnap.docs.map(d => ({ id:d.id, ...d.data() })) : [];';if(s.split(memberLoad).length!==2)throw Error('Canonical admin member ID anchor missing');s=s.replace(memberLoad,'const all = membersSnap ? membersSnap.docs.map(d => ({ ...d.data(), id:d.id })) : [];');
 s='// admin-account-conversion-v1\nimport AdminAccountKindControl from "./AdminAccountKindControl";\n'+s;fs.writeFileSync('src/App.jsx',s);
}
