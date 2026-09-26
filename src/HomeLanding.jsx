import React, { useEffect, useMemo, useState } from "react";
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
  {id:"a1",title:"مساحة إعلانية مميزة",subtitle:"اعرض شركتك وخدماتك أمام العملاء",imageUrl:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=85"},
  {id:"a2",title:"الأمل للدهانات الحديثة",subtitle:"ألوان وتشطيبات بجودة عالية",imageUrl:"https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1600&q=85"},
  {id:"a3",title:"سيراميك وبورسلين",subtitle:"أحدث الموديلات والتشطيبات",imageUrl:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85"}
];

const clean = v => String(v || "").trim();
const firstArrayImage = value => Array.isArray(value) && value.length ? (typeof value[0] === "string" ? value[0] : value[0]?.url || value[0]?.imageUrl) : "";
const memberImage = m => clean(m.coverImage || m.coverImageUrl || m.avatar || m.avatarUrl || m.profileImage || m.profileImageUrl || m.photo || m.photoUrl || m.image || m.imageUrl || firstArrayImage(m.workImages) || firstArrayImage(m.portfolioImages) || firstArrayImage(m.gallery) || firstArrayImage(m.images));
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
  const [ads,setAds] = useState(FALLBACK_ADS);
  const [members,setMembers] = useState([]);
  const [posts,setPosts] = useState([]);
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [adIndex,setAdIndex] = useState(0);

  useEffect(()=>{
    let alive = true;
    (async()=>{
      try{
        const [mSnap,pSnap,aSnap] = await Promise.all([
          getDocs(query(collection(db,"members"),limit(120))),
          getDocs(query(collection(db,"posts"),limit(24))).catch(()=>null),
          getDocs(query(collection(db,"ads"),where("status","==","active"),limit(20))).catch(()=>null),
        ]);
        if(!alive) return;
        const ms = mSnap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.status!=="rejected" && m.status!=="blocked");
        const ps = pSnap ? pSnap.docs.map(d=>({id:d.id,...d.data()})) : [];
        const raw = aSnap && !aSnap.empty ? aSnap.docs.map(d=>({id:d.id,...d.data()})) : [];
        const seen = new Set();
        const unique = raw.filter(ad=>{
          const key = clean(ad.imageUrl || ad.image || ad.bannerUrl) || `${clean(ad.title)}|${clean(ad.phone)}`;
          if(!key || seen.has(key)) return false;
          seen.add(key); return true;
        });
        setMembers(ms); setPosts(ps); setAds(unique.length ? unique : FALLBACK_ADS);
      } catch(e){
        console.warn("HomeLanding load error",e);
      } finally { if(alive) setLoading(false); }
    })();
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(ads.length<2) return;
    const t=setInterval(()=>setAdIndex(i=>(i+1)%ads.length),5000);
    return()=>clearInterval(t);
  },[ads.length]);

  const featuredCrafts = useMemo(()=>{
    const list=members.filter(m=>memberType(m)==="craftsman");
    return [...list.filter(isFeatured),...list.filter(m=>!isFeatured(m))].slice(0,8);
  },[members]);
  const featuredCompanies = useMemo(()=>{
    const list=members.filter(m=>memberType(m)==="company");
    return [...list.filter(isFeatured),...list.filter(m=>!isFeatured(m))].slice(0,6);
  },[members]);
  const suppliers = useMemo(()=>{
    const list=members.filter(m=>memberType(m)==="supplier");
    return [...list.filter(isFeatured),...list.filter(m=>!isFeatured(m))].slice(0,6);
  },[members]);

  const currentAd=ads[adIndex]||FALLBACK_ADS[0];
  const secondAd=ads[(adIndex+1)%ads.length]||FALLBACK_ADS[1];
  const openMember=m=>{ window.location.href=buildMemberPath(m); };
  const openAd=ad=>{
    const u=clean(ad.link||ad.url||ad.website||ad.targetUrl);
    if(u) window.open(u,"_blank","noopener,noreferrer");
  };
  const nextAd=()=>setAdIndex(i=>(i+1)%ads.length);
  const prevAd=()=>setAdIndex(i=>(i-1+ads.length)%ads.length);
  const goApp=tab=>{ window.location.href=`/?app=1${tab?`#${tab}`:""}`; };
  const doSearch=()=>{
    const q=search.trim();
    if(q) window.location.href=`/specialties/${encodeURIComponent(q)}`;
  };

  return <div className="dl-page" dir="rtl">
    <style>{styles}</style>
    <header className="dl-header">
      <div className="dl-wrap">
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

        <div className="dl-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="ابحث عن صنايعي، شركة، مورد ..."/><button onClick={doSearch}>بحث</button></div>

        <div className="dl-ads-title"><b>إعلانات مميزة</b><span>الإعلان كامل بحجمه ويُفتح على الجهة الخاصة به</span></div>
        <div className="dl-ad-stack">
          <button className="dl-ad-main" onClick={()=>openAd(currentAd)}>
            <img src={clean(currentAd.imageUrl||currentAd.image||currentAd.bannerUrl)||FALLBACK_ADS[0].imageUrl} alt={clean(currentAd.title)||"إعلان"}/>
            <div className="dl-ad-overlay"/>
            <span className="dl-ad-badge">إعلان</span>
            <div className="dl-ad-copy"><h2>{clean(currentAd.title)||"إعلان مميز"}</h2><p>{clean(currentAd.subtitle||currentAd.description)||"اعرف التفاصيل والخدمات"}</p><em>{clean(currentAd.buttonText)||"عرض التفاصيل"} ←</em></div>
          </button>
          <button className="dl-ad-second" onClick={()=>openAd(secondAd)}>
            <img src={clean(secondAd.imageUrl||secondAd.image||secondAd.bannerUrl)||FALLBACK_ADS[1].imageUrl} alt={clean(secondAd.title)||"إعلان"}/>
            <div className="dl-ad-overlay small"/>
            <span className="dl-ad-badge">إعلان</span>
            <div className="dl-ad-copy compact"><h3>{clean(secondAd.title)||"إعلان مميز"}</h3><p>{clean(secondAd.subtitle||secondAd.description)||"اعرف التفاصيل والخدمات"}</p></div>
          </button>
          <button className="dl-slide-arrow prev" onClick={e=>{e.stopPropagation();prevAd();}}>‹</button>
          <button className="dl-slide-arrow next" onClick={e=>{e.stopPropagation();nextAd();}}>›</button>
          <div className="dl-dots">{ads.slice(0,8).map((_,i)=><button key={i} className={i===adIndex?"active":""} onClick={()=>setAdIndex(i)}/>)}</div>
        </div>
      </div>
    </header>

    <main className="dl-main"><div className="dl-wrap">
      <section className="dl-shortcuts">
        <button className="dl-shortcut dark" onClick={()=>window.location.href="/companies"}><span>🏢</span><div><b>شركات</b><small>كل الشركات والمكاتب</small></div><i>←</i></button>
        <button className="dl-shortcut" onClick={()=>document.getElementById("suppliers")?.scrollIntoView({behavior:"smooth"})}><span>📦</span><div><b>موردين</b><small>مواد ومستلزمات البناء</small></div><i>←</i></button>
        <button className="dl-shortcut dark" onClick={()=>window.location.href="/craftsmen"}><span>👷</span><div><b>صنايعية</b><small>أفضل الصنايعية</small></div><i>←</i></button>
        <button className="dl-shortcut" onClick={()=>document.getElementById("feed")?.scrollIntoView({behavior:"smooth"})}><span>📰</span><div><b>منشورات</b><small>منشورات الأعضاء</small></div><i>←</i></button>
      </section>

      <FeaturedSection title="الصنايعية المميزة" subtitle="اختيارات مميزة من الصنايعية داخل الدليل" icon="👷" onAll={()=>window.location.href="/craftsmen"} items={featuredCrafts} loading={loading} render={m=><CraftCard key={m.id} m={m} onClick={()=>openMember(m)}/>}/>
      <FeaturedSection title="الشركات المميزة" subtitle="شركات ومكاتب مميزة داخل الدليل" icon="🏢" onAll={()=>window.location.href="/companies"} items={featuredCompanies} loading={loading} render={m=><CompanyCard key={m.id} m={m} onClick={()=>openMember(m)}/>}/>
      <div id="suppliers"><FeaturedSection title="الموردين والكتالوجات" subtitle="موردين ومنتجات ومواد تشطيب" icon="📦" onAll={()=>goApp("suppliers")} items={suppliers} loading={loading} render={m=><CompanyCard key={m.id} m={m} onClick={()=>openMember(m)} supplier/>}/></div>

      <section id="feed" className="dl-feed-section">
        <div className="dl-section-title"><div><h2>المنشورات</h2><p>منشورات الأعضاء بشكل اجتماعي</p></div></div>
        <div className="dl-feed-layout"><div className="dl-feed">
          {loading&&<div className="dl-empty">جاري تحميل المنشورات...</div>}
          {!loading&&posts.length===0&&<div className="dl-empty">لا توجد منشورات حاليًا</div>}
          {posts.map(p=><PostCard key={p.id} p={p}/>) }
        </div><aside className="dl-sidebox"><b>الدليل الشامل</b><p>كل ما تحتاجه في التشطيبات والمقاولات في مكان واحد.</p><button onClick={()=>goApp("register")}>أضف نشاطك</button></aside></div>
      </section>
    </div></main>
  </div>;
}

