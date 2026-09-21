const fs = require('fs');

const file = 'src/App.jsx';
let src = fs.readFileSync(file, 'utf8');
const marker = 'HOME_FEED_ADS_RESTORE_V1';

if (src.includes(marker)) {
  console.log('✓ homepage posts and ads already restored');
  process.exit(0);
}

const stateNeedle = '  const [searchText,setSearchText] = useState("");';
if (!src.includes(stateNeedle)) {
  console.error('Could not locate HomeScreen state anchor');
  process.exit(1);
}

const stateInsert = `${stateNeedle}
  // HOME_FEED_ADS_RESTORE_V1 — keep posts and advertising spaces visible on the new homepage.
  const [homePosts,setHomePosts] = useState([]);
  const [homePostsLoading,setHomePostsLoading] = useState(true);
  const [homeAds,setHomeAds] = useState([]);
  const [homeAdIdx,setHomeAdIdx] = useState(0);
  const [showHomeAddPost,setShowHomeAddPost] = useState(false);
  const [homeSelectedPost,setHomeSelectedPost] = useState(null);

  useEffect(() => {
    let mounted = true;
    DB.getPosts().then(r => {
      if (mounted) setHomePosts(r?.posts || []);
    }).catch(() => {
      if (mounted) setHomePosts([]);
    }).finally(() => {
      if (mounted) setHomePostsLoading(false);
    });

    const unsubAds = onSnapshot(
      query(collection(db,"ads"), where("status","==","active")),
      snap => {
        if (!mounted) return;
        setHomeAds(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      },
      () => {}
    );

    return () => { mounted = false; unsubAds?.(); };
  }, []);

  useEffect(() => {
    if (homeAds.length <= 1) { setHomeAdIdx(0); return; }
    setHomeAdIdx(i => i % homeAds.length);
    const timer = setInterval(() => setHomeAdIdx(i => (i + 1) % homeAds.length), 6000);
    return () => clearInterval(timer);
  }, [homeAds.length]);

  const openHomePostComposer = () => {
    if (!user) return onRequireAuth();
    setShowHomeAddPost(true);
  };

  const likeHomePost = (post) => {
    if (!user) return onRequireAuth();
    const liked = (post.likedBy || []).includes(user.uid);
    setHomePosts(items => items.map(p => p.id === post.id ? {
      ...p,
      likedBy: liked ? (p.likedBy || []).filter(id => id !== user.uid) : [...(p.likedBy || []), user.uid],
      likes: liked ? Math.max(0, (p.likes || 1) - 1) : (p.likes || 0) + 1,
    } : p));
    DB.likePost(post.id, user.uid).catch(() => {});
  };`;

src = src.replace(stateNeedle, stateInsert);

const quoteNeedle = '      <section style={{marginBottom:34,display:"grid",gridTemplateColumns:isDesktop?"1.1fr .9fr":"1fr",gap:12}}>';
if (!src.includes(quoteNeedle)) {
  console.error('Could not locate homepage quote/community section anchor');
  process.exit(1);
}

const adsSection = `      <section style={{marginBottom:34}}>
        {sectionTitle("مساحات إعلانية","إعلانات وعروض من الشركات والموردين")}
        {homeAds.length > 0 ? (
          <>
            <div style={{position:"relative",marginBottom:10}}>
              <Ad3DCard key={homeAds[homeAdIdx]?.id} ad={homeAds[homeAdIdx]} variant="hero" darkMode={darkMode} style={{animation:"fadeIn .35s ease"}}/>
              {homeAds.length > 1 && <div style={{display:"flex",justifyContent:"center",gap:5,marginTop:8}}>{homeAds.map((ad,i)=><button key={ad.id} aria-label={\`إعلان \${i+1}\`} onClick={()=>setHomeAdIdx(i)} style={{width:i===homeAdIdx?18:7,height:7,padding:0,border:0,borderRadius:5,background:i===homeAdIdx?C.gold:(darkMode?"rgba(255,255,255,.2)":"#D8DEE6"),cursor:"pointer",transition:"all .2s"}} />)}</div>}
            </div>
            {homeAds.length > 1 && <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr":"1fr 1fr",gap:9}}>{[1,2].map(off=>homeAds[(homeAdIdx+off)%homeAds.length]).filter(Boolean).map(ad=><Ad3DCard key={ad.id} ad={ad} variant="small" darkMode={darkMode}/>)}</div>}
          </>
        ) : (
          <div style={{background:card,borderRadius:18,padding:isDesktop?26:20,border:\`1px dashed \${darkMode?"rgba(201,168,76,.35)":"#D5B75B"}\`,textAlign:"center"}}>
            <div style={{fontSize:34,marginBottom:7}}>📢</div>
            <div style={{fontFamily:"'Cairo'",fontWeight:900,color:tc,fontSize:16}}>مكان الإعلانات محفوظ هنا</div>
            <div style={{color:sub,fontSize:11.5,marginTop:5}}>أي إعلان نشط من لوحة الإدارة هيظهر تلقائيًا في المساحة دي.</div>
          </div>
        )}
      </section>

${quoteNeedle}`;

