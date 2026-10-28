const fs=require('fs');
const file='src/App.jsx';let s=fs.readFileSync(file,'utf8');
const anchor='        {user&&(\n          <button onClick={handleLogout}';
const inserted=`        <button type="button" aria-label="الإشعارات" title="الإشعارات" onClick={()=>user?setActiveTab("notifications"):setShowAuth(true)} style={{width:40,height:40,borderRadius:12,border:"1px solid #bba062",background:"linear-gradient(145deg,#24563d,#11382a)",color:"#f6d87b",fontSize:19,cursor:"pointer"}}>🔔</button>\n\n`;
if(!s.includes(inserted)){if(s.split(anchor).length!==2)throw Error('Mobile top controls anchor missing');s=s.replace(anchor,inserted+anchor)}
fs.writeFileSync(file,s);
