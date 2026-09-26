import React, { useEffect, useMemo, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, getDocs, getFirestore,
  increment, limit, query, serverTimestamp, updateDoc, where
} from "firebase/firestore";
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
const auth = getAuth(app);

const FALLBACK_ADS = [
  {id:"a1",title:"مساحة إعلانية مميزة",subtitle:"اعرض شركتك وخدماتك أمام العملاء",imageUrl:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1800&q=88"},
  {id:"a2",title:"الأمل للدهانات الحديثة",subtitle:"ألوان وتشطيبات بجودة عالية",imageUrl:"https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1800&q=88"},
  {id:"a3",title:"سيراميك وبورسلين",subtitle:"أحدث الموديلات والتشطيبات",imageUrl:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=88"}
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
const isFeatured = m => Boolean(m.featured || m.isFeatured || m.promoted || m.isPromoted || ["pro","premium","business","featured","vip","elite"].includes(clean(m.plan).toLowerCase()));
const locationText = m => [m.governorate || m.gov, m.city, m.area].filter(Boolean).join(" • ") || "مصر";
const ratingValue = m => Number(m.rating || m.avgRating || 0);
const countValue = v => Array.isArray(v) ? v.length : Number(v || 0);

function Icon({name,size=21}){
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"};
  const paths={
    menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    company:<><path d="M4 21V5l8-3v19M12 8h8v13M7 7h2M7 11h2M7 15h2M15 11h2M15 15h2M15 19h2"/></>,
    supplier:<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.5 7.5 4 7.5-4M12 11.5V21"/></>,
    craftsman:<><circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M7 6h10M9 3h6"/></>,
    post:<><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    heart:<><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/></>,
    comment:<><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></>,
    share:<><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></>,
    location:<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    star:<><path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9z"/></>,
    arrow:<><path d="M19 12H5M12 19l-7-7 7-7"/></>,
    close:<><path d="M6 6l12 12M18 6 6 18"/></>,
  };
  return <svg {...common}>{paths[name]||paths.post}</svg>;
}

export default function HomeLanding(){
  const [ads,setAds] = useState(FALLBACK_ADS);
  const [members,setMembers] = useState([]);
  const [posts,setPosts] = useState([]);
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [adIndex,setAdIndex] = useState(0);
  const [commentsPost,setCommentsPost] = useState(null);

  useEffect(()=>{
    let alive = true;
    (async()=>{
      try{
        const [mSnap,pSnap,aSnap] = await Promise.all([
          getDocs(query(collection(db,"members"),limit(160))),
          getDocs(query(collection(db,"posts"),limit(40))).catch(()=>null),
          getDocs(query(collection(db,"ads"),where("status","==","active"),limit(30))).catch(()=>null),
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
      } catch(e){ console.warn("HomeLanding load error",e); }
      finally { if(alive) setLoading(false); }
    })();
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(ads.length<2) return;
    const t=setInterval(()=>setAdIndex(i=>(i+1)%ads.length),5200);
    return()=>clearInterval(t);
  },[ads.length]);

  const featuredCrafts = useMemo(()=>{ const list=members.filter(m=>memberType(m)==="craftsman"); return [...list.filter(isFeatured),...list.filter(m=>!isFeatured(m))].slice(0,8); },[members]);
  const featuredCompanies = useMemo(()=>{ const list=members.filter(m=>memberType(m)==="company"); return [...list.filter(isFeatured),...list.filter(m=>!isFeatured(m))].slice(0,6); },[members]);
  const suppliers = useMemo(()=>{ const list=members.filter(m=>memberType(m)==="supplier"); return [...list.filter(isFeatured),...list.filter(m=>!isFeatured(m))].slice(0,6); },[members]);

  const currentAd=ads[adIndex]||FALLBACK_ADS[0];
  const secondAd=ads[(adIndex+1)%ads.length]||FALLBACK_ADS[1];
  const openMember=m=>{ window.location.href=buildMemberPath(m); };
  const openAd=ad=>{
    const u=clean(ad.catalogUrl || ad.link || ad.url || ad.website || ad.targetUrl);
    if(u){ window.open(u,"_blank","noopener,noreferrer"); return; }
    const linked=members.find(m=>m.id===ad.memberId || m.id===ad.ownerId || m.uid===ad.memberId);
    if(linked){ openMember(linked); return; }
    const phone=String(ad.phone||"").replace(/\D/g,"");
    if(phone){ window.open(`https://wa.me/${phone.startsWith("20")?phone:`2${phone}`}`,"_blank","noopener,noreferrer"); }
  };
  const nextAd=()=>setAdIndex(i=>(i+1)%ads.length);
  const prevAd=()=>setAdIndex(i=>(i-1+ads.length)%ads.length);
  const goApp=tab=>{ window.location.href=`/?app=1${tab?`#${tab}`:""}`; };
  const doSearch=()=>{ const q=search.trim(); if(q) window.location.href=`/specialties/${encodeURIComponent(q)}`; };

  const toggleLike=async post=>{
    const user=auth.currentUser;
    if(!user){ goApp("login"); return; }
    const liked=Array.isArray(post.likedBy)&&post.likedBy.includes(user.uid);
    try{
      await updateDoc(doc(db,"posts",post.id),{ likedBy: liked?arrayRemove(user.uid):arrayUnion(user.uid), likes: increment(liked?-1:1) });
      setPosts(prev=>prev.map(p=>p.id===post.id?{...p,likedBy:liked?(p.likedBy||[]).filter(x=>x!==user.uid):[...(p.likedBy||[]),user.uid],likes:Math.max(0,countValue(p.likes)+(liked?-1:1))}:p));
    }catch(e){ console.warn("like failed",e); }
  };
  const sharePost=async post=>{
    const url=`${window.location.origin}/?app=1#posts`;
    const data={title:"الدليل الشامل",text:clean(post.content||post.text||post.caption)||"منشور من الدليل الشامل",url};
    try{ if(navigator.share) await navigator.share(data); else await navigator.clipboard.writeText(url); }catch{}
  };

  return <div className="dl-page" dir="rtl">
    <style>{styles}</style>

    <header className="dl-top-shell">
      <div className="dl-wrap">
        <div className="dl-topbar">
          <button className="dl-brand" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
            <div className="dl-logo-mark"><Icon name="company" size={29}/></div>
            <div><strong>الدليل الشامل</strong><span>للصنايعية والتشطيبات والمقاولات</span></div>
          </button>
          <div className="dl-nav-actions">
            <button className="dl-icon" aria-label="الإشعارات" onClick={()=>goApp("notifications")}><Icon name="bell"/></button>
            <button className="dl-login" onClick={()=>goApp("login")}>تسجيل الدخول</button>
            <button className="dl-icon" aria-label="القائمة" onClick={()=>goApp("menu")}><Icon name="menu"/></button>
          </div>
        </div>
        <div className="dl-search"><Icon name="search" size={23}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="ابحث عن صنايعي، شركة، مورد ..."/><button onClick={doSearch}>بحث</button></div>
      </div>
    </header>

    <main className="dl-main"><div className="dl-wrap">
      <section className="dl-ad-section">
        <div className="dl-section-head"><div><span className="dl-kicker">مساحات إعلانية</span><h2>إعلانات مميزة</h2><p>إعلانات كبيرة وواضحة ومتغيرة تلقائيًا</p></div><div className="dl-ad-controls"><button onClick={prevAd} aria-label="السابق">‹</button><button onClick={nextAd} aria-label="التالي">›</button></div></div>

        <button className="dl-ad-main" onClick={()=>openAd(currentAd)}>
          <img src={clean(currentAd.imageUrl||currentAd.image||currentAd.bannerUrl)||FALLBACK_ADS[0].imageUrl} alt={clean(currentAd.title)||"إعلان"}/>
          <div className="dl-ad-shade"/>
          <span className="dl-ad-badge">إعلان</span>
          <div className="dl-ad-copy"><h3>{clean(currentAd.title)||"إعلان مميز"}</h3><p>{clean(currentAd.subtitle||currentAd.description)||"اعرف التفاصيل والخدمات"}</p><span>عرض التفاصيل <Icon name="arrow" size={17}/></span></div>
        </button>

        <button className="dl-ad-second" onClick={()=>openAd(secondAd)}>
          <img src={clean(secondAd.imageUrl||secondAd.image||secondAd.bannerUrl)||FALLBACK_ADS[1].imageUrl} alt={clean(secondAd.title)||"إعلان"}/>
          <div className="dl-ad-shade second"/>
          <span className="dl-ad-badge">إعلان</span>
          <div className="dl-ad-copy small"><h3>{clean(secondAd.title)||"إعلان مميز"}</h3><span>عرض التفاصيل <Icon name="arrow" size={16}/></span></div>
        </button>

        <div className="dl-dots">{ads.slice(0,10).map((_,i)=><button aria-label={`الإعلان ${i+1}`} key={i} className={i===adIndex?"active":""} onClick={()=>setAdIndex(i)}/>)}</div>
      </section>

      <section className="dl-shortcuts">
        <Shortcut icon="company" title="شركات" subtitle="كل الشركات والمكاتب" onClick={()=>window.location.href="/companies"}/>
        <Shortcut icon="supplier" title="موردين" subtitle="مواد ومستلزمات البناء" onClick={()=>document.getElementById("suppliers")?.scrollIntoView({behavior:"smooth"})}/>
        <Shortcut icon="craftsman" title="صنايعية" subtitle="أفضل الصنايعية" onClick={()=>window.location.href="/craftsmen"}/>
        <Shortcut icon="post" title="منشورات" subtitle="منشورات الأعضاء" onClick={()=>document.getElementById("feed")?.scrollIntoView({behavior:"smooth"})}/>
      </section>

      <FeaturedSection title="الصنايعية المميزة" subtitle="اختيارات مميزة من الصنايعية داخل الدليل" icon="craftsman" onAll={()=>window.location.href="/craftsmen"} items={featuredCrafts} loading={loading} render={m=><CraftCard key={m.id} m={m} onClick={()=>openMember(m)}/>}/>
      <FeaturedSection title="الشركات المميزة" subtitle="شركات ومكاتب مميزة داخل الدليل" icon="company" onAll={()=>window.location.href="/companies"} items={featuredCompanies} loading={loading} render={m=><CompanyCard key={m.id} m={m} onClick={()=>openMember(m)}/>}/>
      <div id="suppliers"><FeaturedSection title="الموردين والكتالوجات" subtitle="موردين ومنتجات ومواد تشطيب" icon="supplier" onAll={()=>goApp("suppliers")} items={suppliers} loading={loading} render={m=><CompanyCard key={m.id} m={m} onClick={()=>openMember(m)} supplier/>}/></div>

      <section id="feed" className="dl-feed-section">
        <div className="dl-section-title"><div><h2><Icon name="post"/> المنشورات</h2><p>منشورات الأعضاء بشكل اجتماعي واضح وسهل</p></div></div>
        <div className="dl-feed-layout"><div className="dl-feed">
          {loading&&<div className="dl-empty">جاري تحميل المنشورات...</div>}
          {!loading&&posts.length===0&&<div className="dl-empty">لا توجد منشورات حاليًا</div>}
          {posts.map(p=><PostCard key={p.id} p={p} onLike={()=>toggleLike(p)} onComments={()=>setCommentsPost(p)} onShare={()=>sharePost(p)}/>) }
        </div><aside className="dl-sidebox"><div className="dl-side-icon"><Icon name="company" size={30}/></div><b>الدليل الشامل</b><p>كل ما تحتاجه في التشطيبات والمقاولات في مكان واحد.</p><button onClick={()=>goApp("register")}>أضف نشاطك</button></aside></div>
      </section>
    </div></main>
    {commentsPost&&<CommentsModal post={commentsPost} onClose={()=>setCommentsPost(null)} onAdded={()=>setPosts(prev=>prev.map(p=>p.id===commentsPost.id?{...p,comments:countValue(p.comments)+1}:p))}/>} 
  </div>;
}

function Shortcut({icon,title,subtitle,onClick}){
  return <button className="dl-shortcut" onClick={onClick}><span><Icon name={icon} size={30}/></span><div><b>{title}</b><small>{subtitle}</small></div><i><Icon name="arrow" size={18}/></i></button>;
}
function FeaturedSection({title,subtitle,icon,onAll,items,loading,render}){
  return <section className="dl-featured"><div className="dl-section-title"><div><h2><Icon name={icon}/> {title}</h2><p>{subtitle}</p></div><button onClick={onAll}>عرض الكل <Icon name="arrow" size={16}/></button></div><div className="dl-hscroll">{loading?<div className="dl-empty">جاري التحميل...</div>:items.length?items.map(render):<div className="dl-empty">لا توجد بيانات متاحة حاليًا</div>}</div></section>;
}
function CraftCard({m,onClick}){ const img=memberImage(m), r=ratingValue(m); return <button className="dl-person-card" onClick={onClick}><div className="dl-person-img">{img?<img src={img} alt={m.name||"صنايعي"}/>:<span><Icon name="craftsman" size={39}/></span>}</div><div className="dl-person-info"><div className="dl-name-row"><b>{m.name||"عضو الدليل"}</b>{r>0&&<em><Icon name="star" size={13}/> {r.toFixed(1)}</em>}</div><small>{m.specialty||m.category||"تشطيبات ومقاولات"}</small><span><Icon name="location" size={14}/> {locationText(m)}</span></div><strong className="dl-card-cta">عرض الملف</strong></button>; }
function CompanyCard({m,onClick,supplier}){ const img=memberImage(m), r=ratingValue(m); return <button className="dl-company-card" onClick={onClick}><div className="dl-company-img">{img?<img src={img} alt={m.name||"شركة"}/>:<span><Icon name={supplier?"supplier":"company"} size={42}/></span>}</div><div className="dl-company-info"><div className="dl-name-row"><b>{m.name||"عضو الدليل"}</b>{r>0&&<em><Icon name="star" size={13}/> {r.toFixed(1)}</em>}</div><small>{m.specialty||m.category||(supplier?"مورد مواد تشطيب":"مقاولات وتشطيبات")}</small><span><Icon name="location" size={14}/> {locationText(m)}</span></div></button>; }

function PostCard({p,onLike,onComments,onShare}){
  const img=postImage(p), avatar=clean(p.authorAvatar||p.avatar||p.profileImage||p.profileImageUrl), user=auth.currentUser;
  const liked=Boolean(user&&Array.isArray(p.likedBy)&&p.likedBy.includes(user.uid));
  return <article className="dl-post"><div className="dl-post-head"><div className="dl-post-avatar">{avatar?<img src={avatar} alt=""/>:<Icon name="craftsman" size={24}/>}</div><div><b>{p.authorName||p.name||p.author||"عضو الدليل"}</b><small>منشور على الدليل الشامل</small></div></div><p>{p.content||p.text||p.caption||"منشور جديد"}</p>{img&&<img className="dl-post-img" src={img} alt=""/>}<div className="dl-post-meta"><span>{countValue(p.likes)} إعجاب</span><span>{countValue(p.comments)} تعليق • {countValue(p.shares)} مشاركة</span></div><div className="dl-post-actions"><button className={liked?"liked":""} onClick={onLike}><Icon name="heart"/> <span>إعجاب</span></button><button onClick={onComments}><Icon name="comment"/> <span>تعليق</span></button><button onClick={onShare}><Icon name="share"/> <span>مشاركة</span></button></div></article>;
}

function CommentsModal({post,onClose,onAdded}){
  const [comments,setComments]=useState([]),[loading,setLoading]=useState(true),[text,setText]=useState(""),[sending,setSending]=useState(false);
  useEffect(()=>{ let alive=true; (async()=>{ try{ const snap=await getDocs(query(collection(db,"posts",post.id,"comments"),limit(100))); if(alive)setComments(snap.docs.map(d=>({id:d.id,...d.data()}))); }catch{} finally{if(alive)setLoading(false);} })(); return()=>{alive=false}; },[post.id]);
  const submit=async()=>{ const user=auth.currentUser; if(!user){ window.location.href="/?app=1#login"; return; } if(!text.trim()||sending)return; setSending(true); try{ const payload={authorId:user.uid,authorName:user.displayName||"عضو الدليل",text:text.trim(),createdAt:serverTimestamp(),likes:0,likedBy:[]}; const ref=await addDoc(collection(db,"posts",post.id,"comments"),payload); await updateDoc(doc(db,"posts",post.id),{comments:increment(1)}).catch(()=>{}); setComments(prev=>[{id:ref.id,...payload,createdAt:new Date()},...prev]); setText(""); onAdded?.(); }catch(e){console.warn("comment failed",e);} finally{setSending(false);} };
  return <div className="dl-modal-backdrop" onMouseDown={onClose}><div className="dl-comments-modal" onMouseDown={e=>e.stopPropagation()}><div className="dl-modal-head"><div><b>التعليقات</b><small>{comments.length} تعليق</small></div><button onClick={onClose}><Icon name="close"/></button></div><div className="dl-comments-list">{loading?<div className="dl-empty">جاري تحميل التعليقات...</div>:comments.length?comments.map(c=><div className="dl-comment" key={c.id}><div className="dl-comment-avatar"><Icon name="craftsman" size={18}/></div><div><b>{c.authorName||c.name||"عضو الدليل"}</b><p>{c.text||c.content||""}</p></div></div>):<div className="dl-empty">كن أول من يعلق</div>}</div><div className="dl-comment-compose"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={auth.currentUser?"اكتب تعليقك...":"سجل الدخول لكتابة تعليق"}/><button onClick={submit} disabled={sending}>{sending?"...":"إرسال"}</button></div></div></div>;
}

const styles=`
:root{--navy:#082a43;--navy2:#0c3b5c;--gold:#d6aa43;--gold2:#f2d27f;--cream:#f7f3eb;--white:#fff;--text:#12283b;--muted:#75828b;--line:#e8dfd1}
.dl-page{min-height:100vh;background:var(--cream);color:var(--text);font-family:'Cairo',sans-serif}.dl-page button{font-family:inherit}.dl-wrap{max-width:1280px;margin:auto;padding:0 24px}
.dl-top-shell{background:linear-gradient(135deg,#08263d,#0b3554);padding:18px 0 22px;border-bottom:1px solid rgba(214,170,67,.45)}
.dl-topbar{display:flex;align-items:center;justify-content:space-between;gap:18px}.dl-brand{border:0;background:transparent;display:flex;align-items:center;gap:12px;color:#fff;text-align:right;cursor:pointer}.dl-logo-mark{width:54px;height:54px;border:1px solid rgba(214,170,67,.65);border-radius:16px;display:grid;place-items:center;color:var(--gold2);background:rgba(255,255,255,.04)}.dl-brand strong{display:block;color:var(--gold2);font-size:28px;line-height:1;font-weight:900}.dl-brand span{display:block;font-size:11px;color:rgba(255,255,255,.7);margin-top:7px}.dl-nav-actions{display:flex;align-items:center;gap:9px}.dl-icon,.dl-login{border:1px solid rgba(214,170,67,.7);background:rgba(255,255,255,.035);color:#fff;border-radius:13px;cursor:pointer}.dl-icon{width:46px;height:46px;display:grid;place-items:center}.dl-login{height:46px;padding:0 22px;font-weight:800}
.dl-search{max-width:920px;margin:16px auto 0;background:#fff;border:1px solid rgba(214,170,67,.78);border-radius:17px;height:58px;display:flex;align-items:center;gap:9px;padding:0 9px 0 15px;color:var(--navy);box-shadow:0 12px 30px rgba(0,0,0,.14)}.dl-search input{flex:1;border:0;background:transparent;height:100%;font-size:15px;color:var(--text)}.dl-search button{border:0;background:linear-gradient(135deg,var(--gold),var(--gold2));height:42px;padding:0 30px;border-radius:12px;color:var(--navy);font-weight:900;cursor:pointer}
.dl-main{padding:26px 0 60px}.dl-ad-section{background:#fff;border:1px solid var(--line);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(8,42,67,.09);margin-bottom:22px}.dl-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:14px}.dl-section-head h2{margin:2px 0 0;color:var(--navy);font-size:27px}.dl-section-head p{margin:3px 0 0;color:var(--muted);font-size:11px}.dl-kicker{font-size:10px;color:#9b761f;font-weight:900;background:#fbf4df;border:1px solid #efdfaa;padding:4px 8px;border-radius:999px}.dl-ad-controls{display:flex;gap:7px}.dl-ad-controls button{width:40px;height:40px;border-radius:50%;border:1px solid #d9c99f;background:var(--navy);color:#fff;font-size:25px;cursor:pointer}
.dl-ad-main,.dl-ad-second{position:relative;width:100%;padding:0;border:0;overflow:hidden;cursor:pointer;text-align:right;background:#102a3b}.dl-ad-main{height:390px;border-radius:20px}.dl-ad-second{height:170px;border-radius:17px;margin-top:12px}.dl-ad-main img,.dl-ad-second img{width:100%;height:100%;object-fit:cover;display:block}.dl-ad-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(4,24,40,.03),rgba(4,24,40,.16) 48%,rgba(4,24,40,.84))}.dl-ad-shade.second{background:linear-gradient(90deg,rgba(4,24,40,.02),rgba(4,24,40,.72))}.dl-ad-badge{position:absolute;top:15px;right:15px;background:var(--gold2);color:var(--navy);font-size:10px;font-weight:900;padding:6px 11px;border-radius:999px}.dl-ad-copy{position:absolute;right:28px;top:50%;transform:translateY(-50%);color:#fff;max-width:480px}.dl-ad-copy h3{margin:0 0 7px;font-size:32px;line-height:1.25}.dl-ad-copy p{margin:0 0 16px;color:rgba(255,255,255,.78);font-size:14px}.dl-ad-copy>span{display:inline-flex;align-items:center;gap:6px;background:var(--gold2);color:var(--navy);padding:10px 15px;border-radius:11px;font-weight:900}.dl-ad-copy.small h3{font-size:22px}.dl-dots{display:flex;justify-content:center;gap:7px;padding-top:13px}.dl-dots button{width:8px;height:8px;border:0;border-radius:50%;background:#ccd4d9;padding:0;cursor:pointer}.dl-dots button.active{width:28px;border-radius:999px;background:var(--gold)}
.dl-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}.dl-shortcut{border:1px solid var(--line);background:#fff;border-radius:17px;min-height:98px;padding:16px;display:flex;align-items:center;gap:12px;text-align:right;color:var(--navy);cursor:pointer;box-shadow:0 8px 24px rgba(8,42,67,.055)}.dl-shortcut>span{width:48px;height:48px;border-radius:14px;background:#f8f0dc;color:#a57a19;display:grid;place-items:center;flex:none}.dl-shortcut div{flex:1}.dl-shortcut b{display:block;font-size:18px}.dl-shortcut small{display:block;color:var(--muted);font-size:10px;margin-top:4px}.dl-shortcut i{width:34px;height:34px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-style:normal}
.dl-featured,.dl-feed-section{margin-top:31px}.dl-section-title{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:12px}.dl-section-title h2{margin:0;font-size:25px;color:var(--navy);display:flex;gap:8px;align-items:center}.dl-section-title h2 svg{color:var(--gold)}.dl-section-title p{margin:3px 0 0;color:var(--muted);font-size:12px}.dl-section-title>button{border:0;background:var(--navy);color:#fff;border-radius:12px;padding:9px 16px;font-weight:800;display:flex;gap:7px;align-items:center;cursor:pointer}.dl-hscroll{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 12px;scroll-snap-type:x proximity}.dl-person-card,.dl-company-card{border:1px solid var(--line);background:#fff;border-radius:16px;padding:0;text-align:right;overflow:hidden;cursor:pointer;box-shadow:0 8px 24px rgba(8,42,67,.07);flex:0 0 220px;scroll-snap-align:start;color:var(--text)}.dl-company-card{flex-basis:260px}.dl-person-img,.dl-company-img{height:145px;background:#edf2f5;display:grid;place-items:center;color:var(--navy)}.dl-company-img{height:150px}.dl-person-img img,.dl-company-img img{width:100%;height:100%;object-fit:cover}.dl-person-info,.dl-company-info{padding:12px 13px}.dl-name-row{display:flex;gap:6px;align-items:center;justify-content:space-between}.dl-name-row b{font-size:14px}.dl-name-row em{font-style:normal;color:#a97713;font-weight:900;font-size:11px;display:flex;align-items:center;gap:3px}.dl-person-info small,.dl-company-info small{display:block;color:#536777;font-size:11px;margin:5px 0}.dl-person-info>span,.dl-company-info>span{display:flex;align-items:center;gap:4px;color:#83919b;font-size:10.5px}.dl-card-cta{display:block;margin:0 12px 13px;text-align:center;background:var(--navy);color:#fff;border-radius:9px;padding:8px;font-size:11px}
.dl-feed-layout{display:grid;grid-template-columns:minmax(0,720px) 280px;gap:22px;justify-content:center;align-items:start}.dl-feed{display:flex;flex-direction:column;gap:16px}.dl-post{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 8px 26px rgba(8,42,67,.07)}.dl-post-head{display:flex;gap:10px;align-items:center;padding:15px 17px 9px}.dl-post-avatar{width:44px;height:44px;border-radius:50%;overflow:hidden;background:#edf2f5;color:var(--navy);display:grid;place-items:center;border:1px solid #e2e8ec}.dl-post-avatar img{width:100%;height:100%;object-fit:cover}.dl-post-head b{display:block;font-size:13px}.dl-post-head small{display:block;color:var(--muted);font-size:10px;margin-top:2px}.dl-post>p{padding:2px 17px 12px;margin:0;line-height:1.8;font-size:13px}.dl-post-img{display:block;width:100%;max-height:520px;object-fit:cover;background:#eee}.dl-post-meta{display:flex;justify-content:space-between;padding:10px 17px;color:#7c8a94;font-size:10px;border-bottom:1px solid #edf0f2}.dl-post-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:7px}.dl-post-actions button{border:0;background:transparent;color:#536777;border-radius:9px;height:40px;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;font-weight:700}.dl-post-actions button:hover{background:#f4f6f7}.dl-post-actions button.liked{color:#c33}.dl-sidebox{position:sticky;top:20px;background:linear-gradient(145deg,var(--navy),var(--navy2));color:#fff;border:1px solid rgba(214,170,67,.55);border-radius:18px;padding:22px}.dl-side-icon{width:52px;height:52px;border-radius:15px;background:rgba(214,170,67,.14);color:var(--gold2);display:grid;place-items:center;margin-bottom:10px}.dl-sidebox b{font-size:20px;color:var(--gold2)}.dl-sidebox p{font-size:12px;line-height:1.8;color:rgba(255,255,255,.72)}.dl-sidebox button{width:100%;border:0;border-radius:11px;background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--navy);height:42px;font-weight:900;cursor:pointer}.dl-empty{width:100%;padding:35px;text-align:center;color:var(--muted);background:#fff;border:1px dashed var(--line);border-radius:14px}
.dl-modal-backdrop{position:fixed;inset:0;background:rgba(3,20,34,.66);z-index:9999;display:grid;place-items:center;padding:18px}.dl-comments-modal{width:min(620px,100%);max-height:min(760px,92vh);background:#fff;border-radius:20px;overflow:hidden;display:flex;flex-direction:column}.dl-modal-head{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-bottom:1px solid var(--line)}.dl-modal-head b{display:block;font-size:18px}.dl-modal-head small{display:block;color:var(--muted);font-size:10px}.dl-modal-head button{border:0;background:#eef2f4;color:var(--navy);width:38px;height:38px;border-radius:50%;display:grid;place-items:center;cursor:pointer}.dl-comments-list{padding:14px;overflow:auto;min-height:210px;display:flex;flex-direction:column;gap:12px}.dl-comment{display:flex;gap:9px;align-items:flex-start}.dl-comment-avatar{width:36px;height:36px;border-radius:50%;background:#edf2f5;color:var(--navy);display:grid;place-items:center;flex:none}.dl-comment>div:last-child{background:#f2f5f6;border-radius:12px;padding:9px 11px;min-width:130px}.dl-comment b{font-size:11px}.dl-comment p{margin:3px 0 0;font-size:12px;line-height:1.65}.dl-comment-compose{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}.dl-comment-compose input{flex:1;border:1px solid #dfe5e8;border-radius:12px;padding:0 13px;min-height:44px}.dl-comment-compose button{border:0;background:var(--navy);color:#fff;border-radius:11px;padding:0 20px;font-weight:900;cursor:pointer}
@media(max-width:900px){.dl-wrap{padding:0 14px}.dl-brand strong{font-size:22px}.dl-brand span{font-size:9px}.dl-shortcuts{grid-template-columns:repeat(2,1fr)}.dl-feed-layout{grid-template-columns:1fr}.dl-sidebox{position:static}.dl-ad-main{height:340px}.dl-ad-second{height:150px}}
@media(max-width:560px){.dl-top-shell{padding:12px 0 16px}.dl-topbar{gap:9px}.dl-brand{gap:8px}.dl-logo-mark{width:44px;height:44px;border-radius:13px}.dl-brand strong{font-size:19px}.dl-brand span{display:none}.dl-nav-actions{gap:5px}.dl-icon{width:40px;height:40px}.dl-login{height:40px;padding:0 12px;font-size:11px}.dl-search{height:52px;margin-top:12px}.dl-search input{font-size:12px;min-width:0}.dl-search button{padding:0 16px}.dl-main{padding-top:16px}.dl-ad-section{padding:11px;border-radius:18px}.dl-section-head h2{font-size:22px}.dl-section-head p{display:none}.dl-ad-controls button{width:36px;height:36px}.dl-ad-main{height:255px;border-radius:15px}.dl-ad-second{height:120px;border-radius:14px;margin-top:9px}.dl-ad-copy{right:16px;left:16px}.dl-ad-copy h3{font-size:21px}.dl-ad-copy p{font-size:11px;margin-bottom:11px;max-width:78%}.dl-ad-copy>span{padding:8px 11px;font-size:10px}.dl-ad-copy.small h3{font-size:16px}.dl-ad-badge{top:10px;right:10px;padding:5px 9px}.dl-shortcuts{gap:8px}.dl-shortcut{min-height:86px;padding:11px;gap:8px}.dl-shortcut>span{width:40px;height:40px}.dl-shortcut b{font-size:14px}.dl-shortcut small{font-size:8.5px}.dl-shortcut i{display:none}.dl-section-title{align-items:center}.dl-section-title h2{font-size:20px}.dl-section-title p{font-size:10px}.dl-section-title>button{padding:8px 11px;font-size:10px}.dl-person-card{flex-basis:190px}.dl-company-card{flex-basis:225px}.dl-post-meta{font-size:9px}.dl-post-actions button span{font-size:11px}}
`;
