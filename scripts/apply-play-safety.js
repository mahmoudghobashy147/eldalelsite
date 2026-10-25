const fs=require('fs');let s=fs.readFileSync('src/App.jsx','utf8');
function patch(old,next,label){if(s.includes(next))return;const n=s.split(old).length-1;if(n!==1)throw Error(`${label}: ${n} matches`);s=s.replace(old,next);}
patch('import AdsCarousel from "./AdsCarousel";','import {SafetyProvider,SafetyActions,SafetyAccount,SafetyModeration,SafetyChatNotice,useSafety} from "./safety/SafetyFeatures";\nimport AdsCarousel from "./AdsCarousel";','imports');
patch('      <App />','      <SafetyProvider><App /></SafetyProvider>','provider');
patch('  const handleMemberClick = (m) => {\n    setSelectedMember(m);\n    navigateTo(buildMemberPath(m)); // نحدّث رابط المتصفح فعليًا عشان يبقى قابل للفهرسة والمشاركة\n  };',`  const handleMemberClick = async (m) => {
    if(!m?.id)return;
    try {
      const snapshot=await getDoc(doc(db,"members",m.id));
      if(!snapshot.exists()){showToast("الملف غير متاح حاليًا");return;}
      const full={...snapshot.data(),id:snapshot.id};
      setSelectedMember(full);navigateTo(buildMemberPath(full));
    } catch {showToast("تعذر فتح الملف. تحقق من الاتصال وحاول مجددًا.");}
  };`,'full author profile');
patch('                  <Av text={post.author} size={40} type={post.type || "starter"} />',`                  <button type="button" aria-label={\`فتح ملف \${post.author||"صاحب المنشور"}\`} onClick={()=>post.authorId&&onMemberClick({id:post.authorId})} disabled={!post.authorId} style={{border:0,background:"transparent",padding:0,cursor:"pointer",minWidth:44,minHeight:44}}><Av text={post.author} size={40} type={post.type || "starter"} /></button>`,'author avatar');
patch('<div onClick={() => post.authorId && onMemberClick({ id: post.authorId, name: post.author, specialty: post.specialty, type: post.type })} style={{ fontWeight: 700, fontSize: 13.5, color: tc, cursor: post.authorId ? "pointer" : "default", display: "inline-block" }}>{post.author}</div>',`<button type="button" onClick={()=>post.authorId&&onMemberClick({id:post.authorId})} disabled={!post.authorId} aria-label={\`فتح ملف \${post.author||"صاحب المنشور"}\`} style={{fontWeight:700,fontSize:13.5,color:tc,cursor:"pointer",border:0,background:"transparent",padding:0,minHeight:44,textAlign:"right",fontFamily:"inherit"}}>{post.author}</button>`,'author name');
patch('                  {user?.uid===post.authorId && <button',`                  <SafetyActions targetType="post" targetId={post.id} authorId={post.authorId} onRequireAuth={onRequireAuth}/>
                  {user?.uid===post.authorId && <button`,'post report');
patch('  const [posts, setPosts] = useState([]);','  const {blocked:safetyBlocked}=useSafety();\n  const [posts, setPosts] = useState([]);','blocked feed state');
patch('{displayPosts.map((post, idx) => (','{displayPosts.filter(post=>!safetyBlocked.some(b=>b.id===post.authorId)).map((post, idx) => (','blocked feed');
const start=s.indexOf('  async sendMessage(userId1, userId2, senderName, message) {'),end=s.indexOf('  async getChats(userId)',start);if(start<0||end<0)throw Error('message method');
s=s.slice(0,start)+`  async sendMessage(userId1, userId2, senderName, message) {
    if(auth.currentUser?.uid!==userId1)throw new Error("سجّل الدخول مجددًا");
    return (await httpsCallable(functions,"sendSafetyMessage")({targetId:userId2,message})).data;
  },
`+s.slice(end);
patch('    } catch(e) { alert("❌ خطأ في إرسال الرسالة"); }','    } catch(e) { alert(e.code==="functions/permission-denied"?"المراسلة متوقفة بسبب إعدادات الحظر":"تعذر إرسال الرسالة. تحقق من الاتصال وحاول مجددًا."); }','chat error');
patch('      <div style={{ flex: 1, overflowY: "auto", padding: "11px 14px", display: "flex", flexDirection: "column", gap: 9 }}>','      <SafetyChatNotice targetId={chat.users.find(u=>u!==currentUser.uid)}/><SafetyActions targetId={chat.users.find(u=>u!==currentUser.uid)}/>\n      <div style={{ flex: 1, overflowY: "auto", padding: "11px 14px", display: "flex", flexDirection: "column", gap: 9 }}>','chat safety');
patch('        <button className="btn btn-outline btn-lg" style={{width:"100%",marginBottom:9}} onClick={()=>onMemberClick(profile)}>','        <SafetyAccount/>\n        <button className="btn btn-outline btn-lg" style={{width:"100%",marginBottom:9}} onClick={()=>onMemberClick(profile)}>','account safety');
// Admin screen already has server-verified access. Callable verifies independently.
patch('{section==="dashboard" && (\n          <>','{section==="dashboard" && (\n          <><SafetyModeration/>','moderation panel');
patch('      <GlobalStyles/><style>{trustStyles}</style>',`      <GlobalStyles/><style>{trustStyles}</style>
      {new URLSearchParams(window.location.search).has("delete-account")&&<div style={{position:"fixed",inset:0,zIndex:1900,overflowY:"auto",background:"#f3f4ec",padding:"30px 18px",direction:"rtl"}}><div style={{maxWidth:650,margin:"auto"}}><h1>حذف حساب الدليل الشامل وبياناته</h1><p>سجّل الدخول بالحساب المطلوب، ثم أرسل طلب الحذف من النموذج أدناه. الطلب يُراجع بواسطة الإدارة؛ إرسال الطلب لا يعني أن الحذف تم.</p><SafetyAccount deletionOnly/>{!user&&<button className="btn btn-primary" onClick={()=>setShowAuth(true)}>تسجيل الدخول لتقديم الطلب</button>}<p><a href="/">العودة للرئيسية</a></p></div></div>}`,'external deletion request page');