function FeaturedSection({title,subtitle,icon,onAll,items,loading,render}){
  return <section className="dl-featured"><div className="dl-section-title"><div><h2>{title} <span>{icon}</span></h2><p>{subtitle}</p></div><button onClick={onAll}>عرض الكل ←</button></div><div className="dl-hscroll">{loading?<div className="dl-empty">جاري التحميل...</div>:items.length?items.map(render):<div className="dl-empty">لا توجد بيانات متاحة حاليًا</div>}</div></section>;
}

function CraftCard({m,onClick}){
  const img=memberImage(m), r=ratingValue(m);
  return <button className="dl-person-card" onClick={onClick}><div className="dl-person-img">{img?<img src={img} alt={m.name||"صنايعي"}/>:<span>👷</span>}</div><div className="dl-person-info"><b>{m.name||"عضو الدليل"}</b>{r>0&&<em>★ {r.toFixed(1)}</em>}<small>{m.specialty||m.category||"تشطيبات ومقاولات"}</small><span>📍 {locationText(m)}</span></div><strong className="dl-card-cta">عرض الملف</strong></button>;
}
function CompanyCard({m,onClick,supplier}){
  const img=memberImage(m), r=ratingValue(m);
  return <button className="dl-company-card" onClick={onClick}><div className="dl-company-img">{img?<img src={img} alt={m.name||"شركة"}/>:<span>{supplier?"📦":"🏢"}</span>}</div><div className="dl-company-info"><b>{m.name||"عضو الدليل"}</b>{r>0&&<em>★ {r.toFixed(1)}</em>}<small>{m.specialty||m.category||(supplier?"مواد ومستلزمات بناء":"مقاولات وتشطيبات")}</small><span>📍 {locationText(m)}</span></div></button>;
}
function PostCard({p}){
  const img=postImage(p); const name=clean(p.authorName||p.author||p.name||p.userName)||"عضو الدليل";
  return <article className="dl-post"><div className="dl-post-head"><div className="dl-post-avatar">{name.charAt(0)}</div><div><b>{name}</b><small>منشور على الدليل الشامل</small></div></div><p>{p.content||p.text||p.caption||"منشور جديد"}</p>{img&&<img className="dl-post-img" src={img} alt=""/>}<div className="dl-post-actions"><button>👍 إعجاب</button><button>💬 تعليق</button><button>↗ مشاركة</button></div></article>;
}