src = src.replace(quoteNeedle, adsSection);

const articlesNeedle = `      <section style={{marginBottom:34}}>
        {sectionTitle("مقالات ونصائح","قرارات تشطيب أذكى قبل الشراء والتنفيذ")}`;
if (!src.includes(articlesNeedle)) {
  console.error('Could not locate homepage articles section anchor');
  process.exit(1);
}

const postsSection = `      <section style={{marginBottom:34}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
          <div>{sectionTitle("المنشورات وأحدث الأعمال","صور أعمال ونصائح وعروض من أعضاء الدليل")}</div>
          <button className="btn btn-outline btn-sm" onClick={()=>onNavigate("community")}>كل المنشورات</button>
        </div>
        <div style={{background:card,borderRadius:15,padding:12,border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`,marginBottom:12,display:"flex",gap:9,alignItems:"center"}}>
          <Av text={user?.displayName||"؟"} size={38} type="starter"/>
          <button onClick={openHomePostComposer} style={{flex:1,border:"none",borderRadius:22,padding:"10px 14px",background:darkMode?"rgba(255,255,255,.06)":"#F3F4F6",color:sub,textAlign:"right",fontFamily:"'Cairo'",cursor:"pointer"}}>{user?"شارك أحدث أعمالك أو خبرتك...":"سجّل دخولك للمشاركة..."}</button>
        </div>

        {homePostsLoading ? <div style={{textAlign:"center",padding:35}}><Spinner size={20} color={C.gold}/></div> : homePosts.length===0 ? (
          <div style={{background:card,borderRadius:16,padding:28,textAlign:"center",color:sub,border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`}}>لسه مفيش منشورات. كن أول واحد يشارك شغله.</div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(2,minmax(0,1fr))":"1fr",gap:11}}>
            {homePosts.map((p,idx)=><div key={p.id} style={{display:"contents"}}>
              {idx>0 && idx%4===0 && homeAds.length>0 && <div style={{gridColumn:isDesktop?"1 / -1":undefined}}><Ad3DCard ad={homeAds[Math.floor(idx/4)%homeAds.length]} variant="inline" darkMode={darkMode}/></div>}
              <article style={{background:card,borderRadius:16,border:\`1px solid \${darkMode?"rgba(201,168,76,.08)":C.grayLight}\`,overflow:"hidden"}}>
                <div style={{padding:13}}>
                  <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:9}}>
                    <Av text={p.author||"عضو"} size={39} type={p.type||"starter"}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div onClick={()=>p.authorId&&onMemberClick({id:p.authorId,name:p.author,specialty:p.specialty,type:p.type})} style={{fontWeight:800,color:tc,cursor:p.authorId?"pointer":"default",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.author||"عضو الدليل"}</div>
                      <div style={{fontSize:10.5,color:sub}}>{p.specialty||"عضو"}</div>
                    </div>
                  </div>
                  {p.content&&<p style={{color:darkMode?"rgba(255,255,255,.82)":"#334155",fontSize:12.5,lineHeight:1.8,margin:"0 0 8px",whiteSpace:"pre-wrap"}}>{p.content}</p>}
                  {p.images?.length>0&&<div style={{display:"grid",gridTemplateColumns:p.images.length===1?"1fr":"1fr 1fr",gap:3,borderRadius:10,overflow:"hidden",marginTop:8}}>{p.images.slice(0,4).map((img,i)=><img key={i} src={img} alt="صورة من المنشور" loading="lazy" style={{width:"100%",aspectRatio:p.images.length===1?"16/9":"1",objectFit:"cover"}}/>)}</div>}
                  {p.video&&<video src={p.video} controls preload="metadata" style={{width:"100%",borderRadius:10,marginTop:8,maxHeight:330,background:"#000"}}/>}
                </div>
                <div style={{display:"flex",borderTop:\`1px solid \${darkMode?"rgba(255,255,255,.06)":"#F0F0F0"}\`}}>
                  <button onClick={()=>likeHomePost(p)} style={{flex:1,padding:10,border:"none",background:"none",color:(p.likedBy||[]).includes(user?.uid)?C.error:sub,cursor:"pointer"}}>❤️ {p.likes||0}</button>
                  <button onClick={()=>setHomeSelectedPost(p)} style={{flex:1,padding:10,border:"none",background:"none",color:sub,cursor:"pointer"}}>💬 {p.comments||0}</button>
                </div>
              </article>
            </div>)}
          </div>
        )}
        {showHomeAddPost&&<AddPostModal user={user} darkMode={darkMode} onClose={()=>setShowHomeAddPost(false)} onPost={p=>setHomePosts(xs=>[p,...xs])}/>} 
        {homeSelectedPost&&<CommentsModal postId={homeSelectedPost.id} darkMode={darkMode} currentUser={user} onClose={()=>setHomeSelectedPost(null)}/>} 
      </section>

${articlesNeedle}`;

src = src.replace(articlesNeedle, postsSection);
fs.writeFileSync(file, src);
console.log('✓ restored homepage posts and advertising spaces');