patch('  const [messages, setMessages] = useState([]);','  const {blocked:chatBlocked}=useSafety();\n  const chatIsBlocked=chatBlocked.some(b=>b.id===chat.users.find(u=>u!==currentUser.uid));\n  const [messages, setMessages] = useState([]);','chat disabled state');
patch('<input placeholder="رسالتك..." value={newMessage}','<input disabled={chatIsBlocked} maxLength={5000} placeholder={chatIsBlocked?"المراسلة متوقفة بسبب الحظر":"رسالتك..."} value={newMessage}','blocked composer');
patch('<button onClick={handleSendMessage} style={{ background: C.gold','<button disabled={chatIsBlocked} onClick={handleSendMessage} style={{ background: C.gold','blocked send');
fs.writeFileSync('src/App.jsx',s);
let entry=fs.readFileSync('functions/main.js','utf8');if(!entry.includes('./play-safety/callables.cjs'))entry=entry.replace('  ...require("./index"),','  ...require("./index"),\n  ...require("./play-safety/callables.cjs"),');fs.writeFileSync('functions/main.js',entry);
let rules=fs.readFileSync('firestore.rules','utf8');const a=rules.indexOf('    match /chats/{chatId} {'),b=rules.indexOf('    // QUICK SERVICE REQUESTS',a);if(a<0||b<0)throw Error('chat rule anchors');let chat=rules.slice(a,b);
chat=chat.replace(/allow create: if signedIn\(\)[\s\S]*?;/,'allow create: if false; // sendSafetyMessage only');
chat=chat.replace(/allow update: if isAdmin\(\)[\s\S]*?;/,'allow update: if false; // server-managed metadata');
chat=chat.replace(/allow create: if signedIn\(\)[\s\S]*?;/,'allow create: if false; // sendSafetyMessage only');
rules=rules.slice(0,a)+chat+rules.slice(b);
rules=rules.replace('|| (signedIn() && resource.data.authorId == request.auth.uid)\n        || (signedIn() && onlyChanged',`|| (signedIn() && resource.data.authorId == request.auth.uid
          && onlyChanged(['content','images'])
          && request.resource.data.content is string
          && request.resource.data.content.size() > 0
          && request.resource.data.content.size() <= 10000
          && request.resource.data.images is list
          && request.resource.data.images.size() <= 4)
        || (signedIn() && onlyChanged`);
fs.writeFileSync('firestore.rules',rules);console.log('Safety integration and author profiles applied');
let tests=fs.readFileSync('scripts/test-firestore-rules.js','utf8');
tests=tests.replace('await assertSucceeds(setDoc(doc(alice, "chats", "alice_bob"), {','await assertFails(setDoc(doc(alice, "chats", "alice_bob"), {');
tests=tests.replace('await assertSucceeds(addDoc(collection(alice, "chats", "alice_bob", "messages"), {','await assertFails(addDoc(collection(alice, "chats", "alice_bob", "messages"), {');
tests=tests.replace('await assertSucceeds(updateDoc(doc(bob, "chats", "alice_bob"), {','await assertFails(updateDoc(doc(bob, "chats", "alice_bob"), {');
const seed='    // safety-server-chat-fixture\n    await testEnv.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),"chats","alice_bob"),{users:["alice","bob"],lastMessage:"server-created"});});\n';
if(!tests.includes('safety-server-chat-fixture'))tests=tests.replace('    await assertSucceeds(getDoc(doc(bob, "chats", "alice_bob")));',seed+'    await assertSucceeds(getDoc(doc(bob, "chats", "alice_bob")));');
fs.writeFileSync('scripts/test-firestore-rules.js',tests);
