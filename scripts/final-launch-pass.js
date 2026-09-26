const fs = require('fs');
const path = require('path');

const homeFile = path.join(process.cwd(), 'src', 'HomeLanding.jsx');
const appFile = path.join(process.cwd(), 'src', 'App.jsx');

function patchHome() {
  if (!fs.existsSync(homeFile)) return;
  let s = fs.readFileSync(homeFile, 'utf8');

  // Unified navigation: never open the legacy ?app=1 shell.
  s = s.replace(/const goApp=tab=>\{[^\n]*\};/, `const goApp=tab=>{\n    const routes={login:"/login",signin:"/login",notifications:"/notifications",search:"/search",profile:"/profile",suppliers:"/suppliers",posts:"/#feed",menu:"/#sections",admin:"/admin"};\n    window.location.href=routes[tab]||"/";\n  };`);
  s = s.replace('const doSearch=()=>{ const q=search.trim(); if(q) window.location.href=`/specialties/${encodeURIComponent(q)}`; };', 'const doSearch=()=>{ const q=search.trim(); if(q) window.location.href=`/search?q=${encodeURIComponent(q)}`; };');
  s = s.replace('const url=`${window.location.origin}/?app=1#posts`;', 'const url=`${window.location.origin}/#feed`;');
  s = s.replace('if(!user){ window.location.href="/?app=1#login"; return; }', 'if(!user){ window.location.href="/login"; return; }');
  s = s.replace('<section className="dl-shortcuts">', '<section id="sections" className="dl-shortcuts">');

  // Session-aware header so account/admin tools stay visible on the new UI.
  if (!s.includes('const sessionUser = useMemo')) {
    s = s.replace('  const [commentsPost,setCommentsPost] = useState(null);', `  const [commentsPost,setCommentsPost] = useState(null);\n  const sessionUser = useMemo(()=>{ try { const raw=localStorage.getItem("daleel_user"); return raw?JSON.parse(raw):null; } catch { return null; } },[]);`);
  }
  s = s.replace(
    '<button className="dl-icon" aria-label="الإشعارات" onClick={()=>goApp("notifications")}><Icon name="bell"/></button>\n            <button className="dl-login" onClick={()=>goApp("login")}>تسجيل الدخول</button>\n            <button className="dl-icon" aria-label="القائمة" onClick={()=>goApp("menu")}><Icon name="menu"/></button>',
    '<button className="dl-icon" aria-label="الإشعارات" onClick={()=>goApp("notifications")}><Icon name="bell"/></button>\n            {sessionUser?.isAdmin&&<button className="dl-login" onClick={()=>goApp("admin")}>الإدارة</button>}\n            <button className="dl-login" onClick={()=>goApp(sessionUser?"profile":"login")}>{sessionUser?"حسابي":"تسجيل الدخول"}</button>\n            <button className="dl-icon" aria-label="القائمة" onClick={()=>goApp("menu")}><Icon name="menu"/></button>'
  );

  // Main ad + two smaller ads underneath; all three advance together automatically.
  if (!s.includes('const thirdAd=')) {
    s = s.replace('  const secondAd=ads[(adIndex+1)%ads.length]||FALLBACK_ADS[1];', '  const secondAd=ads[(adIndex+1)%ads.length]||FALLBACK_ADS[1];\n  const thirdAd=ads[(adIndex+2)%ads.length]||FALLBACK_ADS[2]||FALLBACK_ADS[0];');
  }

  const oldSecond = `        <button className="dl-ad-second" onClick={()=>openAd(secondAd)}>\n          <img src={clean(secondAd.imageUrl||secondAd.image||secondAd.bannerUrl)||FALLBACK_ADS[1].imageUrl} alt={clean(secondAd.title)||"إعلان"}/>\n          <div className="dl-ad-shade second"/>\n          <span className="dl-ad-badge">إعلان</span>\n          <div className="dl-ad-copy small"><h3>{clean(secondAd.title)||"إعلان مميز"}</h3><span>عرض التفاصيل <Icon name="arrow" size={16}/></span></div>\n        </button>`;
  const newSecond = `        <div className="dl-ad-pair">\n          {[secondAd,thirdAd].map((ad,i)=><button className="dl-ad-mini" key={ad?.id||i} onClick={()=>openAd(ad)}>\n            <img src={clean(ad?.imageUrl||ad?.image||ad?.bannerUrl)||FALLBACK_ADS[(i+1)%FALLBACK_ADS.length].imageUrl} alt={clean(ad?.title)||"إعلان"}/>\n            <div className="dl-ad-shade second"/>\n            <span className="dl-ad-badge">إعلان</span>\n            <div className="dl-ad-copy small"><h3>{clean(ad?.title)||"إعلان مميز"}</h3><span>عرض التفاصيل <Icon name="arrow" size={16}/></span></div>\n          </button>)}\n        </div>`;
  if (s.includes(oldSecond)) s = s.replace(oldSecond, newSecond);

  // If the 5-card patch ran earlier in prebuild, replace that generated block too.
  s = s.replace(/\s*<div className="dl-ad-row" aria-label="الإعلانات المميزة">[\s\S]*?<\/div>\s*(?=<div className="dl-dots">)/, `\n        <button className="dl-ad-main" onClick={()=>openAd(currentAd)}>\n          <img src={clean(currentAd.imageUrl||currentAd.image||currentAd.bannerUrl)||FALLBACK_ADS[0].imageUrl} alt={clean(currentAd.title)||"إعلان"}/>\n          <div className="dl-ad-shade"/>\n          <span className="dl-ad-badge">إعلان</span>\n          <div className="dl-ad-copy"><h3>{clean(currentAd.title)||"إعلان مميز"}</h3><p>{clean(currentAd.subtitle||currentAd.description)||"اعرف التفاصيل والخدمات"}</p><span>عرض التفاصيل <Icon name="arrow" size={17}/></span></div>\n        </button>\n        <div className="dl-ad-pair">\n          {[secondAd,thirdAd].map((ad,i)=><button className="dl-ad-mini" key={ad?.id||i} onClick={()=>openAd(ad)}>\n            <img src={clean(ad?.imageUrl||ad?.image||ad?.bannerUrl)||FALLBACK_ADS[(i+1)%FALLBACK_ADS.length].imageUrl} alt={clean(ad?.title)||"إعلان"}/>\n            <div className="dl-ad-shade second"/>\n            <span className="dl-ad-badge">إعلان</span>\n            <div className="dl-ad-copy small"><h3>{clean(ad?.title)||"إعلان مميز"}</h3><span>عرض التفاصيل <Icon name="arrow" size={16}/></span></div>\n          </button>)}\n        </div>\n`);

  // Final ad styling.
  s = s.replace(/\.dl-ad-main,\.dl-ad-second\{[^\n]*\.dl-ad-copy\.small h3\{font-size:22px\}/, `.dl-ad-main,.dl-ad-mini{position:relative;width:100%;padding:0;border:0;overflow:hidden;cursor:pointer;text-align:right;background:#102a3b}.dl-ad-main{height:390px;border-radius:20px}.dl-ad-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.dl-ad-mini{height:180px;border-radius:17px}.dl-ad-main img,.dl-ad-mini img{width:100%;height:100%;object-fit:cover;display:block}.dl-ad-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(4,24,40,.03),rgba(4,24,40,.16) 48%,rgba(4,24,40,.84))}.dl-ad-shade.second{background:linear-gradient(90deg,rgba(4,24,40,.02),rgba(4,24,40,.72))}.dl-ad-badge{position:absolute;top:15px;right:15px;background:var(--gold2);color:var(--navy);font-size:10px;font-weight:900;padding:6px 11px;border-radius:999px}.dl-ad-copy{position:absolute;right:28px;top:50%;transform:translateY(-50%);color:#fff;max-width:480px}.dl-ad-copy h3{margin:0 0 7px;font-size:32px;line-height:1.25;color:#fff}.dl-ad-copy p{margin:0 0 16px;color:rgba(255,255,255,.78);font-size:14px}.dl-ad-copy>span{display:inline-flex;align-items:center;gap:6px;background:var(--gold2);color:var(--navy);padding:10px 15px;border-radius:11px;font-weight:900}.dl-ad-copy.small h3{font-size:20px;color:#fff}`);
  s = s.replace(/\.dl-ad-row\{[^\n]*?\.dl-ad-card-copy p\{[^\n]*?text-overflow:ellipsis\}/, '.dl-ad-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.dl-ad-mini{position:relative;height:180px;padding:0;border:0;border-radius:17px;overflow:hidden;cursor:pointer;text-align:right;background:#102a3b}.dl-ad-mini img{width:100%;height:100%;object-fit:cover;display:block}');
  s = s.replace('.dl-ad-second{height:150px}', '.dl-ad-mini{height:150px}');
  s = s.replace('.dl-ad-second{height:120px;border-radius:14px;margin-top:9px}', '.dl-ad-pair{gap:8px;margin-top:8px}.dl-ad-mini{height:118px;border-radius:14px}');
  s = s.replace(/@media\(max-width:760px\)\{\.dl-ad-row\{[^}]+\}\.dl-ad-card\{[^}]+\}/, '@media(max-width:760px){.dl-ad-pair{grid-template-columns:1fr 1fr;gap:8px}.dl-ad-mini{height:118px}');
  s = s.replace(/@media\(max-width:1050px\)\{\.dl-ad-row\{[^}]+\}/, '@media(max-width:1050px){');

  fs.writeFileSync(homeFile, s);
}

function patchApp() {
  if (!fs.existsSync(appFile)) return;
  let s = fs.readFileSync(appFile, 'utf8');

  // Apply the new brand palette everywhere, including admin/search/notifications/profile pages.
  s = s.replace(/const C = \{[\s\S]*?\n\};\n\n\/\/ قائمة محافظات مصر/, `const C = {\n  navyDeep: "#06243B", navy: "#0B3554", navyLight: "#123F61",\n  gold: "#D7AA43", goldLight: "#F0CF7A", goldDark: "#B8862F",\n  white: "#FFFFFF", offWhite: "#F8F5EF", grayLight: "#E8E2D7", gray: "#6D7D8A",\n  cardBg: "#0B3554", success: "#22C55E", warning: "#F59E0B",\n  error: "#EF4444", info: "#3B82F6", purple: "#7C3AED", pink: "#EC4899",\n};\n\n// قائمة محافظات مصر`);

  // Faster web entry: no splash delay on the website, keep it only in the native app.
  s = s.replace('const [showSplash, setShowSplash] = useState(true);', 'const [showSplash, setShowSplash] = useState(() => Capacitor.isNativePlatform());');

  // Direct URLs open the correct functional page instead of the old home screen.
  s = s.replace('const [activeTab, setActiveTab] = useState("home");', `const [activeTab, setActiveTab] = useState(()=>{\n    const p=(window.location.pathname||"/").replace(/\\/+$/,"" )||"/";\n    const map={"/search":"search","/notifications":"notifications","/profile":"profile","/messages":"messages","/saved":"saved","/jobs":"jobs","/admin":"admin","/suppliers":"search"};\n    return map[p]||"home";\n  });`);
  s = s.replace('const [searchFilters, setSearchFilters] = useState({});', `const [searchFilters, setSearchFilters] = useState(()=>{\n    const p=(window.location.pathname||"/").replace(/\\/+$/,"" )||"/";\n    const q=new URLSearchParams(window.location.search).get("q")||"";\n    if(p==="/suppliers") return {type:"supplier"};\n    return q?{query:q}:{};\n  });`);

  // Keep route and tab state synchronized when browser navigation changes.
  const popBlock = `  useEffect(() => {\n    const onPop = () => setRouteInfo(parseCurrentPath());\n    window.addEventListener("popstate", onPop);\n    return () => window.removeEventListener("popstate", onPop);\n  }, []);`;
  if (s.includes(popBlock) && !s.includes('const directTabMap')) {
    s = s.replace(popBlock, `${popBlock}\n  useEffect(()=>{\n    const p=(window.location.pathname||"/").replace(/\\/+$/,"" )||"/";\n    const directTabMap={"/search":"search","/notifications":"notifications","/profile":"profile","/messages":"messages","/saved":"saved","/jobs":"jobs","/admin":"admin","/suppliers":"search"};\n    if(directTabMap[p]) {\n      setActiveTab(directTabMap[p]);\n      const q=new URLSearchParams(window.location.search).get("q")||"";\n      if(p==="/suppliers") setSearchFilters({type:"supplier"});\n      else if(p==="/search") setSearchFilters(q?{query:q}:{});\n    }\n  }, [routeInfo]);`);
  }

  // Notifications must be visible in the signed-in navigation.
  s = s.replace('{id:"search", icon:"🔍", label:"البحث"},\n    {id:"saved", icon:"❤️", label:"المحفوظة"},', '{id:"search", icon:"🔍", label:"البحث"},\n    {id:"notifications", icon:"🔔", label:"الإشعارات"},\n    {id:"saved", icon:"❤️", label:"المحفوظة"},');

  // Navigation uses real URLs, while still preserving the SPA behavior.
  const oldNavigate = `  const navigate = (tab, filters={}) => {\n    setActiveTab(tab);\n    setSearchFilters(filters);\n    trackPageView(\`/\${tab === "home" ? "" : tab}\`, tab); // تتبّع تنقل بين الأقسام الرئيسية للموقع\n  };`;
  const newNavigate = `  const navigate = (tab, filters={}) => {\n    setActiveTab(tab);\n    setSearchFilters(filters);\n    const pathMap={home:"/",search:"/search",notifications:"/notifications",profile:"/profile",messages:"/messages",saved:"/saved",jobs:"/jobs",admin:"/admin"};\n    const target=pathMap[tab]||\`/\${tab}\`;\n    if(window.location.pathname!==target) window.history.pushState({},"",target);\n    trackPageView(target, tab);\n  };`;
  if (s.includes(oldNavigate)) s = s.replace(oldNavigate, newNavigate);

  fs.writeFileSync(appFile, s);
}

patchHome();
patchApp();
console.log('Final launch pass applied: ads, routes, notifications, admin visibility, search and unified design.');