const styles=`
*{box-sizing:border-box}.dl-page{min-height:100vh;background:#f7f4ee;color:#071f35;font-family:Cairo,Tahoma,Arial,sans-serif}.dl-wrap{width:min(1440px,94%);margin:auto}.dl-header{background:linear-gradient(180deg,#06223b,#0b2e4d 72%,#0a2945);padding:18px 0 34px;position:relative;overflow:hidden}.dl-header:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 15% 10%,rgba(218,177,83,.20),transparent 30%),radial-gradient(circle at 85% 20%,rgba(255,255,255,.08),transparent 25%);pointer-events:none}.dl-topbar{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:20px}.dl-brand{display:flex;align-items:center;gap:12px;cursor:pointer;color:#f0c866}.dl-logo-mark{font-size:46px;font-weight:900}.dl-brand strong{display:block;font-size:30px;line-height:1}.dl-brand span{display:block;color:white;font-size:13px;margin-top:5px}.dl-nav-actions{display:flex;gap:10px}.dl-icon,.dl-login{border:1px solid #d9ad4e;background:#0b2a47;color:white;border-radius:14px;padding:11px 15px;font-weight:800;cursor:pointer}.dl-login{background:linear-gradient(135deg,#efc86d,#b98322);color:#09223a}.dl-search{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr auto;align-items:center;background:white;border:3px solid #d4aa4f;border-radius:20px;overflow:hidden;max-width:900px;margin:22px auto 20px;box-shadow:0 12px 35px rgba(0,0,0,.18)}.dl-search span{padding:0 18px;font-size:28px}.dl-search input{border:0;outline:0;padding:17px;font-size:17px;width:100%}.dl-search button{border:0;background:linear-gradient(135deg,#f2d17d,#c58e2b);padding:17px 25px;font-weight:900;cursor:pointer}.dl-ads-title{position:relative;z-index:1;color:white;display:flex;align-items:end;justify-content:space-between;margin:10px 0 10px}.dl-ads-title b{font-size:22px;color:#f2cb72}.dl-ads-title span{font-size:12px;color:rgba(255,255,255,.72)}.dl-ad-stack{position:relative;z-index:1;display:grid;gap:12px}.dl-ad-main,.dl-ad-second{position:relative;border:1px solid #d6aa4d;border-radius:22px;overflow:hidden;padding:0;cursor:pointer;background:#0b2238;box-shadow:0 16px 40px rgba(0,0,0,.24);width:100%}.dl-ad-main{height:360px}.dl-ad-second{height:170px}.dl-ad-main img,.dl-ad-second img{width:100%;height:100%;object-fit:cover;display:block}.dl-ad-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(1,15,27,.18),rgba(2,17,31,.75))}.dl-ad-overlay.small{background:linear-gradient(90deg,rgba(1,15,27,.05),rgba(2,17,31,.68))}.dl-ad-badge{position:absolute;top:16px;right:16px;background:#efc457;color:#09213a;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:900}.dl-ad-copy{position:absolute;right:32px;bottom:28px;max-width:54%;color:white;text-align:right}.dl-ad-copy h2{font-size:34px;margin:0 0 8px}.dl-ad-copy h3{font-size:24px;margin:0 0 6px}.dl-ad-copy p{font-size:15px;margin:0 0 12px}.dl-ad-copy em{display:inline-block;background:linear-gradient(135deg,#f2d17d,#c38b28);color:#082038;border-radius:12px;padding:10px 18px;font-style:normal;font-weight:900}.dl-ad-copy.compact{bottom:20px}.dl-slide-arrow{position:absolute;top:31%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:2px solid #e3ba5c;background:#fff;color:#0a2945;font-size:30px;font-weight:900;cursor:pointer;z-index:5}.dl-slide-arrow.prev{right:16px}.dl-slide-arrow.next{left:16px}.dl-dots{display:flex;gap:7px;justify-content:center}.dl-dots button{width:9px;height:9px;border:0;border-radius:50%;background:rgba(255,255,255,.45);cursor:pointer;padding:0}.dl-dots button.active{width:24px;border-radius:8px;background:#e4b54f}.dl-main{background:linear-gradient(#f8f5ef,#fff);padding:22px 0 70px}.dl-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:30px}.dl-shortcut{border:1px solid #e8dfce;background:#fff7e9;border-radius:18px;padding:18px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;cursor:pointer;text-align:right;box-shadow:0 8px 22px rgba(9,33,55,.07)}.dl-shortcut.dark{background:#0a2c49;color:white;border-color:#b88930}.dl-shortcut>span{font-size:34px}.dl-shortcut b{font-size:21px;display:block}.dl-shortcut small{opacity:.72}.dl-shortcut i{font-style:normal;font-size:22px}.dl-featured{margin:28px 0}.dl-section-title{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:14px}.dl-section-title h2{margin:0;font-size:27px;color:#946514}.dl-section-title p{margin:3px 0 0;color:#637181}.dl-section-title button{border:0;background:#092b48;color:white;border-radius:12px;padding:10px 15px;font-weight:800;cursor:pointer}.dl-hscroll{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 10px;scroll-snap-type:x proximity}.dl-hscroll::-webkit-scrollbar{height:7px}.dl-hscroll::-webkit-scrollbar-thumb{background:#d5b365;border-radius:9px}.dl-person-card,.dl-company-card{flex:0 0 230px;background:white;border:1px solid #e5e2dc;border-radius:16px;overflow:hidden;box-shadow:0 8px 20px rgba(6,37,61,.08);cursor:pointer;text-align:right;color:#0a2740}.dl-person-img,.dl-company-img{height:150px;background:#eaf0f4;display:flex;align-items:center;justify-content:center;font-size:48px}.dl-person-img img,.dl-company-img img{width:100%;height:100%;object-fit:cover}.dl-person-info,.dl-company-info{padding:13px}.dl-person-info b,.dl-company-info b{display:block;font-size:16px}.dl-person-info em,.dl-company-info em{display:inline-block;background:#fff1c7;color:#9a6810;border-radius:8px;padding:3px 7px;font-size:11px;font-style:normal;margin:6px 0}.dl-person-info small,.dl-company-info small,.dl-person-info span,.dl-company-info span{display:block;color:#667485;font-size:12px;margin-top:4px}.dl-card-cta{display:block;background:#0b2a47;color:white;margin:0 12px 12px;padding:8px;border-radius:9px;text-align:center;font-size:12px}.dl-feed-section{margin-top:35px}.dl-feed-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:22px}.dl-feed{display:flex;flex-direction:column;gap:16px}.dl-post{background:white;border:1px solid #e5e2dc;border-radius:16px;padding:16px;box-shadow:0 8px 18px rgba(5,32,54,.06)}.dl-post-head{display:flex;gap:10px;align-items:center}.dl-post-avatar{width:42px;height:42px;border-radius:50%;background:#0a2c49;color:#f4c968;display:flex;align-items:center;justify-content:center;font-weight:900}.dl-post-head b,.dl-post-head small{display:block}.dl-post-head small{color:#82909b;font-size:11px}.dl-post p{line-height:1.8}.dl-post-img{width:100%;max-height:470px;object-fit:cover;border-radius:12px}.dl-post-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid #eee;padding-top:10px;margin-top:10px}.dl-post-actions button{border:0;background:#f4f6f8;padding:9px;border-radius:9px;cursor:pointer}.dl-sidebox{background:#0b2b48;color:white;border-radius:16px;padding:22px;height:max-content;position:sticky;top:20px}.dl-sidebox b{font-size:22px;color:#f0c968}.dl-sidebox button{border:0;background:#efc765;color:#082139;padding:10px 14px;border-radius:10px;font-weight:900;cursor:pointer}.dl-empty{background:white;border:1px dashed #d8d8d8;border-radius:14px;padding:24px;color:#7b8793;min-width:260px}
@media(max-width:900px){.dl-brand strong{font-size:22px}.dl-brand span{font-size:11px}.dl-ad-main{height:280px}.dl-ad-second{height:150px}.dl-ad-copy{max-width:72%;right:22px}.dl-ad-copy h2{font-size:26px}.dl-shortcuts{grid-template-columns:repeat(2,1fr)}.dl-feed-layout{grid-template-columns:1fr}.dl-sidebox{display:none}}
@media(max-width:620px){.dl-wrap{width:94%}.dl-topbar{align-items:flex-start}.dl-brand span{display:none}.dl-logo-mark{font-size:34px}.dl-nav-actions{gap:6px}.dl-icon,.dl-login{padding:9px 10px;font-size:11px}.dl-search{grid-template-columns:auto 1fr}.dl-search button{grid-column:1/-1;padding:11px}.dl-ad-main{height:230px}.dl-ad-second{height:125px}.dl-ad-copy{right:16px;bottom:14px;max-width:80%}.dl-ad-copy h2{font-size:21px}.dl-ad-copy h3{font-size:17px}.dl-ad-copy p{font-size:12px}.dl-ad-copy em{padding:8px 12px;font-size:11px}.dl-slide-arrow{width:38px;height:38px;font-size:24px;top:29%}.dl-shortcuts{grid-template-columns:1fr}.dl-section-title{align-items:center}.dl-section-title h2{font-size:22px}.dl-section-title p{font-size:12px}.dl-person-card,.dl-company-card{flex-basis:205px}}
`;