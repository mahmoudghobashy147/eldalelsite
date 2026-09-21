const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
const rulesPath = path.join(__dirname, "..", "firestore.rules");
let source = fs.readFileSync(appPath, "utf8");
let rules = fs.readFileSync(rulesPath, "utf8");
let changed = false;
let rulesChanged = false;

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`✓ \${label} already applied`);
    return;
  }
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`\${label}: expected exactly one source match, found \${count}`);
  source = source.replace(oldText, newText);
  changed = true;
  console.log(`✓ \${label} applied`);
}

// 1) Visitors should see the site first. Auth opens only when an action needs it.
replaceOnce(
`  const handleSplashDone = () => {
    setShowSplash(false);
    // لو داخل من لينك بروفايل مشارك، سيبه يشوفه على طول من غير ما نجبره يسجل دخول
    if (!user && !sharedMemberId) setShowAuth(true);
  };`,
`  const handleSplashDone = () => {
    setShowSplash(false);
    // الزائر يدخل المنصة مباشرة. تسجيل الدخول يظهر فقط لما يطلب إجراء يحتاج حساب.
  };`,
"stop forced auth after splash"
);

// 2) Keep desktop header focused on the five marketplace destinations.
replaceOnce(
`const DesktopNavBar = ({ tabs, activeTab, onNavigate, user, onLogout, onShowAuth, onShowPayment, darkMode, onToggleDark }) => {
  const cfg = useConfig();`,
`const DesktopNavBar = ({ tabs, activeTab, onNavigate, user, onLogout, onShowAuth, onShowPayment, darkMode, onToggleDark }) => {
  const cfg = useConfig();
  const desktopMainTabs = [
    {id:"home", label:"الرئيسية"},
    {id:"search", label:"الدليل"},
    {id:"products", label:"المنتجات"},
    {id:"quotes", label:"طلبات الأسعار"},
    {id:"jobs", label:"الوظائف"},
  ];`,
"define simplified desktop navigation"
);

replaceOnce(
`          <div className="desktop-nav-links">
            {tabs.map(t => (
              <div key={t.id} className={\`desktop-nav-link \${activeTab===t.id?"active":""}\`} onClick={()=>onNavigate(t.id)}>{t.label}</div>
            ))}
            <div onClick={()=>onNavigate("search")} title="بحث" style={{width:32,height:32,borderRadius:"50%",background:activeTab==="search"?C.gold:"rgba(201,168,76,.12)",color:activeTab==="search"?C.navyDeep:C.navy,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,flexShrink:0,transition:"all .18s"}}>🔍</div>`,
`          <div className="desktop-nav-links">
            {desktopMainTabs.map(t => (
              <div key={t.id} className={\`desktop-nav-link \${activeTab===t.id?"active":""}\`} onClick={()=>onNavigate(t.id)}>{t.label}</div>
            ))}`,
"simplify desktop header links"
);

// 3) Hide meaningless zero ratings from member cards.
replaceOnce(
`          <div style={{display:"flex",gap:4,alignItems:"center"}}><StarRating rating={member.rating} size={12}/><span style={{fontSize:11.5,fontWeight:700,color:C.gold}}>{member.rating}</span><span style={{fontSize:10.5,color:C.gray}}>({member.reviews})</span></div>`,
`          {(Number(member.reviews)||0)>0 ? <div style={{display:"flex",gap:4,alignItems:"center"}}><StarRating rating={member.rating} size={12}/><span style={{fontSize:11.5,fontWeight:700,color:C.gold}}>{member.rating}</span><span style={{fontSize:10.5,color:C.gray}}>({member.reviews})</span></div> : <span/>}`,
"hide zero rating on member cards"
);

replaceOnce(
`          <div style={{display:"flex",gap:4,alignItems:"center"}}><StarRating rating={member.rating} size={12}/><span style={{fontSize:11.5,fontWeight:700,color:planC}}>{member.rating}</span><span style={{fontSize:10.5,color:C.gray}}>({member.reviews})</span></div>`,
`          {(Number(member.reviews)||0)>0 ? <div style={{display:"flex",gap:4,alignItems:"center"}}><StarRating rating={member.rating} size={12}/><span style={{fontSize:11.5,fontWeight:700,color:planC}}>{member.rating}</span><span style={{fontSize:10.5,color:C.gray}}>({member.reviews})</span></div> : <span/>}`,
"hide zero rating on partner cards"
);

// 4) Add verified / available / nearest search filters.
replaceOnce(
`  const [mtype, setMtype] = useState(initialFilters.type||"");
  const [sort, setSort] = useState("priority");`,
`  const [mtype, setMtype] = useState(initialFilters.type||"");
  const [verifiedOnly, setVerifiedOnly] = useState(Boolean(initialFilters.verified));
  const [availableOnly, setAvailableOnly] = useState(Boolean(initialFilters.available));
  const [nearestOnly, setNearestOnly] = useState(Boolean(initialFilters.nearest));
  const [geo, setGeo] = useState(null);
  const [sort, setSort] = useState("priority");`,
"add marketplace search filter state"
);

