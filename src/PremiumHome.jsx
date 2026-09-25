import React, { useEffect, useMemo, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, limit } from "firebase/firestore";
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

const fallbackAds = [
  { id:"a1", title:"مساحتك الإعلانية هنا", subtitle:"اعرض شركتك أمام آلاف العملاء", imageUrl:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1100&q=80" },
  { id:"a2", title:"سيراميك وبورسلين", subtitle:"أحدث الموديلات والتشطيبات", imageUrl:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80" },
  { id:"a3", title:"ألوميتال وواجهات", subtitle:"تصميم • تنفيذ • تركيب", imageUrl:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80" },
  { id:"a4", title:"كهرباء حديثة", subtitle:"أمان وجودة في التنفيذ", imageUrl:"https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=80" },
  { id:"a5", title:"جبس بورد وديكورات", subtitle:"تشطيبات عصرية وفخمة", imageUrl:"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80" },
];

const categoryCards = [
  { id:"company", title:"شركات", subtitle:"مكاتب وشركات مقاولات وتشطيبات", icon:"🏢", image:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=80" },
  { id:"supplier", title:"موردين", subtitle:"محلات ومصانع مواد البناء والتشطيب", icon:"📦", image:"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=700&q=80" },
  { id:"craftsman", title:"صنايعية", subtitle:"ابحث عن صنايعي في جميع التخصصات", icon:"👷", image:"https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=700&q=80" },
  { id:"posts", title:"منشورات", subtitle:"أحدث الفرص والأعمال والإعلانات", icon:"📣", image:"https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=700&q=80" },
];

const craftTiles = [
  ["سباكة","🔧","https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=420&q=80"],
  ["دهانات","🎨","https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=420&q=80"],
  ["محارة وبناء","🧱","https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=420&q=80"],
  ["كهرباء","⚡","https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=420&q=80"],
  ["جبس بورد","🏠","https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=420&q=80"],
  ["سيراميك وبورسلين","◫","https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=420&q=80"],
];

function clean(v){ return String(v||"").trim(); }
function typeOfMember(m){
  const t = clean(m.type || m.memberType || m.category).toLowerCase();
  if (t.includes("company") || t.includes("شركة")) return "company";
  if (t.includes("supplier") || t.includes("مورد")) return "supplier";
  return "craftsman";
}

export default function PremiumHome(){
  const [ads,setAds] = useState(fallbackAds);
  const [members,setMembers] = useState([]);
  const [posts,setPosts] = useState([]);
  const [slide,setSlide] = useState(0);
  const [view,setView] = useState("home");
  const [search,setSearch] = useState("");
  const [drawer,setDrawer] = useState(false);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const [mSnap,pSnap,aSnap] = await Promise.all([
          getDocs(query(collection(db,"members"), limit(120))),
          getDocs(query(collection(db,"posts"), limit(24))),
          getDocs(query(collection(db,"ads"), where("status","==","active"), limit(10))).catch(()=>null),
        ]);
        if(!alive) return;
        const ms=mSnap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.status!=="rejected");
        const ps=pSnap.docs.map(d=>({id:d.id,...d.data()}));
        const as=aSnap && !aSnap.empty ? aSnap.docs.map(d=>({id:d.id,...d.data()})) : fallbackAds;
        setMembers(ms); setPosts(ps); setAds(as.slice(0,5));
      }catch(e){ console.warn("PremiumHome load",e); }
      if(alive) setLoading(false);
    })();
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(ads.length<2) return;
    const t=setInterval(()=>setSlide(s=>(s+1)%ads.length),5000);
    return()=>clearInterval(t);
  },[ads.length]);

  const filtered = useMemo(()=>{
    const q=search.trim().toLowerCase();
    let arr=members;
    if(view==="company"||view==="supplier"||view==="craftsman") arr=arr.filter(m=>typeOfMember(m)===view);
    if(q) arr=arr.filter(m=>[m.name,m.specialty,m.category,m.governorate,m.city,m.area].some(v=>clean(v).toLowerCase().includes(q)));
    return arr;
  },[members,view,search]);

  const featuredCompanies = useMemo(()=>members.filter(m=>typeOfMember(m)==="company").slice(0,5),[members]);
  const latestCrafts = useMemo(()=>members.filter(m=>typeOfMember(m)==="craftsman").slice(0,8),[members]);

  const openMember=(m)=>{ window.location.href=buildMemberPath(m); };
  const openAd=(ad)=>{
    const u=ad.link || ad.url || ad.website || ad.targetUrl;
    if(u) window.open(u,"_blank","noopener,noreferrer");
  };
  const openCategory=(id)=>{ setSearch(""); setView(id); window.scrollTo({top:0,behavior:"smooth"}); };
  const goFullApp=()=>{ window.location.href="/?app=1"; };

  if(view!=="home"){
    return <div className="ph-shell" dir="rtl">
      <style>{styles}</style>
      <div className="ph-inner">
        <div className="ph-subhead">
          <button className="ph-back" onClick={()=>setView("home")}>→ الرئيسية</button>
          <div className="ph-brand-mini"><span>▥</span><b>الدليل الشامل</b></div>
        </div>
        <div className="ph-results-head">
          <div><h1>{view==="company"?"الشركات":view==="supplier"?"الموردين":view==="craftsman"?"الصنايعية":"المنشورات"}</h1><p>كل المحتوى المسجل داخل الدليل الشامل</p></div>
          <button className="ph-gold-btn" onClick={goFullApp}>دخول الحساب</button>
        </div>
        {view!=="posts" && <div className="ph-search ph-search-results"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو التخصص أو المحافظة..."/></div>}
        {view==="posts" ? (
          <div className="ph-post-grid">
            {posts.length===0 && <div className="ph-empty">لا توجد منشورات متاحة الآن</div>}
            {posts.map(p=><article className="ph-post" key={p.id}>
              <div className="ph-post-top"><div className="ph-avatar">{clean(p.author||p.name||"د")[0]}</div><div><b>{p.author||p.name||"عضو الدليل"}</b><small>منشور على الدليل الشامل</small></div></div>
              <p>{p.content||p.text||p.caption||"منشور جديد"}</p>
              {(p.imageUrl||p.image) && <img src={p.imageUrl||p.image} alt=""/>}
            </article>)}
          </div>
        ) : (
          <div className="ph-member-grid">
            {loading && <div className="ph-empty">جاري تحميل البيانات...</div>}
            {!loading && filtered.length===0 && <div className="ph-empty">لا توجد نتائج مطابقة حاليًا</div>}
            {filtered.map(m=><button className="ph-member-card" key={m.id} onClick={()=>openMember(m)}>
              <div className="ph-member-photo">{(m.avatar||m.photo||m.imageUrl)?<img src={m.avatar||m.photo||m.imageUrl} alt=""/>:<span>{typeOfMember(m)==="company"?"🏢":typeOfMember(m)==="supplier"?"📦":"👷"}</span>}</div>
              <div className="ph-member-body"><b>{m.name||"عضو الدليل"}</b><span>{m.specialty||m.category||"مقاولات وتشطيبات"}</span><small>{[m.governorate,m.city,m.area].filter(Boolean).join(" • ")||"مصر"}</small></div><i>←</i>
            </button>)}
          </div>
        )}
      </div>
    </div>;
  }

  const current=ads[slide]||fallbackAds[0];
  const side1=ads[(slide+1)%ads.length]||fallbackAds[1];
  const side2=ads[(slide+2)%ads.length]||fallbackAds[2];
  const side3=ads[(slide+3)%ads.length]||fallbackAds[3];
  const side4=ads[(slide+4)%ads.length]||fallbackAds[4];

  return <div className="ph-shell" dir="rtl">
    <style>{styles}</style>
    <header className="ph-hero">
      <div className="ph-bg"/>
      <div className="ph-inner ph-hero-inner">
        <div className="ph-topbar">
          <button className="ph-icon-btn" onClick={()=>setDrawer(v=>!v)}>☰</button>
          <div className="ph-logo"><div className="ph-building">▥</div><div><strong>الدليل الشامل</strong><span>للصنايعية والتشطيبات والمقاولات</span></div></div>
          <div className="ph-actions"><button className="ph-icon-btn" onClick={goFullApp}>🔔</button><button className="ph-login" onClick={goFullApp}>♙ تسجيل الدخول</button></div>
        </div>
        {drawer && <div className="ph-drawer"><button onClick={goFullApp}>فتح التطبيق الكامل</button><button onClick={()=>openCategory("company")}>الشركات</button><button onClick={()=>openCategory("supplier")}>الموردين</button><button onClick={()=>openCategory("craftsman")}>الصنايعية</button><button onClick={()=>openCategory("posts")}>المنشورات</button></div>}
        <div className="ph-search" onClick={()=>{}}><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&search.trim())openCategory("craftsman")}} placeholder="بتدور على إيه ؟"/><button onClick={()=>openCategory("craftsman")}>بحث</button></div>

        <div className="ph-carousel">
          <button className="ph-side ph-side2" onClick={()=>openAd(side2)} style={{backgroundImage:`linear-gradient(180deg,rgba(0,25,48,.18),rgba(0,20,40,.78)),url(${side2.imageUrl||side2.image||fallbackAds[1].imageUrl})`}}><b>{side2.title||"سيراميك وبورسلين"}</b><span>{side2.subtitle||side2.description||"أحدث الموديلات"}</span></button>
          <button className="ph-side ph-side1" onClick={()=>openAd(side1)} style={{backgroundImage:`linear-gradient(180deg,rgba(0,25,48,.18),rgba(0,20,40,.78)),url(${side1.imageUrl||side1.image||fallbackAds[2].imageUrl})`}}><b>{side1.title||"واجهات وتشطيبات"}</b><span>{side1.subtitle||side1.description||"تصميم وتنفيذ"}</span></button>
          <button className="ph-main-ad" onClick={()=>openAd(current)} style={{backgroundImage:`linear-gradient(180deg,rgba(0,25,48,.06),rgba(0,20,40,.82)),url(${current.imageUrl||current.image||fallbackAds[0].imageUrl})`}}>
            <div className="ph-ad-copy"><h2>{current.title||"إعلان مميز"}</h2><p>{current.subtitle||current.description||"جودة • ثقة • حلول متكاملة"}</p><span>اعرف المزيد ←</span></div>
          </button>
          <button className="ph-side ph-side1" onClick={()=>openAd(side3)} style={{backgroundImage:`linear-gradient(180deg,rgba(0,25,48,.18),rgba(0,20,40,.78)),url(${side3.imageUrl||side3.image||fallbackAds[3].imageUrl})`}}><b>{side3.title||"ألوميتال وواجهات"}</b><span>{side3.subtitle||side3.description||"تصميم • تنفيذ • تركيب"}</span></button>
          <button className="ph-side ph-side2" onClick={()=>openAd(side4)} style={{backgroundImage:`linear-gradient(180deg,rgba(0,25,48,.18),rgba(0,20,40,.78)),url(${side4.imageUrl||side4.image||fallbackAds[4].imageUrl})`}}><b>{side4.title||"كهرباء حديثة"}</b><span>{side4.subtitle||side4.description||"أمان وجودة"}</span></button>
        </div>
        <div className="ph-dots">{ads.map((a,i)=><button key={a.id||i} className={i===slide?"active":""} onClick={()=>setSlide(i)}/>)}</div>
      </div>
    </header>

    <main className="ph-inner ph-content">
      <section className="ph-categories">{categoryCards.map(c=><button key={c.id} className="ph-category" onClick={()=>openCategory(c.id)}><div className="ph-cat-image" style={{backgroundImage:`linear-gradient(180deg,transparent,rgba(0,24,46,.25)),url(${c.image})`}}/><div className="ph-cat-body"><span className="ph-cat-icon">{c.icon}</span><div><b>{c.title}</b><small>{c.subtitle}</small></div><i>←</i></div></button>)}</section>

      <section className="ph-section-card"><div className="ph-section-head"><div><h2>أحدث الصنايعية</h2><span>أحدث التخصصات والخدمات</span></div><button onClick={()=>openCategory("craftsman")}>عرض الكل ←</button></div><div className="ph-trades">{craftTiles.map(([n,ic,img])=><button key={n} onClick={()=>{setSearch(n);setView("craftsman");}} style={{backgroundImage:`linear-gradient(180deg,transparent 35%,rgba(0,29,55,.9)),url(${img})`}}><span>{ic}</span><b>{n}</b></button>)}</div></section>

      <section className="ph-section-card"><div className="ph-section-head"><div><h2>شركات مميزة</h2><span>شركات ومكاتب موثوقة داخل الدليل</span></div><button onClick={()=>openCategory("company")}>عرض الكل ←</button></div><div className="ph-featured-grid">
        {(featuredCompanies.length?featuredCompanies:Array.from({length:5},(_,i)=>({id:`f${i}`,name:["مكتب النمر","توب ديزاين","خالد ديزاين","شركة مقاولات","الأمل للدهانات"][i],specialty:"تصميم وتشطيب وإشراف"}))).map((m,i)=><button key={m.id} onClick={()=>m.id?.startsWith("f")?openCategory("company"):openMember(m)} className="ph-company"><div className="ph-company-img">{(m.avatar||m.photo||m.imageUrl)?<img src={m.avatar||m.photo||m.imageUrl} alt=""/>:<span>🏢</span>}</div><b>{m.name||"شركة مميزة"}</b><small>{m.specialty||m.category||"مقاولات وتشطيبات"}</small><i>←</i></button>)}
      </div></section>

      <section className="ph-section-card"><div className="ph-section-head"><div><h2>أحدث الأعضاء</h2><span>انضمامات جديدة إلى الدليل الشامل</span></div><button onClick={()=>openCategory("craftsman")}>عرض الكل ←</button></div><div className="ph-latest">{latestCrafts.slice(0,6).map(m=><button key={m.id} onClick={()=>openMember(m)}><div>{(m.avatar||m.photo)?<img src={m.avatar||m.photo} alt=""/>:"👷"}</div><span><b>{m.name}</b><small>{m.specialty||m.category||"صنايعي"}</small></span><i>←</i></button>)}</div></section>
    </main>
  </div>;
}

