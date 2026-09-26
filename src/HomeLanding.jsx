import React, { useEffect, useMemo, useRef, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, limit, query, where } from "firebase/firestore";
import { buildMemberPath } from "./seo";

const firebaseConfig = {
  apiKey: "AIzaSyA8Xrrp0N0CnDyI-0yvEYFVnh7HYCmH_PQ",
  authDomain: "eldalel-elshamel.firebaseapp.com",
  projectId: "eldalel-elshamel",
  storageBucket: "eldalel-elshamel.firebasestorage.app",
  messagingSenderId: "355717459859",
  appId: "1:355717459859:web:50ef5d6db4fe5a7425c266",
  measurementId: "G-P9BNJJSHVB"
};

const app = getApps()[0] || initializeApp(firebaseConfig);
const db = getFirestore(app);

const FALLBACK_ADS = [
  { id:"fallback-1", title:"مساحة إعلانية مميزة", subtitle:"اعرض خدماتك أمام عملاء مهتمين", imageUrl:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85" },
  { id:"fallback-2", title:"سيراميك وبورسلين", subtitle:"أحدث الموديلات والتشطيبات", imageUrl:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85" },
  { id:"fallback-3", title:"ألوميتال وواجهات", subtitle:"حلول عصرية للمباني والفلل", imageUrl:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85" },
  { id:"fallback-4", title:"دهانات وتشطيبات", subtitle:"ألوان وتشطيب بجودة عالية", imageUrl:"https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=85" },
  { id:"fallback-5", title:"جبس بورد وديكورات", subtitle:"تصميم وتنفيذ احترافي", imageUrl:"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85" },
];

const clean = v => String(v || "").trim();
const firstArrayImage = value => Array.isArray(value) && value.length ? (typeof value[0] === "string" ? value[0] : value[0]?.url || value[0]?.imageUrl) : "";
const memberImage = m => clean(
  m.coverImage || m.coverImageUrl || m.avatar || m.avatarUrl || m.profileImage || m.profileImageUrl || m.photo || m.photoUrl || m.image || m.imageUrl ||
  firstArrayImage(m.workImages) || firstArrayImage(m.portfolioImages) || firstArrayImage(m.gallery) || firstArrayImage(m.images)
);
const postImage = p => clean(p.imageUrl || p.image || p.photoUrl || p.mediaUrl || firstArrayImage(p.images) || firstArrayImage(p.media));
const memberType = m => {
  const t = clean(m.type || m.memberType || m.category).toLowerCase();
  if (t.includes("company") || t.includes("شركة") || t.includes("مقاول")) return "company";
  if (t.includes("supplier") || t.includes("مورد") || t.includes("مصنع") || t.includes("محل")) return "supplier";
  return "craftsman";
};
const isFeatured = m => Boolean(m.featured || m.isFeatured || m.promoted || m.isPromoted || ["pro","premium","business","featured"].includes(clean(m.plan).toLowerCase()));
const locationText = m => [m.governorate || m.gov, m.city, m.area].filter(Boolean).join(" • ") || "مصر";
const ratingValue = m => Number(m.rating || m.avgRating || 0);

export default function HomeLanding(){
  const [ads, setAds] = useState([]);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const adsRef = useRef(null);

  useEffect(()=>{
    let alive = true;
    (async()=>{
      try{
        const [mSnap,pSnap,aSnap] = await Promise.all([
          getDocs(query(collection(db,"members"), limit(100))),
          getDocs(query(collection(db,"posts"), limit(24))).catch(()=>null),
          getDocs(query(collection(db,"ads"), where("status","==","active"), limit(20))).catch(()=>null),
        ]);
        if(!alive) return;
        setMembers(mSnap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.status!=="rejected" && m.status!=="blocked"));
        setPosts(pSnap ? pSnap.docs.map(d=>({id:d.id,...d.data()})) : []);
        const rawAds = aSnap && !aSnap.empty ? aSnap.docs.map(d=>({id:d.id,...d.data()})) : [];
        const seen = new Set();
        const unique = rawAds.filter(ad=>{
          const key = clean(ad.imageUrl || ad.image || ad.bannerUrl) || `${clean(ad.title)}|${clean(ad.phone)}`;
          if(!key || seen.has(key)) return false;
          seen.add(key); return true;
        });
        setAds(unique.length ? unique : FALLBACK_ADS);
      } catch(e){
        console.warn("HomeLanding load error", e);
        if(alive) setAds(FALLBACK_ADS);
      } finally { if(alive) setLoading(false); }
    })();
    return()=>{ alive=false; };
  },[]);

  useEffect(()=>{
    if(ads.length < 2) return;
    const t = setInterval(()=>scrollAds(1), 4500);
    return()=>clearInterval(t);
  },[ads.length]);

  const featuredCrafts = useMemo(()=>{
    const list = members.filter(m=>memberType(m)==="craftsman");
    return [...list.filter(isFeatured), ...list.filter(m=>!isFeatured(m))].slice(0,8);
  },[members]);
  const featuredCompanies = useMemo(()=>{
    const list = members.filter(m=>memberType(m)==="company");
    return [...list.filter(isFeatured), ...list.filter(m=>!isFeatured(m))].slice(0,6);
  },[members]);
  const suppliers = useMemo(()=>{
    const list = members.filter(m=>memberType(m)==="supplier");
    return [...list.filter(isFeatured), ...list.filter(m=>!isFeatured(m))].slice(0,6);
  },[members]);

  const scrollAds = dir => {
    const el = adsRef.current;
    if(!el) return;
    const first = el.querySelector(".dl-ad-card");
    const amount = (first?.getBoundingClientRect().width || 300) + 16;
    const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 20;
    const nearStart = el.scrollLeft <= 20;
    if(dir > 0 && nearEnd) el.scrollTo({left:0,behavior:"smooth"});
    else if(dir < 0 && nearStart) el.scrollTo({left:el.scrollWidth,behavior:"smooth"});
    else el.scrollBy({left:dir*amount,behavior:"smooth"});
  };

  const openAd = ad => {
    const u = clean(ad.link || ad.url || ad.website || ad.targetUrl);
    if(u) window.open(u, "_blank", "noopener,noreferrer");
  };
  const openMember = m => { window.location.href = buildMemberPath(m); };
  const goApp = tab => { window.location.href = `/?app=1${tab?`#${tab}`:""}`; };
  const doSearch = () => {
    const q = search.trim();
    if(!q) return;
    window.location.href = `/specialties/${encodeURIComponent(q)}`;
  };

  return <div className="dl-page" dir="rtl">
    <style>{styles}</style>

    <header className="dl-header">
      <div className="dl-head-bg"/>
      <div className="dl-wrap dl-head-inner">
        <div className="dl-topbar">
          <div className="dl-brand" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
            <div className="dl-logo-mark">▥</div>
            <div><strong>الدليل الشامل</strong><span>للصنايعية والتشطيبات والمقاولات</span></div>
          </div>
          <div className="dl-nav-actions">
            <button className="dl-icon" onClick={()=>goApp("menu")}>☰</button>
            <button className="dl-login" onClick={()=>goApp("login")}>تسجيل الدخول</button>
            <button className="dl-icon" onClick={()=>goApp("notifications")}>🔔</button>
          </div>
        </div>

        <div className="dl-search-row">
          <div className="dl-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="ابحث عن صنايعي، شركة، مورد ..."/><button onClick={doSearch}>بحث</button></div>
        </div>

        <div className="dl-ads-shell">
          <div className="dl-section-kicker"><span>📣</span><b>إعلانات مميزة</b></div>
          <button className="dl-ad-arrow right" onClick={()=>scrollAds(-1)}>‹</button>
          <div className="dl-ads" ref={adsRef}>
            {ads.map((ad,i)=>{
              const img = clean(ad.imageUrl || ad.image || ad.bannerUrl) || FALLBACK_ADS[i%FALLBACK_ADS.length].imageUrl;
              return <button className="dl-ad-card" key={ad.id||i} onClick={()=>openAd(ad)}>
                <img src={img} alt={clean(ad.title)||"إعلان"}/><div className="dl-ad-shade"/>
                <span className="dl-ad-badge">إعلان</span>
                <div className="dl-ad-content"><b>{clean(ad.title)||"إعلان مميز"}</b><small>{clean(ad.subtitle || ad.description)||"اعرف التفاصيل والخدمات"}</small><em>{clean(ad.buttonText)||"عرض التفاصيل"} ←</em></div>
              </button>;
            })}
          </div>
          <button className="dl-ad-arrow left" onClick={()=>scrollAds(1)}>›</button>
        </div>
      </div>
    </header>

    <main className="dl-main">
      <div className="dl-wrap">
        <section className="dl-shortcuts">
          <button className="dl-shortcut dark" onClick={()=>goApp("companies")}><span>🏢</span><div><b>شركات</b><small>أكبر الشركات والمقاولات</small></div><i>←</i></button>
          <button className="dl-shortcut" onClick={()=>document.getElementById("suppliers")?.scrollIntoView({behavior:"smooth"})}><span>📦</span><div><b>موردين</b><small>مواد ومستلزمات البناء</small></div><i>←</i></button>
          <button className="dl-shortcut dark" onClick={()=>goApp("craftsmen")}><span>👷</span><div><b>صنايعية</b><small>أفضل الصنايعية في كل المجالات</small></div><i>←</i></button>
          <button className="dl-shortcut" onClick={()=>document.getElementById("feed")?.scrollIntoView({behavior:"smooth"})}><span>📰</span><div><b>منشورات</b><small>مشاركة خبراتك وأعمالك</small></div><i>←</i></button>
        </section>

        <FeaturedSection title="الصنايعية المميزة" subtitle="أفضل الصنايعية المميزين داخل الدليل" icon="👷" onAll={()=>goApp("craftsmen")}
          items={featuredCrafts} loading={loading} render={m=><CraftCard key={m.id} m={m} onClick={()=>openMember(m)}/>} />

        <FeaturedSection title="الشركات المميزة" subtitle="شركات ومكاتب مميزة داخل الدليل" icon="🏢" onAll={()=>goApp("companies")}
          items={featuredCompanies} loading={loading} render={m=><CompanyCard key={m.id} m={m} onClick={()=>openMember(m)}/>} />

        <div id="suppliers">
          <FeaturedSection title="الموردين والكتالوجات" subtitle="مواد ومستلزمات البناء من الموردين" icon="📦" onAll={()=>goApp("suppliers")}
            items={suppliers} loading={loading} render={m=><CompanyCard key={m.id} m={m} onClick={()=>openMember(m)} supplier/>} />
        </div>

        <section id="feed" className="dl-feed-section">
          <div className="dl-section-title"><div><h2>المنشورات</h2><p>منشورات الأعضاء بشكل اجتماعي زي فيسبوك</p></div></div>
          <div className="dl-feed-layout">
            <div className="dl-feed">
              {loading && <div className="dl-empty">جاري تحميل المنشورات...</div>}
              {!loading && posts.length===0 && <div className="dl-empty">لا توجد منشورات حاليًا</div>}
              {posts.map(p=><PostCard key={p.id} p={p}/>) }
            </div>
            <aside className="dl-sidebox"><b>الدليل الشامل</b><p>كل ما تحتاجه في التشطيبات والمقاولات في مكان واحد.</p><button onClick={()=>goApp("register")}>أضف نشاطك</button></aside>
          </div>
        </section>
      </div>
    </main>
  </div>;
}

function FeaturedSection({title,subtitle,icon,onAll,items,loading,render}){
  return <section className="dl-featured">
    <div className="dl-section-title"><div><h2>{title} <span>{icon}</span></h2><p>{subtitle}</p></div><button onClick={onAll}>عرض الكل ←</button></div>
    <div className="dl-hscroll">{loading ? <div className="dl-empty">جاري التحميل...</div> : items.length ? items.map(render) : <div className="dl-empty">لا توجد بيانات متاحة حاليًا</div>}</div>
  </section>;
}

function CraftCard({m,onClick}){
  const img = memberImage(m);
  const r = ratingValue(m);
  return <button className="dl-person-card" onClick={onClick}>
    <div className="dl-person-img">{img?<img src={img} alt={m.name||"صنايعي"}/>:<span>👷</span>}</div>
    <div className="dl-person-info"><b>{m.name||"عضو الدليل"}</b>{r>0&&<em>★ {r.toFixed(1)}</em>}<span>{m.specialty||m.category||"صنايعي"}</span><small>📍 {locationText(m)}</small></div>
  </button>;
}

function CompanyCard({m,onClick,supplier=false}){
  const img = memberImage(m);
  const r = ratingValue(m);
  return <button className="dl-company-card" onClick={onClick}>
    <div className="dl-company-img">{img?<img src={img} alt={m.name||"شركة"}/>:<span>{supplier?"📦":"🏢"}</span>}</div>
    <div className="dl-company-info"><div><b>{m.name||"عضو الدليل"}</b><span>{m.specialty||m.category||(supplier?"مورد":"مقاولات وتشطيبات")}</span></div>{r>0&&<em>★ {r.toFixed(1)}</em>}<small>📍 {locationText(m)}</small></div>
  </button>;
}

function PostCard({p}){
  const img = postImage(p);
  const author = clean(p.authorName || p.author || p.name || p.memberName) || "عضو الدليل";
  const text = clean(p.content || p.text || p.caption || p.description);
  return <article className="dl-post">
    <div className="dl-post-head"><div className="dl-post-avatar">{clean(p.authorAvatar||p.avatar)?<img src={p.authorAvatar||p.avatar} alt=""/>:<span>{author[0]}</span>}</div><div><b>{author}</b><small>منشور في الدليل الشامل</small></div><i>•••</i></div>
    {text&&<p>{text}</p>}
    {img&&<img className="dl-post-img" src={img} alt="منشور"/>}
    <div className="dl-post-actions"><span>👍 إعجاب</span><span>💬 تعليق</span><span>↗ مشاركة</span></div>
  </article>;
}

const styles = `
*{box-sizing:border-box}.dl-page{min-height:100vh;background:#f7f4ed;color:#082744;font-family:'Cairo','Tajawal',Arial,sans-serif}.dl-page button,.dl-page input{font:inherit}.dl-wrap{width:min(1450px,94vw);margin:auto}.dl-header{position:relative;background:#062744;color:#fff;overflow:hidden}.dl-head-bg{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,24,43,.96),rgba(2,31,57,.84)),url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=80') center/cover;opacity:.96}.dl-head-inner{position:relative;z-index:1;padding:16px 0 34px}.dl-topbar{display:flex;justify-content:space-between;align-items:center;gap:20px}.dl-brand{display:flex;align-items:center;gap:12px;cursor:pointer}.dl-logo-mark{width:58px;height:58px;border:2px solid #d8a52a;border-radius:14px;display:grid;place-items:center;font-size:34px;color:#f3c556}.dl-brand strong{display:block;font-size:30px;color:#f3c556;line-height:1.15}.dl-brand span{display:block;font-size:12px;color:#fff}.dl-nav-actions{display:flex;align-items:center;gap:10px}.dl-icon,.dl-login{border:1px solid #d6aa43;color:#fff;background:rgba(3,32,56,.82);height:42px;border-radius:12px;padding:0 16px;cursor:pointer}.dl-icon{width:44px;padding:0}.dl-login{font-weight:800}.dl-search-row{display:flex;justify-content:center;margin:18px 0}.dl-search{width:min(820px,100%);height:58px;background:#fff;border:2px solid #e7bd5b;border-radius:30px;padding:5px 7px 5px 17px;display:flex;align-items:center;gap:9px;box-shadow:0 10px 30px rgba(0,0,0,.18)}.dl-search>span{color:#082744;font-size:25px}.dl-search input{flex:1;border:0;outline:0;background:transparent;color:#082744;text-align:right;font-size:15px}.dl-search button{border:0;border-radius:24px;background:linear-gradient(135deg,#f5ce6d,#c8911d);color:#082744;font-weight:900;padding:11px 25px;cursor:pointer}.dl-ads-shell{position:relative;background:rgba(6,39,68,.66);border:1px solid rgba(238,188,77,.36);border-radius:24px;padding:16px 52px 20px;backdrop-filter:blur(8px)}.dl-section-kicker{display:flex;align-items:center;gap:8px;font-size:17px;margin-bottom:12px;color:#f2c45b}.dl-ads{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px}.dl-ads::-webkit-scrollbar{display:none}.dl-ad-card{position:relative;flex:0 0 clamp(235px,19.6%,300px);height:238px;border:1px solid #d4a13e;border-radius:18px;overflow:hidden;padding:0;cursor:pointer;background:#092d4b;scroll-snap-align:start;box-shadow:0 12px 26px rgba(0,0,0,.22);transition:.22s}.dl-ad-card:hover{transform:translateY(-4px)}.dl-ad-card img{width:100%;height:100%;object-fit:cover;display:block}.dl-ad-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(1,20,37,.94) 100%)}.dl-ad-badge{position:absolute;top:10px;right:10px;background:#f3c65d;color:#082744;border-radius:18px;padding:5px 12px;font-size:11px;font-weight:900}.dl-ad-content{position:absolute;inset:auto 14px 13px;text-align:right;color:#fff}.dl-ad-content b{display:block;font-size:18px;margin-bottom:3px}.dl-ad-content small{display:block;color:#f5f5f5;font-size:11px;min-height:17px}.dl-ad-content em{display:inline-block;margin-top:9px;background:linear-gradient(135deg,#f9d777,#d19a27);color:#082744;padding:7px 12px;border-radius:18px;font-style:normal;font-size:11px;font-weight:900}.dl-ad-arrow{position:absolute;z-index:3;top:53%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:2px solid #f0c25a;background:#fff;color:#082744;font-size:30px;display:grid;place-items:center;cursor:pointer;box-shadow:0 5px 20px rgba(0,0,0,.2)}.dl-ad-arrow.right{right:8px}.dl-ad-arrow.left{left:8px}.dl-main{background:linear-gradient(180deg,#fff 0,#fbf7ef 70%,#f4efe5 100%);padding:0 0 60px}.dl-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:22px 0}.dl-shortcut{min-height:100px;border:1px solid #eadfc7;background:#fffaf0;border-radius:18px;padding:18px;display:flex;align-items:center;gap:14px;text-align:right;color:#082744;cursor:pointer;box-shadow:0 7px 20px rgba(9,39,68,.07)}.dl-shortcut.dark{background:#092e50;color:#fff;border-color:#c69731}.dl-shortcut>span{font-size:34px}.dl-shortcut div{flex:1}.dl-shortcut b{display:block;font-size:20px}.dl-shortcut small{display:block;opacity:.76;margin-top:3px}.dl-shortcut i{font-style:normal;width:34px;height:34px;border-radius:50%;background:#d8a52a;color:#fff;display:grid;place-items:center}.dl-featured,.dl-feed-section{padding:20px 0 8px}.dl-section-title{display:flex;justify-content:space-between;align-items:end;gap:14px;margin-bottom:13px}.dl-section-title h2{margin:0;color:#9b6810;font-size:26px}.dl-section-title h2 span{font-size:23px}.dl-section-title p{margin:2px 0 0;color:#657382;font-size:12px}.dl-section-title>button{border:0;background:#082744;color:#fff;border-radius:10px;padding:9px 14px;cursor:pointer}.dl-hscroll{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;padding:3px 2px 12px}.dl-hscroll::-webkit-scrollbar{display:none}.dl-person-card{flex:0 0 205px;border:1px solid #e1e5e9;background:#fff;border-radius:15px;overflow:hidden;padding:0;cursor:pointer;text-align:right;box-shadow:0 8px 18px rgba(8,39,68,.08)}.dl-person-img{height:135px;background:#eaf0f4;display:grid;place-items:center;font-size:42px;overflow:hidden}.dl-person-img img{width:100%;height:100%;object-fit:cover}.dl-person-info{position:relative;padding:10px 12px 13px}.dl-person-info b{display:block;color:#082744;font-size:14px}.dl-person-info em{position:absolute;left:10px;top:8px;background:#fff0c8;color:#9b6810;border-radius:12px;padding:2px 6px;font-size:10px;font-style:normal}.dl-person-info span,.dl-person-info small{display:block;color:#647382;font-size:11px;margin-top:3px}.dl-company-card{flex:0 0 255px;border:1px solid #e1e5e9;background:#fff;border-radius:15px;overflow:hidden;padding:0;cursor:pointer;text-align:right;box-shadow:0 8px 18px rgba(8,39,68,.08)}.dl-company-img{height:145px;background:#eaf0f4;display:grid;place-items:center;font-size:44px;overflow:hidden}.dl-company-img img{width:100%;height:100%;object-fit:cover}.dl-company-info{position:relative;padding:10px 12px 12px}.dl-company-info b{display:block;color:#082744;font-size:14px}.dl-company-info span,.dl-company-info small{display:block;color:#647382;font-size:11px;margin-top:3px}.dl-company-info em{position:absolute;left:11px;top:10px;background:#fff0c8;color:#9b6810;border-radius:12px;padding:2px 6px;font-style:normal;font-size:10px}.dl-feed-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(250px,.75fr);gap:24px;align-items:start}.dl-feed{display:flex;flex-direction:column;gap:16px}.dl-post{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 8px 22px rgba(8,39,68,.07)}.dl-post-head{display:flex;align-items:center;gap:10px;padding:14px}.dl-post-avatar{width:44px;height:44px;border-radius:50%;background:#0b365d;color:#fff;display:grid;place-items:center;overflow:hidden}.dl-post-avatar img{width:100%;height:100%;object-fit:cover}.dl-post-head>div:nth-child(2){flex:1}.dl-post-head b{display:block;color:#082744}.dl-post-head small{display:block;color:#7a8793;font-size:10px}.dl-post-head i{font-style:normal;color:#697987}.dl-post>p{padding:0 14px 12px;margin:0;color:#26394a;line-height:1.8}.dl-post-img{width:100%;max-height:620px;object-fit:cover;display:block}.dl-post-actions{display:flex;justify-content:space-around;border-top:1px solid #edf0f2;padding:10px;color:#526272;font-size:12px}.dl-sidebox{position:sticky;top:20px;background:#092e50;color:#fff;border-radius:16px;padding:22px;box-shadow:0 10px 25px rgba(8,39,68,.12)}.dl-sidebox b{font-size:20px;color:#f3c55e}.dl-sidebox p{line-height:1.8;color:#dbe5ec}.dl-sidebox button{border:0;background:#d8a52a;color:#082744;font-weight:900;padding:10px 16px;border-radius:10px;cursor:pointer}.dl-empty{min-width:100%;padding:35px;text-align:center;color:#75818d;background:#fff;border:1px dashed #d8dee4;border-radius:14px}
@media(max-width:900px){.dl-brand strong{font-size:22px}.dl-brand span{display:none}.dl-logo-mark{width:46px;height:46px;font-size:28px}.dl-shortcuts{grid-template-columns:repeat(2,1fr)}.dl-feed-layout{grid-template-columns:1fr}.dl-sidebox{display:none}.dl-ad-card{flex-basis:72vw}.dl-ads-shell{padding-left:42px;padding-right:42px}}
@media(max-width:560px){.dl-wrap{width:min(94vw,520px)}.dl-topbar{align-items:flex-start}.dl-nav-actions{gap:6px}.dl-login{padding:0 10px;font-size:11px}.dl-search{height:52px}.dl-shortcuts{gap:9px}.dl-shortcut{padding:13px;min-height:88px}.dl-shortcut b{font-size:16px}.dl-shortcut small{font-size:10px}.dl-shortcut>span{font-size:27px}.dl-section-title h2{font-size:21px}.dl-person-card{flex-basis:175px}.dl-company-card{flex-basis:220px}.dl-ad-card{height:220px;flex-basis:78vw}.dl-ad-arrow{width:36px;height:36px}.dl-ads-shell{border-radius:18px}.dl-brand{gap:8px}}
`;