replaceOnce(
`  const doSearch = useCallback(async () => {
    setLoading(true);
    const data = await DB.getMembers({ query:dq, gov, specialty, category, type:mtype, sort });
    let filtered = minRating>0 ? data.filter(m=>m.rating>=minRating) : data;
    if (city) filtered = filtered.filter(m=>m.city===city);
    setResults(filtered);
    setLoading(false);
  }, [dq, gov, specialty, category, mtype, sort, minRating, city]);

  useEffect(()=>{ doSearch(); }, [doSearch]);`,
`  const doSearch = useCallback(async () => {
    setLoading(true);
    const data = await DB.getMembers({ query:dq, gov, specialty, category, type:mtype, sort });
    let filtered = minRating>0 ? data.filter(m=>m.rating>=minRating) : data;
    if (city) filtered = filtered.filter(m=>m.city===city);
    if (verifiedOnly) filtered = filtered.filter(m=>m.verified===true);
    if (availableOnly) filtered = filtered.filter(m=>m.availableNow===true || m.available===true);
    if (nearestOnly && geo) {
      const distance = (m) => {
        const lat = Number(m.lat ?? m.latitude ?? m.location?.lat);
        const lng = Number(m.lng ?? m.longitude ?? m.location?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY;
        const r = Math.PI/180;
        const dLat = (lat-geo.lat)*r;
        const dLng = (lng-geo.lng)*r;
        const a = Math.sin(dLat/2)**2 + Math.cos(geo.lat*r)*Math.cos(lat*r)*Math.sin(dLng/2)**2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };
      filtered = [...filtered].sort((a,b)=>distance(a)-distance(b));
    }
    setResults(filtered);
    setLoading(false);
  }, [dq, gov, specialty, category, mtype, sort, minRating, city, verifiedOnly, availableOnly, nearestOnly, geo]);

  useEffect(() => {
    if (!nearestOnly || geo || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGeo({lat:pos.coords.latitude,lng:pos.coords.longitude}),
      () => setNearestOnly(false),
      { enableHighAccuracy:false, timeout:7000, maximumAge:300000 }
    );
  }, [nearestOnly, geo]);

  useEffect(()=>{ doSearch(); }, [doSearch]);`,
"apply verified available nearest filters"
);

replaceOnce(
`        </div>
        {!isDesktop && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:9}}>`,
`        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          <button type="button" className={\`chip \${verifiedOnly?"active":""}\`} onClick={()=>setVerifiedOnly(v=>!v)}>✅ موثق</button>
          <button type="button" className={\`chip \${availableOnly?"active":""}\`} onClick={()=>setAvailableOnly(v=>!v)}>🟢 متاح الآن</button>
          <button type="button" className={\`chip \${nearestOnly?"active":""}\`} onClick={()=>setNearestOnly(v=>!v)}>📍 الأقرب لي</button>
        </div>
        {!isDesktop && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:9}}>`,
"render quick search filters"
);