const styles = `
*{box-sizing:border-box}.ph-shell{min-height:100vh;background:#031b2d;color:#071827;font-family:Cairo,Tajawal,Arial,sans-serif}.ph-shell button,.ph-shell input{font-family:inherit}.ph-inner{width:min(1440px,100%);margin:auto}.ph-hero{position:relative;overflow:hidden;background:#031b2d}.ph-bg{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,24,44,.08),#031b2d 95%),url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=80') center/cover;filter:saturate(.9)}.ph-hero-inner{position:relative;padding:18px 24px 28px}.ph-topbar{display:grid;grid-template-columns:180px 1fr 240px;align-items:center;gap:20px}.ph-logo{display:flex;align-items:center;justify-content:center;gap:13px;color:#fff}.ph-building{font-size:54px;color:#f4c35d;transform:rotate(180deg);line-height:1}.ph-logo strong{display:block;color:#f6ca68;font-size:31px;line-height:1.2}.ph-logo span{display:block;color:#fff;font-size:14px;font-weight:700}.ph-actions{display:flex;justify-content:flex-start;gap:10px}.ph-icon-btn,.ph-login{height:46px;border:1px solid #e5b654;background:rgba(1,23,42,.72);color:#fff;border-radius:12px;cursor:pointer;font-size:16px}.ph-icon-btn{width:48px}.ph-login{padding:0 18px;font-weight:800}.ph-drawer{position:absolute;z-index:50;top:72px;right:24px;width:220px;background:#06233a;border:1px solid #cda14a;border-radius:14px;padding:10px;box-shadow:0 18px 45px #0008}.ph-drawer button{display:block;width:100%;text-align:right;padding:11px;border:0;background:transparent;color:#fff;border-bottom:1px solid #ffffff14;cursor:pointer}.ph-search{width:min(930px,86%);height:58px;margin:24px auto;display:flex;align-items:center;background:#fff;border:2px solid #dcb35c;border-radius:29px;padding:0 17px;box-shadow:0 12px 35px #0004}.ph-search span{font-size:28px}.ph-search input{flex:1;border:0;outline:0;font-size:17px;text-align:right;padding:0 14px;color:#18344a}.ph-search button{border:0;background:#0a3454;color:#fff;border-radius:20px;padding:9px 18px;cursor:pointer}.ph-carousel{display:grid;grid-template-columns:.82fr .9fr 2.25fr .9fr .82fr;align-items:stretch;gap:10px;min-height:385px;direction:ltr}.ph-carousel button{direction:rtl}.ph-main-ad,.ph-side{position:relative;border:1.5px solid #e7bb5c;border-radius:18px;background-size:cover;background-position:center;overflow:hidden;color:#fff;cursor:pointer;box-shadow:0 16px 35px #0006;transition:.25s}.ph-main-ad:hover,.ph-side:hover{transform:translateY(-5px);box-shadow:0 24px 55px #0008}.ph-main-ad{min-height:385px}.ph-main-ad:after,.ph-side:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 1px #ffffff2b;pointer-events:none}.ph-ad-copy{position:absolute;inset:auto 28px 24px;text-align:right}.ph-ad-copy h2{margin:0;color:#ffd46f;font-size:31px}.ph-ad-copy p{margin:6px 0 14px;font-weight:700}.ph-ad-copy span{display:inline-block;background:linear-gradient(135deg,#ffe093,#c99025);color:#092841;padding:9px 18px;border-radius:22px;font-weight:900}.ph-side{display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;padding:20px 14px;min-height:315px}.ph-side1{margin:18px 0}.ph-side2{margin:34px 0}.ph-side b{font-size:20px;line-height:1.25;text-align:right}.ph-side span{font-size:12px;margin-top:5px}.ph-dots{display:flex;justify-content:center;gap:8px;margin-top:13px}.ph-dots button{width:9px;height:9px;border:0;border-radius:50%;background:#8293a0;padding:0;cursor:pointer}.ph-dots button.active{width:24px;border-radius:8px;background:#e7b84e}.ph-content{padding:18px 20px 50px}.ph-categories{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}.ph-category{padding:0;border:1.5px solid #d8aa4d;background:#fff;border-radius:18px;overflow:hidden;cursor:pointer;box-shadow:0 10px 24px #0013214d;text-align:right;transition:.22s}.ph-category:hover{transform:translateY(-5px)}.ph-cat-image{height:150px;background-size:cover;background-position:center}.ph-cat-body{min-height:112px;display:grid;grid-template-columns:52px 1fr 28px;align-items:center;gap:10px;padding:12px;color:#081e31}.ph-cat-icon{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:#073453;color:#f5c55f;font-size:25px;border:1px solid #d8aa4d}.ph-cat-body b{display:block;font-size:22px}.ph-cat-body small{display:block;color:#354e61;font-size:12px;line-height:1.6}.ph-cat-body i{font-style:normal;width:28px;height:28px;border-radius:50%;background:#9a6b11;color:#fff;display:grid;place-items:center}.ph-section-card{background:#f8fafb;border-radius:20px;padding:18px;margin:20px 0;box-shadow:0 12px 30px #00131f50}.ph-section-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;color:#08253c}.ph-section-head h2{margin:0;font-size:25px}.ph-section-head span{font-size:12px;color:#6f7f8a}.ph-section-head button{border:0;background:#fbebc7;color:#183348;padding:9px 14px;border-radius:20px;font-weight:800;cursor:pointer}.ph-trades{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.ph-trades button{height:160px;border:0;border-radius:13px;background-size:cover;background-position:center;position:relative;overflow:hidden;color:#fff;cursor:pointer;text-align:right;padding:12px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start}.ph-trades span{font-size:20px}.ph-trades b{font-size:14px}.ph-featured-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.ph-company{border:1px solid #d7dde2;background:#fff;border-radius:14px;padding:0 0 12px;overflow:hidden;text-align:right;cursor:pointer;color:#08253c;position:relative}.ph-company-img{height:145px;background:linear-gradient(135deg,#dbe4ea,#fff);display:grid;place-items:center;font-size:50px;overflow:hidden}.ph-company-img img{width:100%;height:100%;object-fit:cover}.ph-company b,.ph-company small{display:block;padding:0 10px}.ph-company b{font-size:14px;margin-top:9px}.ph-company small{font-size:11px;color:#5e6e79}.ph-company i{position:absolute;left:9px;bottom:9px;font-style:normal;color:#98660a}.ph-latest{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ph-latest button{display:grid;grid-template-columns:52px 1fr 24px;align-items:center;gap:9px;border:1px solid #e1e5e9;background:#fff;border-radius:13px;padding:9px;text-align:right;cursor:pointer}.ph-latest button>div{width:52px;height:52px;border-radius:10px;background:#e7edf1;display:grid;place-items:center;overflow:hidden;font-size:25px}.ph-latest img{width:100%;height:100%;object-fit:cover}.ph-latest b,.ph-latest small{display:block}.ph-latest small{font-size:11px;color:#667985}.ph-latest i{font-style:normal}.ph-subhead{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #ffffff1c}.ph-back,.ph-gold-btn{border:1px solid #d7aa4f;background:#0b3859;color:#fff;border-radius:10px;padding:9px 14px;cursor:pointer}.ph-gold-btn{background:linear-gradient(135deg,#f4cf75,#b97b18);color:#09263c;font-weight:900}.ph-brand-mini{color:#fff;display:flex;gap:8px;align-items:center}.ph-brand-mini span{color:#f4c35d;font-size:25px}.ph-results-head{display:flex;justify-content:space-between;align-items:center;padding:24px 20px 10px;color:#fff}.ph-results-head h1{margin:0;color:#f5c65d}.ph-results-head p{margin:4px 0;color:#a9bac7}.ph-search-results{margin:14px 20px;width:calc(100% - 40px)}.ph-member-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;padding:18px 20px 50px}.ph-member-card{display:grid;grid-template-columns:72px 1fr 25px;align-items:center;gap:11px;background:#fff;border:1px solid #dab05b;border-radius:15px;padding:10px;cursor:pointer;text-align:right;color:#09263c}.ph-member-photo{width:72px;height:72px;border-radius:12px;background:#e8eef2;display:grid;place-items:center;font-size:34px;overflow:hidden}.ph-member-photo img{width:100%;height:100%;object-fit:cover}.ph-member-body b,.ph-member-body span,.ph-member-body small{display:block}.ph-member-body span{font-size:12px;color:#3b566a}.ph-member-body small{font-size:10px;color:#758593;margin-top:4px}.ph-member-card i{font-style:normal}.ph-post-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:18px 20px 50px}.ph-post{background:#fff;border:1px solid #d8b15f;border-radius:15px;padding:14px;color:#09263c}.ph-post-top{display:flex;gap:9px;align-items:center}.ph-post-top small{display:block;color:#82909a;font-size:10px}.ph-avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#0c3a5a;color:#f5c55f;font-weight:900}.ph-post img{width:100%;max-height:330px;object-fit:cover;border-radius:10px}.ph-empty{grid-column:1/-1;text-align:center;color:#dbe5eb;padding:40px}
@media(max-width:900px){.ph-hero-inner{padding:12px 10px 18px}.ph-topbar{grid-template-columns:50px 1fr auto;gap:8px}.ph-logo strong{font-size:20px}.ph-logo span{font-size:9px}.ph-building{font-size:36px}.ph-actions .ph-icon-btn{display:none}.ph-login{height:40px;padding:0 10px;font-size:11px}.ph-search{width:96%;height:52px;margin:16px auto}.ph-carousel{grid-template-columns:.78fr 2.3fr .78fr;min-height:285px;gap:6px}.ph-carousel .ph-side2{display:none}.ph-main-ad{min-height:285px}.ph-side{min-height:235px;margin:20px 0;padding:12px 7px}.ph-side b{font-size:13px}.ph-side span{font-size:9px}.ph-ad-copy{inset:auto 16px 16px}.ph-ad-copy h2{font-size:21px}.ph-ad-copy p{font-size:11px}.ph-categories{grid-template-columns:repeat(2,1fr);gap:9px}.ph-cat-image{height:105px}.ph-cat-body{grid-template-columns:42px 1fr 22px;min-height:96px;padding:9px 7px}.ph-cat-icon{width:40px;height:40px;font-size:20px}.ph-cat-body b{font-size:18px}.ph-cat-body small{font-size:9px}.ph-trades{display:flex;overflow-x:auto}.ph-trades button{min-width:128px;height:145px}.ph-featured-grid{display:flex;overflow-x:auto}.ph-company{min-width:180px}.ph-company-img{height:120px}.ph-latest{grid-template-columns:1fr}.ph-section-card{padding:12px}.ph-section-head h2{font-size:20px}.ph-section-head span{display:none}.ph-member-grid{grid-template-columns:1fr;padding:12px}.ph-post-grid{grid-template-columns:1fr;padding:12px}.ph-results-head{padding:18px 12px 6px}.ph-search-results{margin:10px 12px;width:calc(100% - 24px)}.ph-content{padding:12px 9px 35px}}
`;