// 5) Replace the old social-heavy home with a marketplace home, keeping the old implementation as an unused fallback.
if (!source.includes("const LegacyHomeScreen =")) {
  const oldDecl = `const HomeScreen = ({ onNavigate, onMemberClick, darkMode, user, onRequireAuth }) => {`;
  const count = source.split(oldDecl).length - 1;
  if (count !== 1) throw new Error(`marketplace home: expected old HomeScreen once, found \${count}`);

  const marketplace = `
const PRODUCT_CATEGORIES = [
  {id:"ceramic",icon:"◫",label:"سيراميك وبورسلين",desc:"أرضيات وحوائط ومقاسات متنوعة"},
  {id:"marble",icon:"◆",label:"رخام وجرانيت",desc:"محلي ومستورد وتشطيبات متعددة"},
  {id:"sanitary",icon:"◉",label:"أدوات صحية",desc:"أحواض وقواعد وإكسسوارات"},
  {id:"mixers",icon:"⌁",label:"خلاطات",desc:"مطابخ وحمامات وموديلات حديثة"},
  {id:"paints",icon:"▰",label:"دهانات",desc:"داخلي وخارجي ومواد تجهيز"},
  {id:"lighting",icon:"✦",label:"إضاءة",desc:"داخلي وخارجي وLED"},
  {id:"doors",icon:"▥",label:"أبواب وشبابيك",desc:"خشب وألوميتال وUPVC"},
  {id:"electrical",icon:"ϟ",label:"كهرباء وسباكة",desc:"مستلزمات وأدوات تنفيذ"},
  {id:"building",icon:"▦",label:"مواد بناء",desc:"أسمنت وحديد وطوب وعزل"},
];

const MarketplaceMemberPreview = ({ member, onClick, darkMode }) => {
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.48)":C.gray;
  const plan = getMemberPlan(member);
  return <div onClick={()=>onClick(member)} style={{background:darkMode?C.cardBg:"white",borderRadius:16,padding:14,border:\`1px solid \${darkMode?"rgba(201,168,76,.11)":C.grayLight}\`,cursor:"pointer",boxShadow:"0 5px 18px rgba(13,31,60,.06)",transition:"transform .2s"}}
    onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
    <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <Av text={member.name} size={48} type={plan} src={member.avatarUrl}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:13.5,color:tc,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.name}{member.verified&&" ✅"}</div>
        <div style={{fontSize:11.5,color:sub,marginTop:2}}>{member.specialty||"مقدم خدمة"}</div>
        <div style={{fontSize:10.5,color:sub,marginTop:4}}>📍 {member.gov||"مصر"}{member.city?\` - \${member.city}\`:""}</div>
      </div>
      <span style={{color:C.gold,fontSize:20}}>←</span>
    </div>
    {(Number(member.reviews)||0)>0&&<div style={{marginTop:9,display:"flex",gap:5,alignItems:"center"}}><StarRating rating={member.rating} size={11}/><span style={{fontSize:10.5,color:sub}}>({member.reviews})</span></div>}
  </div>;
};

const HomeScreen = ({ onNavigate, onMemberClick, darkMode, user, onRequireAuth, onRequestQuote }) => {
  const isDesktop = useIsDesktop();
  const [members,setMembers] = useState([]);
  const [loading,setLoading] = useState(true);
  const [searchType,setSearchType] = useState("service");
  const [searchText,setSearchText] = useState("");
  const [gov,setGov] = useState("");
  const bg = darkMode?C.navyDeep:"#F7F8FA";
  const card = darkMode?C.cardBg:"white";
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.52)":C.gray;

  useEffect(()=>{
    DB.getMembers().then(setMembers).catch(()=>setMembers([])).finally(()=>setLoading(false));
  },[]);

  const approved = members.filter(m=>m.status==="approved");
  const verified = approved.filter(m=>m.verified===true);
  const featured = (verified.length?verified:approved).slice(0,isDesktop?8:4);

  const runSearch = () => {
    if (searchType==="product") onNavigate("products",{query:searchText,gov});
    else onNavigate("search",{query:searchText,gov});
  };

  const sectionTitle = (title,desc,action) => <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:12,marginBottom:14}}>
    <div><h2 style={{fontFamily:"'Cairo'",fontSize:isDesktop?22:18,fontWeight:900,color:tc,margin:0}}>{title}</h2>{desc&&<div style={{color:sub,fontSize:11.5,marginTop:4}}>{desc}</div>}<div className="gold-line"/></div>
    {action}
  </div>;

  return <div style={{background:bg,minHeight:"100vh",paddingBottom:90}}>
    <section style={{background:\`linear-gradient(145deg,\${C.navyDeep},\${C.navy})\`,padding:isDesktop?"62px 24px 54px":"70px 15px 30px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",width:340,height:340,borderRadius:"50%",background:"rgba(255,193,7,.08)",top:-160,left:-90}}/>
      <div className={isDesktop?"desktop-container":undefined} style={{position:"relative",zIndex:1,maxWidth:1050,margin:"0 auto",textAlign:"center"}}>
        <div style={{color:C.gold,fontSize:12,fontWeight:800,marginBottom:10}}>منصة التشطيبات والبناء في مصر</div>
        <h1 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isDesktop?38:27,lineHeight:1.35,color:"white",margin:"0 0 10px"}}>كل احتياجات البناء والتشطيب في مكان واحد</h1>
        <p style={{color:"rgba(255,255,255,.7)",fontSize:isDesktop?15:12.5,margin:"0 auto 24px",maxWidth:650}}>صنايعية – شركات – موردين – منتجات وخامات</p>
        <div style={{background:"white",borderRadius:18,padding:isDesktop?12:10,display:"grid",gridTemplateColumns:isDesktop?"170px 1fr 190px auto":"1fr",gap:8,boxShadow:"0 18px 44px rgba(0,0,0,.2)",textAlign:"right"}}>
          <select value={searchType} onChange={e=>setSearchType(e.target.value)} style={{border:"1px solid #E5E7EB",borderRadius:12,padding:"11px",fontFamily:"'Cairo'",background:"#fff",color:C.navy}}><option value="service">صنايعي أو شركة</option><option value="product">منتج أو خامة</option></select>
          <input value={searchText} onChange={e=>setSearchText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runSearch()} placeholder={searchType==="product"?"مثال: بورسلين 60×120":"مثال: كهربائي أو شركة تشطيبات"} style={{border:"1px solid #E5E7EB",borderRadius:12,padding:"11px 13px",fontFamily:"'Cairo'",outline:"none",minWidth:0}}/>
          <select value={gov} onChange={e=>setGov(e.target.value)} style={{border:"1px solid #E5E7EB",borderRadius:12,padding:"11px",fontFamily:"'Cairo'",background:"#fff",color:C.navy}}><option value="">كل المحافظات</option>{GOVERNORATES.map(g=><option key={g} value={g}>{g}</option>)}</select>
          <button onClick={runSearch} className="btn btn-primary" style={{borderRadius:12,padding:"11px 20px",whiteSpace:"nowrap"}}>ابحث الآن</button>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:9,flexWrap:"wrap",marginTop:13}}>
          <button className="btn btn-primary" onClick={runSearch}>🔍 ابحث الآن</button>
          <button className="btn btn-outline" onClick={onRequestQuote} style={{background:"rgba(255,255,255,.08)",color:"white",borderColor:"rgba(255,255,255,.25)"}}>🧾 اطلب عرض سعر</button>
        </div>
      </div>
    </section>

    <main className={isDesktop?"desktop-container":undefined} style={{maxWidth:1120,margin:"0 auto",padding:isDesktop?"34px 28px":"22px 14px"}}>
      <section style={{marginBottom:34}}>
        {sectionTitle("الأقسام الرئيسية","ابدأ من نوع احتياجك")}
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(4,1fr)":"repeat(2,1fr)",gap:10}}>
          {[
            ["🔧","الصنايعية","اعثر على فني حسب التخصص والمنطقة",()=>onNavigate("search")],
            ["🏢","الشركات والموردون","شركات تشطيب ومصانع وموردون",()=>onNavigate("search",{category:"company"})],
            ["▦","الخامات والمنتجات","قارن المنتجات قبل التواصل",()=>onNavigate("products")],
            ["🧾","طلبات الأسعار","اطلب أكتر من عرض قبل ما تختار",onRequestQuote],
          ].map(([icon,title,desc,action])=><div key={title} onClick={action} style={{background:card,borderRadius:17,padding:16,border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`,cursor:"pointer",minHeight:130}}><div style={{fontSize:29,marginBottom:9,color:C.gold}}>{icon}</div><div style={{fontWeight:900,fontFamily:"'Cairo'",fontSize:14,color:tc}}>{title}</div><div style={{fontSize:11,color:sub,lineHeight:1.6,marginTop:4}}>{desc}</div></div>)}
        </div>
      </section>

      <section style={{marginBottom:34}}>
        {sectionTitle("الصنايعية والشركات الموثقة","التواصل يظهر داخل صفحة مقدم الخدمة",<button className="btn btn-outline btn-sm" onClick={()=>onNavigate("search",{verified:true})}>عرض الكل</button>)}
        {loading?<div className="grid-2">{[1,2,3,4].map(i=><SkeletonCard key={i} dark={darkMode}/>)}</div>:featured.length?<div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(4,1fr)":"repeat(2,1fr)",gap:10}}>{featured.map(m=><MarketplaceMemberPreview key={m.id} member={m} onClick={onMemberClick} darkMode={darkMode}/>)}</div>:<div style={{padding:24,textAlign:"center",background:card,borderRadius:16,color:sub}}>هيظهر هنا الأعضاء بعد اعتماد ملفاتهم.</div>}
      </section>

      <section style={{marginBottom:34}}>
        {sectionTitle("اكتشف المنتجات","كتالوج خامات قابل للبحث والمقارنة",<button className="btn btn-outline btn-sm" onClick={()=>onNavigate("products")}>كل المنتجات</button>)}
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(5,1fr)":"repeat(3,1fr)",gap:9}}>{PRODUCT_CATEGORIES.map(c=><div key={c.id} onClick={()=>onNavigate("products",{category:c.id})} style={{background:card,borderRadius:15,padding:"14px 9px",border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`,textAlign:"center",cursor:"pointer"}}><div style={{fontSize:26,color:C.gold,marginBottom:7}}>{c.icon}</div><div style={{fontSize:11.5,fontWeight:800,color:tc}}>{c.label}</div></div>)}</div>
      </section>

      <section style={{marginBottom:34,display:"grid",gridTemplateColumns:isDesktop?"1.1fr .9fr":"1fr",gap:12}}>
        <div style={{background:\`linear-gradient(135deg,\${C.navy},\${C.navyDeep})\`,borderRadius:20,padding:isDesktop?25:19,color:"white"}}><div style={{color:C.gold,fontSize:12,fontWeight:800}}>طلبات أسعار</div><h3 style={{fontFamily:"'Cairo'",fontSize:20,margin:"6px 0"}}>بدل ما تسأل مكان مكان</h3><p style={{fontSize:12.5,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:14}}>اكتب احتياجك مرة واحدة، ونجهز النظام لاستقبال عروض من مقدمي الخدمة المناسبين.</p><button className="btn btn-primary" onClick={onRequestQuote}>اطلب عرض سعر</button></div>
        <div onClick={()=>onNavigate("community")} style={{background:card,borderRadius:20,padding:isDesktop?25:19,border:\`1px solid \${darkMode?"rgba(201,168,76,.12)":C.grayLight}\`,cursor:"pointer"}}><div style={{fontSize:30,marginBottom:8}}>🛠️</div><h3 style={{fontFamily:"'Cairo'",fontSize:18,color:tc,margin:"0 0 6px"}}>أعمال منفذة ومجتمع الدليل</h3><p style={{color:sub,fontSize:12,lineHeight:1.8}}>المنشورات، صور الأعمال، النصائح والعروض اتنقلت لمساحة منفصلة عشان الرئيسية تفضل واضحة وسريعة.</p><div style={{color:C.gold,fontWeight:800,fontSize:12,marginTop:10}}>ادخل مجتمع الدليل ←</div></div>
      </section>

      <section style={{marginBottom:34}}>
        {sectionTitle("مقالات ونصائح","قرارات تشطيب أذكى قبل الشراء والتنفيذ")}
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr",gap:10}}>{[
          ["اختيار الخامة المناسبة","قارن الاستخدام والمقاس ومعدل الهالك قبل ما تقارن السعر فقط."],
          ["قبل الاتفاق مع صنايعي","راجع الأعمال السابقة واتفق على نطاق الشغل والخامات والمدة كتابةً."],
          ["مقارنة عروض الأسعار","قارن نفس البنود والكميات بين كل عرض عشان المقارنة تبقى عادلة."],
        ].map(([title,text])=><div key={title} style={{background:card,borderRadius:15,padding:16,border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`}}><div style={{fontWeight:900,color:tc,fontFamily:"'Cairo'",fontSize:14,marginBottom:6}}>{title}</div><div style={{color:sub,fontSize:11.5,lineHeight:1.8}}>{text}</div></div>)}</div>
      </section>

      <section style={{background:darkMode?"rgba(255,193,7,.07)":"#FFF9E8",border:\`1px solid \${C.gold}55\`,borderRadius:20,padding:isDesktop?26:19,display:"flex",flexDirection:isDesktop?"row":"column",gap:14,alignItems:isDesktop?"center":"stretch",justifyContent:"space-between"}}><div><h3 style={{fontFamily:"'Cairo'",fontSize:18,color:tc,margin:"0 0 5px"}}>عندك نشاط أو متجر؟</h3><div style={{color:sub,fontSize:12}}>أضف نشاطك الآن، والمرحلة الجاية تقدر تضيف منتجاتك وكتالوجك وعروضك.</div></div><button className="btn btn-primary" onClick={()=>user?onNavigate("profile"):onRequireAuth()}>+ أضف نشاطك أو متجرك</button></section>
    </main>
  </div>;
};

const ProductsScreen = ({ initialFilters={}, darkMode, onRequestQuote, onBack }) => {
  const isDesktop = useIsDesktop();
  const [products,setProducts] = useState([]);
  const [loading,setLoading] = useState(true);
  const [queryText,setQueryText] = useState(initialFilters.query||"");
  const [category,setCategory] = useState(initialFilters.category||"");
  const bg = darkMode?C.navyDeep:C.offWhite;
  const card = darkMode?C.cardBg:"white";
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.48)":C.gray;
  useEffect(()=>{
    getDocs(query(collection(db,"products"),where("status","==","active"),limit(100)))
      .then(s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()}))))
      .catch(()=>setProducts([])).finally(()=>setLoading(false));
  },[]);
  const visible = products.filter(p=>{
    const q = queryText.trim().toLowerCase();
    const text = [p.name,p.code,p.manufacturer,p.storeName,p.color,p.finish].filter(Boolean).join(" ").toLowerCase();
    return (!category || p.category===category) && (!q || text.includes(q));
  });
  return <div style={{background:bg,minHeight:"100vh",paddingBottom:90}}>
    <div style={{background:\`linear-gradient(135deg,\${C.navyDeep},\${C.navy})\`,padding:isDesktop?"30px 24px":"55px 14px 22px"}}><div className={isDesktop?"desktop-container":undefined}><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:13}}>{onBack&&<button className="btn btn-outline btn-sm" onClick={onBack} style={{color:"white",borderColor:"rgba(255,255,255,.25)"}}>→</button>}<div><h1 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isDesktop?25:20,color:"white",margin:0}}>كتالوج الخامات والمنتجات</h1><div style={{color:"rgba(255,255,255,.58)",fontSize:11.5,marginTop:3}}>ابحث وقارن واطلب سعر — بدون دفع أونلاين</div></div></div><div className="search-bar"><button>🔍</button><input value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="اسم المنتج، الكود، الشركة المصنعة..."/></div></div></div>
    <div className={isDesktop?"desktop-container":undefined} style={{padding:isDesktop?"26px 28px":"18px 14px"}}><div className="scroll-x" style={{marginBottom:18}}><button className={\`chip \${category===""?"active":""}\`} onClick={()=>setCategory("")}>الكل</button>{PRODUCT_CATEGORIES.map(c=><button key={c.id} className={\`chip \${category===c.id?"active":""}\`} onClick={()=>setCategory(c.id)}>{c.label}</button>)}</div>
      {loading?<div style={{textAlign:"center",padding:50}}><Spinner/></div>:visible.length?<div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr 1fr",gap:11}}>{visible.map(p=><div key={p.id} style={{background:card,borderRadius:16,overflow:"hidden",border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`}}>{p.images?.[0]&&<img src={p.images[0]} alt={p.name||"منتج"} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover"}}/>}<div style={{padding:13}}><div style={{fontWeight:900,color:tc,fontSize:14}}>{p.name||"منتج"}</div><div style={{fontSize:10.5,color:sub,marginTop:3}}>{p.manufacturer||p.storeName||""}{p.code?\` • كود \${p.code}\`:""}</div><div style={{fontSize:11,color:sub,lineHeight:1.7,marginTop:7}}>{[p.size,p.thickness,p.finish,p.usage].filter(Boolean).join(" • ")}</div><div style={{color:C.gold,fontWeight:900,fontSize:13,marginTop:8}}>{p.price?\`\${p.price} ج\${p.priceUnit?\` / \${p.priceUnit}\`:""}\`:"اسأل عن السعر"}</div><button className="btn btn-primary btn-sm" style={{width:"100%",marginTop:9}} onClick={onRequestQuote}>اطلب عرض سعر</button></div></div>)}</div>:<div style={{background:card,borderRadius:18,padding:"38px 20px",textAlign:"center",border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`}}><div style={{fontSize:42,marginBottom:10}}>▦</div><div style={{fontFamily:"'Cairo'",fontWeight:900,color:tc,marginBottom:5}}>الكتالوج جاهز لاستقبال المنتجات</div><div style={{color:sub,fontSize:12,lineHeight:1.8,maxWidth:480,margin:"0 auto 14px"}}>مفيش منتجات منشورة في القسم ده حاليًا. أول ما الإدارة تضيف منتجات نشطة هتظهر هنا تلقائيًا.</div><button className="btn btn-primary" onClick={onRequestQuote}>اطلب سعر لخامة دلوقتي</button></div>}
    </div>
  </div>;
};

const QuotesScreen = ({ darkMode, onRequestQuote, onBack }) => {
  const isDesktop=useIsDesktop(); const bg=darkMode?C.navyDeep:C.offWhite; const card=darkMode?C.cardBg:"white"; const tc=darkMode?"white":C.navy; const sub=darkMode?"rgba(255,255,255,.48)":C.gray;
  return <div style={{background:bg,minHeight:"100vh",paddingBottom:90}}><div style={{background:\`linear-gradient(135deg,\${C.navyDeep},\${C.navy})\`,padding:isDesktop?"38px 24px":"60px 15px 28px",textAlign:"center"}}>{onBack&&<button className="btn btn-outline btn-sm" onClick={onBack} style={{position:"absolute",right:14,color:"white",borderColor:"rgba(255,255,255,.25)"}}>→</button>}<div style={{color:C.gold,fontWeight:800,fontSize:12}}>طلب واحد بدل عشر مكالمات</div><h1 style={{fontFamily:"'Cairo'",fontSize:isDesktop?30:23,color:"white",margin:"7px 0"}}>اطلب عرض سعر من أكتر من مقدم خدمة</h1><p style={{color:"rgba(255,255,255,.65)",fontSize:12.5}}>اكتب المطلوب والمحافظة، وسيتم توجيه الطلب لمقدمي الخدمة المناسبين بدون نشر رقمك للعامة.</p><button className="btn btn-primary" style={{marginTop:15}} onClick={onRequestQuote}>ابدأ طلب عرض السعر</button></div><div className={isDesktop?"desktop-container":undefined} style={{padding:isDesktop?"32px 28px":"22px 14px"}}><div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr",gap:11}}>{[["1","اكتب احتياجك","حدد نوع الشغل أو الخامة والمنطقة."],["2","يوصل للمناسبين","نطابق الطلب مع التخصص والمحافظة."],["3","قارن قبل القرار","اختار العرض والتواصل الأنسب ليك."]].map(([n,t,d])=><div key={n} style={{background:card,borderRadius:17,padding:18,border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`}}><div style={{width:34,height:34,borderRadius:"50%",background:C.gold,color:C.navyDeep,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,marginBottom:10}}>{n}</div><div style={{fontFamily:"'Cairo'",fontWeight:900,color:tc,fontSize:15}}>{t}</div><div style={{color:sub,fontSize:12,lineHeight:1.8,marginTop:5}}>{d}</div></div>)}</div></div></div>;
};

const CommunityScreen = ({ darkMode, user, onRequireAuth, onMemberClick }) => {
  const isDesktop=useIsDesktop(); const [posts,setPosts]=useState([]); const [loading,setLoading]=useState(true); const [showAddPost,setShowAddPost]=useState(false); const [selected,setSelected]=useState(null);
  const bg=darkMode?C.navyDeep:C.offWhite; const card=darkMode?C.cardBg:"white"; const tc=darkMode?"white":C.navy; const sub=darkMode?"rgba(255,255,255,.48)":C.gray;
  const load=()=>DB.getPosts().then(r=>setPosts(r.posts||[])).catch(()=>setPosts([])).finally(()=>setLoading(false));
  useEffect(()=>{load();},[]);
  const add=()=>{if(!user)return onRequireAuth();setShowAddPost(true);};
  const like=(p)=>{if(!user)return onRequireAuth();const liked=(p.likedBy||[]).includes(user.uid);setPosts(xs=>xs.map(x=>x.id===p.id?{...x,likedBy:liked?(x.likedBy||[]).filter(id=>id!==user.uid):[...(x.likedBy||[]),user.uid],likes:liked?Math.max(0,(x.likes||1)-1):(x.likes||0)+1}:x));DB.likePost(p.id,user.uid);};
  return <div style={{background:bg,minHeight:"100vh",paddingBottom:90}}><div style={{background:\`linear-gradient(135deg,\${C.navyDeep},\${C.navy})\`,padding:isDesktop?"28px 24px":"55px 14px 20px"}}><div className={isDesktop?"desktop-container":undefined}><h1 style={{fontFamily:"'Cairo'",fontWeight:900,color:"white",fontSize:isDesktop?25:20,margin:0}}>مجتمع الدليل</h1><div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginTop:4}}>أعمال منفذة، خبرات، صور وعروض من أعضاء المنصة</div></div></div><div style={{maxWidth:760,margin:"0 auto",padding:"18px 14px"}}><div style={{background:card,borderRadius:15,padding:13,border:\`1px solid \${darkMode?"rgba(201,168,76,.1)":C.grayLight}\`,marginBottom:13,display:"flex",gap:9,alignItems:"center"}}><Av text={user?.displayName||"؟"} size={40} type="starter"/><button onClick={add} style={{flex:1,border:"none",borderRadius:22,padding:"10px 14px",background:darkMode?"rgba(255,255,255,.06)":"#F3F4F6",color:sub,textAlign:"right",fontFamily:"'Cairo'",cursor:"pointer"}}>{user?"شارك أحدث أعمالك أو خبرتك...":"سجّل دخولك للمشاركة..."}</button></div>{loading?<div style={{textAlign:"center",padding:50}}><Spinner/></div>:posts.length===0?<div style={{background:card,borderRadius:16,padding:35,textAlign:"center",color:sub}}>لسه مفيش منشورات. كن أول واحد يشارك شغله.</div>:posts.map(p=><div key={p.id} style={{background:card,borderRadius:16,marginBottom:11,border:\`1px solid \${darkMode?"rgba(201,168,76,.08)":C.grayLight}\`,overflow:"hidden"}}><div style={{padding:13}}><div style={{display:"flex",gap:9,alignItems:"center",marginBottom:9}}><Av text={p.author} size={40} type={p.type||"starter"}/><div style={{flex:1}}><div onClick={()=>p.authorId&&onMemberClick({id:p.authorId,name:p.author,specialty:p.specialty,type:p.type})} style={{fontWeight:800,color:tc,cursor:"pointer"}}>{p.author}</div><div style={{fontSize:10.5,color:sub}}>{p.specialty||"عضو"}</div></div></div><p style={{color:darkMode?"rgba(255,255,255,.8)":"#334155",fontSize:13,lineHeight:1.8}}>{p.content}</p>{p.images?.length>0&&<div style={{display:"grid",gridTemplateColumns:p.images.length===1?"1fr":"1fr 1fr",gap:3,borderRadius:10,overflow:"hidden",marginTop:8}}>{p.images.slice(0,4).map((img,i)=><img key={i} src={img} alt="" style={{width:"100%",aspectRatio:p.images.length===1?"16/9":"1",objectFit:"cover"}}/>)}</div>}{p.video&&<video src={p.video} controls style={{width:"100%",borderRadius:10,marginTop:8,maxHeight:330,background:"#000"}}/>}</div><div style={{display:"flex",borderTop:\`1px solid \${darkMode?"rgba(255,255,255,.06)":"#F0F0F0"}\`}}><button onClick={()=>like(p)} style={{flex:1,padding:10,border:"none",background:"none",color:(p.likedBy||[]).includes(user?.uid)?C.error:sub,cursor:"pointer"}}>❤️ {p.likes||0}</button><button onClick={()=>setSelected(p)} style={{flex:1,padding:10,border:"none",background:"none",color:sub,cursor:"pointer"}}>💬 {p.comments||0}</button></div></div>)}</div>{showAddPost&&<AddPostModal user={user} darkMode={darkMode} onClose={()=>setShowAddPost(false)} onPost={p=>setPosts(xs=>[p,...xs])}/>} {selected&&<CommentsModal postId={selected.id} darkMode={darkMode} currentUser={user} onClose={()=>setSelected(null)}/>}</div>;
};

const LegacyHomeScreen = ({ onNavigate, onMemberClick, darkMode, user, onRequireAuth }) => {`;

  source = source.replace(oldDecl, marketplace);
  changed = true;
  console.log("✓ marketplace home/products/quotes/community screens added");
} else {
  console.log("✓ marketplace screens already applied");
}

// 6) Wire new screens into the main app and pass quote action into the new home.
replaceOnce(
`          {activeTab==="home"&&<ErrorBoundary><HomeScreen onNavigate={navigate} onMemberClick={handleMemberClick} darkMode={darkMode} user={user} onRequireAuth={()=>setShowAuth(true)}/></ErrorBoundary>}`,
`          {activeTab==="home"&&<ErrorBoundary><HomeScreen onNavigate={navigate} onMemberClick={handleMemberClick} darkMode={darkMode} user={user} onRequireAuth={()=>setShowAuth(true)} onRequestQuote={()=>setShowQuickRequest(true)}/></ErrorBoundary>}`,
"wire quote action into marketplace home"
);

replaceOnce(
`            {activeTab==="search"&&<ErrorBoundary><SearchScreen initialFilters={searchFilters} onMemberClick={handleMemberClick} darkMode={darkMode}/></ErrorBoundary>}`,
`            {activeTab==="search"&&<ErrorBoundary><SearchScreen initialFilters={searchFilters} onMemberClick={handleMemberClick} darkMode={darkMode}/></ErrorBoundary>}
            {activeTab==="products"&&<ErrorBoundary><ProductsScreen initialFilters={searchFilters} darkMode={darkMode} onRequestQuote={()=>setShowQuickRequest(true)} onBack={()=>setActiveTab("home")}/></ErrorBoundary>}
            {activeTab==="quotes"&&<ErrorBoundary><QuotesScreen darkMode={darkMode} onRequestQuote={()=>setShowQuickRequest(true)} onBack={()=>setActiveTab("home")}/></ErrorBoundary>}
            {activeTab==="community"&&<ErrorBoundary><CommunityScreen darkMode={darkMode} user={user} onRequireAuth={()=>setShowAuth(true)} onMemberClick={handleMemberClick}/></ErrorBoundary>}`,
"wire marketplace screens"
);

// Only show the general static footer on the marketplace home.
// (No source change needed; it is already gated by activeTab === home.)

if (changed) fs.writeFileSync(appPath, source, "utf8");

// 7) Public catalog: visitors may read active stores/products; only admins can manage them.
const rulesMarker = `    // ----------------------------------------------------------\n    // PAYMENTS / ADS\n    // ----------------------------------------------------------`;
const catalogRules = `    // ----------------------------------------------------------\n    // PRODUCT CATALOG + STORES\n    // Public visitors may only read published entries. Management stays admin-only.\n    // ----------------------------------------------------------\n    match /products/{productId} {\n      allow read: if resource.data.get('status', '') == 'active';\n      allow create, update, delete: if isAdmin();\n    }\n\n    match /stores/{storeId} {\n      allow read: if resource.data.get('status', '') == 'active';\n      allow create, update, delete: if isAdmin();\n    }\n\n`;
if (!rules.includes("match /products/{productId}")) {
  const count = rules.split(rulesMarker).length - 1;
  if (count !== 1) throw new Error(`catalog rules: expected marker once, found \${count}`);
  rules = rules.replace(rulesMarker, catalogRules + rulesMarker);
  rulesChanged = true;
  console.log("✓ product/store catalog rules added");
} else {
  console.log("✓ product/store catalog rules already applied");
}
if (rulesChanged) fs.writeFileSync(rulesPath, rules, "utf8");

console.log(changed || rulesChanged ? "Marketplace patches written" : "Marketplace patches already present");
