import React, { useEffect, useMemo, useState } from "react";
import {
  collection, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, doc,
  query, where, serverTimestamp
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const GOLD = "#C9A84C";
const GOLD_DARK = "#9E7B28";
const NAVY = "#0A1F44";
const NAVY_DEEP = "#060E1C";
const OFF_WHITE = "#F7F5F0";
const GRAY = "#667085";
const BORDER = "#E5E7EB";

export const CATALOG_DEFAULT_CATEGORIES = [
  ["ceramic","🧱","سيراميك وبورسلين"],["marble","⬜","رخام وجرانيت"],["paint","🎨","دهانات"],
  ["sanitary","🚿","أدوات صحية"],["mixers","🚰","خلاطات"],["electric","💡","كهرباء وإنارة"],
  ["doors","🚪","أبواب"],["glass","🪟","زجاج وألوميتال"],["gypsum","🏛️","جبس وديكورات"],
  ["building","🏗️","مواد بناء"],["insulation","🛡️","مواد عزل"],["kitchens","🍽️","مطابخ"],
  ["furniture","🛋️","أثاث"],["alternatives","🪵","بدائل خشب ورخام"],["wallpaper","🖼️","ورق حائط"],
  ["accessories","🔩","إكسسوارات تشطيب"],
];

const emptyBusiness = {
  name:"", activityType:"محل", description:"", governorate:"", area:"", address:"",
  branches:"", phones:"", whatsapp:"", mapUrl:"", facebook:"", instagram:"", website:"",
  logoUrl:"", coverUrl:"", active:true, featured:false, offers:""
};
const emptyProduct = {
  name:"", code:"", categoryId:"", businessId:"", size:"", color:"", material:"",
  specs:"", description:"", price:"", showPrice:true, availability:"متوفر",
  discount:"", mainImage:"", images:[], active:true, featured:false, attributes:{}
};
const emptyAttribute = { name:"", key:"", values:"", filterable:true, active:true, categoryId:"" };

const normalize = (v="") => String(v).trim().toLowerCase()
  .replace(/[إأآا]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه");
const lines = (v="") => String(v).split(/\n|,/).map(x=>x.trim()).filter(Boolean);
const money = n => Number(n||0).toLocaleString("ar-EG");
const isMobileNow = () => typeof window !== "undefined" && window.innerWidth < 768;

function useMobile() {
  const [mobile,setMobile] = useState(isMobileNow);
  useEffect(()=>{
    const fn=()=>setMobile(isMobileNow());
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);
  return mobile;
}

const catalogUrl = (businessId) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://eldalel-elshamel.online";
  return `${origin}/?catalog=business&businessId=${encodeURIComponent(businessId)}`;
};
const qrUrl = id => `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=${encodeURIComponent(catalogUrl(id))}`;

function cardColors(darkMode){
  return {
    bg: darkMode ? NAVY_DEEP : OFF_WHITE,
    card: darkMode ? "#0F2748" : "#fff",
    tc: darkMode ? "#fff" : NAVY,
    sub: darkMode ? "rgba(255,255,255,.58)" : GRAY,
    border: darkMode ? "rgba(201,168,76,.16)" : BORDER,
    input: darkMode ? "rgba(255,255,255,.07)" : "#fff"
  };
}
function Btn({children,onClick,secondary=false,disabled=false,style={}}){
  return <button disabled={disabled} onClick={onClick} style={{
    border: secondary?`1px solid ${GOLD}`:"none", borderRadius:11, padding:"10px 14px",
    background: secondary?"transparent":`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
    color: secondary?GOLD:NAVY_DEEP, fontFamily:"Cairo,Tajawal,sans-serif", fontWeight:800,
    cursor:disabled?"not-allowed":"pointer", opacity:disabled?.55:1, ...style
  }}>{children}</button>;
}
function Img({src,alt,style={}}){
  return src
    ? <img src={src} alt={alt||""} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",...style}}/>
    : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,background:"linear-gradient(135deg,#F1E8C8,#E8DFC1)",color:NAVY}}>🧱</div>;
}

async function getActive(db, name){
  const snap = await getDocs(query(collection(db,name),where("active","==",true)));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function getAll(db,name){
  const snap=await getDocs(collection(db,name));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function uploadImage(storage, path, file){
  if(!file) return "";
  if(!file.type?.startsWith("image/")) throw new Error("الملف لازم يكون صورة");
  if(file.size > 8*1024*1024) throw new Error("حجم الصورة أكبر من 8 ميجا");
  const safe=(file.name||"image").replace(/[^\w.\-]/g,"_");
  const r=storageRef(storage,`${path}/${Date.now()}_${safe}`);
  await uploadBytes(r,file,{contentType:file.type});
  return getDownloadURL(r);
}

function SectionTitle({title,sub,action,darkMode}){
  const c=cardColors(darkMode);
  return <div style={{display:"flex",alignItems:"end",justifyContent:"space-between",gap:12,marginBottom:14}}>
    <div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:20,color:c.tc}}>{title}</div>
      {sub&&<div style={{fontSize:12.5,color:c.sub,marginTop:3}}>{sub}</div>}</div>
    {action}
  </div>;
}

export function CatalogHomeSection({db,darkMode,onOpen}){
  const c=cardColors(darkMode), mobile=useMobile();
  const [cats,setCats]=useState([]), [products,setProducts]=useState([]), [businesses,setBusinesses]=useState([]);
  useEffect(()=>{
    Promise.all([getActive(db,"catalogCategories"),getActive(db,"catalogProducts"),getActive(db,"catalogBusinesses")])
      .then(([a,b,d])=>{setCats(a);setProducts(b);setBusinesses(d);}).catch(()=>{});
  },[db]);
  const shownCats = cats.length ? cats.slice(0,mobile?4:6) :
    CATALOG_DEFAULT_CATEGORIES.slice(0,mobile?4:6).map(([id,icon,name])=>({id,icon,name}));
  const featured=products.filter(p=>p.featured).slice(0,mobile?2:4);
  return <section style={{maxWidth:1200,margin:"18px auto 0",padding:mobile?"0 14px":"0 28px"}}>
    <div style={{background:`linear-gradient(145deg,${NAVY_DEEP},${NAVY})`,borderRadius:mobile?18:24,padding:mobile?16:24,border:"1px solid rgba(201,168,76,.25)",boxShadow:"0 14px 35px rgba(6,14,28,.12)"}}>
      <SectionTitle darkMode={true} title="كتالوج مواد التشطيب" sub="محلات • مصانع • توكيلات • منتجات وخامات" action={<Btn onClick={onOpen} secondary>عرض الكتالوج</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:Math.min(6,shownCats.length||1)},1fr)`,gap:9}}>
        {shownCats.map(cat=><div key={cat.id} onClick={onOpen} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(201,168,76,.16)",borderRadius:13,padding:"12px 8px",textAlign:"center",cursor:"pointer"}}>
          <div style={{fontSize:23,marginBottom:5}}>{cat.icon||"🧱"}</div>
          <div style={{color:"white",fontWeight:800,fontSize:11.5}}>{cat.name}</div>
        </div>)}
      </div>
      {featured.length>0&&<div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},1fr)`,gap:9,marginTop:12}}>
        {featured.map(p=><div key={p.id} onClick={onOpen} style={{background:"rgba(255,255,255,.06)",borderRadius:13,overflow:"hidden",cursor:"pointer",border:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{height:mobile?90:125}}><Img src={p.mainImage} alt={p.name}/></div>
          <div style={{padding:9,color:"white",fontSize:11.5,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
        </div>)}
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,color:"rgba(255,255,255,.62)",fontSize:11.5}}>
        <span>{businesses.length ? `${businesses.length} مورد ومتجر متاح` : "اكتشف خامات ومنتجات التشطيب"}</span>
        <span style={{color:GOLD,fontWeight:800,cursor:"pointer"}} onClick={onOpen}>دخول الكتالوج ◀</span>
      </div>
    </div>
  </section>;
}

function ProductCard({p,business,category,onOpen,darkMode}){
  const c=cardColors(darkMode);
  return <div onClick={()=>onOpen(p)} style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:15,overflow:"hidden",cursor:"pointer",minWidth:0}}>
    <div style={{height:155,position:"relative"}}><Img src={p.mainImage} alt={p.name}/>
      {p.discount&&<span style={{position:"absolute",top:9,right:9,background:"#EF4444",color:"white",borderRadius:20,padding:"4px 8px",fontSize:10,fontWeight:900}}>{p.discount}</span>}
      {p.featured&&<span style={{position:"absolute",top:9,left:9,background:GOLD,color:NAVY_DEEP,borderRadius:20,padding:"4px 8px",fontSize:10,fontWeight:900}}>مميز</span>}
    </div>
    <div style={{padding:11}}>
      <div style={{fontSize:10.5,color:GOLD,fontWeight:800,marginBottom:3}}>{category?.name||""}</div>
      <div style={{fontWeight:900,color:c.tc,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
      <div style={{color:c.sub,fontSize:11,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{business?.name||""}{p.size?` • ${p.size}`:""}{p.color?` • ${p.color}`:""}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        <span style={{fontWeight:900,color:p.showPrice!==false&&p.price?GOLD:c.sub,fontSize:13}}>{p.showPrice!==false&&p.price?`${money(p.price)} ج`:"اسأل عن السعر"}</span>
        <span style={{fontSize:10.5,color:p.availability==="غير متوفر"?"#EF4444":"#16A34A"}}>{p.availability||"متوفر"}</span>
      </div>
    </div>
  </div>;
}

function BusinessCard({b,onOpen,darkMode}){
  const c=cardColors(darkMode);
  return <div onClick={()=>onOpen(b)} style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:16,overflow:"hidden",cursor:"pointer"}}>
    <div style={{height:105,position:"relative"}}><Img src={b.coverUrl||b.logoUrl} alt={b.name}/>
      <div style={{position:"absolute",bottom:-24,right:12,width:52,height:52,borderRadius:13,overflow:"hidden",border:`3px solid ${c.card}`,background:"#fff"}}><Img src={b.logoUrl} alt={b.name}/></div>
    </div>
    <div style={{padding:"31px 12px 12px"}}>
      <div style={{fontWeight:900,color:c.tc,fontSize:14}}>{b.name}</div>
      <div style={{color:c.sub,fontSize:11.5,marginTop:3}}>{b.activityType||"مورد"}{b.governorate?` • ${b.governorate}`:""}</div>
    </div>
  </div>;
}

function ProductDetails({p,business,category,onBack,darkMode}){
  const c=cardColors(darkMode), mobile=useMobile();
  const images=[p.mainImage,...(p.images||[])].filter(Boolean);
  const [img,setImg]=useState(images[0]||"");
  const phone=(business?.phones||"").split(/[,\n]/).map(x=>x.trim()).find(Boolean)||"";
  const wa=(business?.whatsapp||phone).replace(/\D/g,"");
  const share=async()=>{
    const data={title:p.name,text:`${p.name}${business?.name?` - ${business.name}`:""}`,url:window.location.href};
    if(navigator.share) await navigator.share(data).catch(()=>{});
    else { await navigator.clipboard?.writeText(window.location.href); alert("تم نسخ رابط المنتج"); }
  };
  return <div>
    <button onClick={onBack} style={{background:"none",border:0,color:GOLD,fontWeight:800,cursor:"pointer",marginBottom:12}}>→ رجوع للكتالوج</button>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1.05fr .95fr",gap:20}}>
      <div>
        <div style={{height:mobile?300:430,borderRadius:18,overflow:"hidden",background:c.card,border:`1px solid ${c.border}`}}><Img src={img} alt={p.name}/></div>
        {images.length>1&&<div style={{display:"flex",gap:8,overflowX:"auto",marginTop:8}}>{images.map((x,i)=><div key={i} onClick={()=>setImg(x)} style={{width:68,height:68,borderRadius:9,overflow:"hidden",flexShrink:0,border:`2px solid ${img===x?GOLD:c.border}`,cursor:"pointer"}}><Img src={x}/></div>)}</div>}
      </div>
      <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:18,padding:18}}>
        <div style={{color:GOLD,fontWeight:800,fontSize:12}}>{category?.name}</div>
        <h1 style={{fontFamily:"Cairo",color:c.tc,fontSize:24,margin:"5px 0 8px"}}>{p.name}</h1>
        {p.code&&<div style={{color:c.sub,fontSize:12}}>كود المنتج: {p.code}</div>}
        <div style={{fontSize:22,fontWeight:900,color:p.showPrice!==false&&p.price?GOLD:c.sub,margin:"16px 0"}}>{p.showPrice!==false&&p.price?`${money(p.price)} جنيه`:"اسأل عن السعر"}</div>
        {p.discount&&<div style={{display:"inline-block",background:"#FEF2F2",color:"#DC2626",borderRadius:9,padding:"6px 9px",fontWeight:800,fontSize:12,marginBottom:12}}>عرض: {p.discount}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"12px 0"}}>
          {[["المقاس",p.size],["اللون",p.color],["الخامة",p.material],["التوفر",p.availability]].filter(x=>x[1]).map(([k,v])=><div key={k} style={{background:darkMode?"rgba(255,255,255,.04)":"#F8FAFC",borderRadius:10,padding:10}}><div style={{fontSize:10.5,color:c.sub}}>{k}</div><div style={{fontSize:12.5,fontWeight:800,color:c.tc,marginTop:2}}>{v}</div></div>)}
        </div>
        {Object.entries(p.attributes||{}).filter(([,v])=>v).map(([k,v])=><div key={k} style={{fontSize:12.5,color:c.tc,margin:"6px 0"}}><b>{k}:</b> {String(v)}</div>)}
        {p.description&&<p style={{color:c.sub,lineHeight:1.8,fontSize:13.5}}>{p.description}</p>}
        {p.specs&&<div style={{color:c.tc,lineHeight:1.8,fontSize:13,whiteSpace:"pre-wrap",marginTop:9}}>{p.specs}</div>}
        {business&&<div style={{borderTop:`1px solid ${c.border}`,marginTop:16,paddingTop:14}}><div style={{fontWeight:900,color:c.tc}}>{business.name}</div><div style={{fontSize:12,color:c.sub,marginTop:3}}>{business.address||business.governorate}</div></div>}
        <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(2,1fr)",gap:8,marginTop:16}}>
          <Btn onClick={()=>wa&&window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`مرحباً، أريد الاستفسار عن منتج ${p.name}`)}`)}>واتساب</Btn>
          <Btn secondary onClick={()=>phone&&(window.location.href=`tel:${phone}`)}>اتصال</Btn>
          <Btn secondary onClick={()=>wa&&window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`أريد التواصل بخصوص ${p.name}`)}`)} style={{gridColumn:"1/-1"}}>تواصل مع المورد</Btn>
          <Btn secondary onClick={share} style={{gridColumn:"1/-1"}}>شارك المنتج</Btn>
        </div>
      </div>
    </div>
  </div>;
}

function BusinessDetails({b,products,categories,onBack,onProduct,darkMode}){
  const c=cardColors(darkMode), mobile=useMobile();
  const phones=lines(b.phones), branches=lines(b.branches), wa=(b.whatsapp||phones[0]||"").replace(/\D/g,"");
  return <div>
    <button onClick={onBack} style={{background:"none",border:0,color:GOLD,fontWeight:800,cursor:"pointer",marginBottom:12}}>→ رجوع للكتالوج</button>
    <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:20,overflow:"hidden",marginBottom:20}}>
      <div style={{height:mobile?170:260}}><Img src={b.coverUrl||b.logoUrl} alt={b.name}/></div>
      <div style={{padding:mobile?15:22,display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div style={{width:72,height:72,borderRadius:16,overflow:"hidden",border:`1px solid ${c.border}`,background:"#fff",flexShrink:0}}><Img src={b.logoUrl} alt={b.name}/></div>
        <div style={{flex:1,minWidth:190}}><h1 style={{fontFamily:"Cairo",fontSize:22,color:c.tc,margin:0}}>{b.name}</h1>
          <div style={{color:GOLD,fontSize:12.5,fontWeight:800,marginTop:3}}>{b.activityType}</div>
          <div style={{color:c.sub,fontSize:12.5,marginTop:5}}>{[b.governorate,b.area,b.address].filter(Boolean).join(" • ")}</div>
        </div>
        <img src={qrUrl(b.id)} alt={`QR ${b.name}`} style={{width:74,height:74,borderRadius:8}}/>
      </div>
      {b.description&&<p style={{padding:"0 20px 18px",color:c.sub,lineHeight:1.8,fontSize:13.5,margin:0}}>{b.description}</p>}
      <div style={{padding:"0 20px 20px",display:"flex",gap:8,flexWrap:"wrap"}}>
        {wa&&<Btn onClick={()=>window.open(`https://wa.me/${wa}`)}>واتساب</Btn>}
        {phones[0]&&<Btn secondary onClick={()=>window.location.href=`tel:${phones[0]}`}>اتصال</Btn>}
        {b.mapUrl&&<Btn secondary onClick={()=>window.open(b.mapUrl)}>الخريطة</Btn>}
        {b.website&&<Btn secondary onClick={()=>window.open(b.website)}>الموقع</Btn>}
        {b.facebook&&<Btn secondary onClick={()=>window.open(b.facebook)}>فيسبوك</Btn>}
        {b.instagram&&<Btn secondary onClick={()=>window.open(b.instagram)}>إنستجرام</Btn>}
      </div>
      {branches.length>0&&<div style={{padding:"0 20px 20px"}}><div style={{fontWeight:900,color:c.tc,marginBottom:7}}>الفروع</div>{branches.map((x,i)=><div key={i} style={{color:c.sub,fontSize:12.5,marginTop:3}}>📍 {x}</div>)}</div>}
      {b.offers&&<div style={{margin:"0 20px 20px",background:"#FFF7ED",color:"#9A3412",borderRadius:12,padding:12,fontWeight:700,fontSize:13}}>🔥 {b.offers}</div>}
    </div>
    <SectionTitle darkMode={darkMode} title="منتجات الشركة" sub={`${products.length} منتج`}/>
    {products.length?<div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},minmax(0,1fr))`,gap:11}}>
      {products.map(p=><ProductCard key={p.id} p={p} business={b} category={categories.find(c=>c.id===p.categoryId)} onOpen={onProduct} darkMode={darkMode}/>)}</div>:<div style={{textAlign:"center",padding:35,color:c.sub}}>لا توجد منتجات منشورة حاليًا</div>}
  </div>;
}

export function CatalogScreen({db,darkMode}){
  const c=cardColors(darkMode), mobile=useMobile();
  const [loading,setLoading]=useState(true),[cats,setCats]=useState([]),[businesses,setBusinesses]=useState([]),[products,setProducts]=useState([]),[attrs,setAttrs]=useState([]);
  const [selectedBusiness,setSelectedBusiness]=useState(null),[selectedProduct,setSelectedProduct]=useState(null);
  const [search,setSearch]=useState(""),[categoryId,setCategoryId]=useState(""),[businessId,setBusinessId]=useState(""),[gov,setGov]=useState("");
  const [minPrice,setMinPrice]=useState(""),[maxPrice,setMaxPrice]=useState(""),[size,setSize]=useState(""),[color,setColor]=useState(""),[dynamic,setDynamic]=useState({});
  useEffect(()=>{
    Promise.all([getActive(db,"catalogCategories"),getActive(db,"catalogBusinesses"),getActive(db,"catalogProducts"),getActive(db,"catalogAttributes")])
      .then(async([a,b,p,d])=>{
        setCats(a);setBusinesses(b);setProducts(p);setAttrs(d);
        const q=new URLSearchParams(window.location.search), bid=q.get("businessId");
        if(q.get("catalog")==="business"&&bid){
          const found=b.find(x=>x.id===bid);
          if(found) setSelectedBusiness(found);
          else try{const s=await getDoc(doc(db,"catalogBusinesses",bid));if(s.exists()&&s.data().active===true)setSelectedBusiness({id:s.id,...s.data()});}catch{}
        }
      }).finally(()=>setLoading(false));
  },[db]);
  const filtered=useMemo(()=>products.filter(p=>{
    const b=businesses.find(x=>x.id===p.businessId);
    const q=normalize(search);
    if(q && !normalize([p.name,p.code,p.description,p.specs,p.size,p.color,p.material,b?.name].join(" ")).includes(q)) return false;
    if(categoryId&&p.categoryId!==categoryId) return false;
    if(businessId&&p.businessId!==businessId) return false;
    if(gov&&b?.governorate!==gov) return false;
    if(size&&normalize(p.size)!==normalize(size)) return false;
    if(color&&normalize(p.color)!==normalize(color)) return false;
    if(minPrice&&(!p.price||Number(p.price)<Number(minPrice))) return false;
    if(maxPrice&&(!p.price||Number(p.price)>Number(maxPrice))) return false;
    for(const [k,v] of Object.entries(dynamic)) if(v && normalize(p.attributes?.[k])!==normalize(v)) return false;
    return true;
  }),[products,businesses,search,categoryId,businessId,gov,size,color,minPrice,maxPrice,dynamic]);
  const openBusiness=b=>{setSelectedProduct(null);setSelectedBusiness(b);window.history.pushState({catalog:true},"",`?catalog=business&businessId=${encodeURIComponent(b.id)}`);window.scrollTo(0,0);};
  const back=()=>{setSelectedBusiness(null);setSelectedProduct(null);window.history.replaceState({},"",window.location.pathname);window.scrollTo(0,0);};
  if(selectedProduct) return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"25px 14px 100px":"34px 28px 70px"}}><div style={{maxWidth:1150,margin:"0 auto"}}><ProductDetails p={selectedProduct} business={businesses.find(x=>x.id===selectedProduct.businessId)} category={cats.find(x=>x.id===selectedProduct.categoryId)} onBack={()=>setSelectedProduct(null)} darkMode={darkMode}/></div></div>;
  if(selectedBusiness) return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"25px 14px 100px":"34px 28px 70px"}}><div style={{maxWidth:1150,margin:"0 auto"}}><BusinessDetails b={selectedBusiness} products={products.filter(p=>p.businessId===selectedBusiness.id)} categories={cats} onBack={back} onProduct={setSelectedProduct} darkMode={darkMode}/></div></div>;
  const feature=products.filter(p=>p.featured).slice(0,8), latest=[...products].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,12);
  const govs=[...new Set(businesses.map(b=>b.governorate).filter(Boolean))];
  const sizes=[...new Set(products.map(p=>p.size).filter(Boolean))];
  const colors=[...new Set(products.map(p=>p.color).filter(Boolean))];
  return <div style={{minHeight:"100vh",background:c.bg,paddingBottom:100}}>
    <div style={{background:`linear-gradient(145deg,${NAVY_DEEP},${NAVY})`,padding:mobile?"38px 14px 25px":"55px 28px 36px",borderBottom:"1px solid rgba(201,168,76,.25)"}}>
      <div style={{maxWidth:1150,margin:"0 auto"}}>
        <div style={{color:GOLD,fontWeight:800,fontSize:12}}>الدليل الشامل</div>
        <h1 style={{fontFamily:"Cairo",fontSize:mobile?25:36,color:"white",margin:"5px 0 8px"}}>كتالوج مواد التشطيب</h1>
        <div style={{color:"rgba(255,255,255,.62)",fontSize:13,marginBottom:17}}>ابحث عن المنتج والخامة والمورد المناسب في مكان واحد</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المنتج، الكود، المقاس، اللون أو الشركة..." style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:13,border:"1px solid rgba(201,168,76,.3)",background:"rgba(255,255,255,.1)",color:"white",outline:"none",fontFamily:"Cairo",fontSize:14}}/>
      </div>
    </div>
    <div style={{maxWidth:1150,margin:"0 auto",padding:mobile?"18px 14px":"28px"}}>
      {loading?<div style={{textAlign:"center",padding:70,color:c.sub}}>جاري تحميل الكتالوج...</div>:<>
        <SectionTitle darkMode={darkMode} title="التصنيفات" sub="اختر نوع الخامة أو المنتج"/>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:Math.min(6,Math.max(cats.length,1))},minmax(0,1fr))`,gap:9,marginBottom:28}}>
          {(cats.length?cats:CATALOG_DEFAULT_CATEGORIES.map(([id,icon,name])=>({id,icon,name}))).slice(0,18).map(x=><div key={x.id} onClick={()=>cats.length&&setCategoryId(categoryId===x.id?"":x.id)} style={{background:categoryId===x.id?`linear-gradient(135deg,${GOLD},${GOLD_DARK})`:c.card,color:categoryId===x.id?NAVY_DEEP:c.tc,border:`1px solid ${categoryId===x.id?GOLD:c.border}`,borderRadius:14,padding:"13px 8px",textAlign:"center",cursor:"pointer"}}><div style={{fontSize:24}}>{x.icon||"🧱"}</div><div style={{fontSize:11.5,fontWeight:800,marginTop:5}}>{x.name}</div></div>)}
        </div>
        {feature.length>0&&<><SectionTitle darkMode={darkMode} title="المنتجات المميزة"/><div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},minmax(0,1fr))`,gap:11,marginBottom:28}}>{feature.map(p=><ProductCard key={p.id} p={p} business={businesses.find(b=>b.id===p.businessId)} category={cats.find(x=>x.id===p.categoryId)} onOpen={setSelectedProduct} darkMode={darkMode}/>)}</div></>}
        <SectionTitle darkMode={darkMode} title="المحلات والمصانع والتوكيلات" sub={`${businesses.length} جهة مسجلة`}/>
        {businesses.length>0?<div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},minmax(0,1fr))`,gap:11,marginBottom:28}}>{businesses.slice(0,12).map(b=><BusinessCard key={b.id} b={b} onOpen={openBusiness} darkMode={darkMode}/>)}</div>:<div style={{padding:20,color:c.sub,textAlign:"center",marginBottom:20}}>سيتم إضافة الموردين من لوحة الإدارة</div>}
        <SectionTitle darkMode={darkMode} title="ابحث وفلتر المنتجات" sub="يمكنك الوصول للمنتج نفسه بالمواصفات"/>
        <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:16,padding:13,display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:8,marginBottom:16}}>
          <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={filterStyle(c)}><option value="">كل التصنيفات</option>{cats.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={businessId} onChange={e=>setBusinessId(e.target.value)} style={filterStyle(c)}><option value="">كل الشركات</option>{businesses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={gov} onChange={e=>setGov(e.target.value)} style={filterStyle(c)}><option value="">كل المحافظات</option>{govs.map(x=><option key={x} value={x}>{x}</option>)}</select>
          <select value={size} onChange={e=>setSize(e.target.value)} style={filterStyle(c)}><option value="">كل المقاسات</option>{sizes.map(x=><option key={x} value={x}>{x}</option>)}</select>
          <select value={color} onChange={e=>setColor(e.target.value)} style={filterStyle(c)}><option value="">كل الألوان</option>{colors.map(x=><option key={x} value={x}>{x}</option>)}</select>
          <input type="number" value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="أقل سعر" style={filterStyle(c)}/>
          <input type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="أعلى سعر" style={filterStyle(c)}/>
          {attrs.filter(a=>a.filterable!==false&&(!a.categoryId||a.categoryId===categoryId)).map(a=><select key={a.id} value={dynamic[a.key||a.name]||""} onChange={e=>setDynamic(d=>({...d,[a.key||a.name]:e.target.value}))} style={filterStyle(c)}><option value="">{a.name}</option>{lines(a.values).map(v=><option key={v} value={v}>{v}</option>)}</select>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}><div style={{color:c.tc,fontWeight:900}}>المنتجات</div><div style={{color:c.sub,fontSize:12}}>{filtered.length} نتيجة</div></div>
        {filtered.length?<div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},minmax(0,1fr))`,gap:11}}>{filtered.map(p=><ProductCard key={p.id} p={p} business={businesses.find(b=>b.id===p.businessId)} category={cats.find(x=>x.id===p.categoryId)} onOpen={setSelectedProduct} darkMode={darkMode}/>)}</div>:<div style={{padding:45,textAlign:"center",color:c.sub}}>لا توجد منتجات مطابقة للفلاتر الحالية</div>}
        {latest.some(p=>p.discount)&&<div style={{marginTop:30}}><SectionTitle darkMode={darkMode} title="أحدث العروض"/><div style={{display:"grid",gridTemplateColumns:`repeat(${mobile?2:4},minmax(0,1fr))`,gap:11}}>{latest.filter(p=>p.discount).map(p=><ProductCard key={p.id} p={p} business={businesses.find(b=>b.id===p.businessId)} category={cats.find(x=>x.id===p.categoryId)} onOpen={setSelectedProduct} darkMode={darkMode}/>)}</div></div>}
      </>}
    </div>
  </div>;
}
const filterStyle=c=>({width:"100%",boxSizing:"border-box",padding:"10px 9px",borderRadius:10,border:`1px solid ${c.border}`,background:c.input,color:c.tc,fontFamily:"Cairo",fontSize:12,outline:"none"});

function Field({label,value,onChange,type="text",textarea=false,options=null,placeholder="",checked}){
  return <label style={{display:"block",fontSize:11.5,fontWeight:800,color:GRAY}}>
    {label}
    {options?<select value={value||""} onChange={e=>onChange(e.target.value)} style={adminInput}><option value="">اختر</option>{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}</select>
    :type==="checkbox"?<input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)} style={{marginRight:8}}/>
    :textarea?<textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} style={{...adminInput,resize:"vertical"}}/>
    :<input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={adminInput}/>} 
  </label>;
}
const adminInput={width:"100%",boxSizing:"border-box",marginTop:5,padding:"10px 11px",borderRadius:9,border:`1px solid ${BORDER}`,background:"#fff",color:NAVY,fontFamily:"Cairo",fontSize:12.5,outline:"none"};
function AdminTable({items,render,empty="لا توجد بيانات"}) { return <div>{items.length?items.map(render):<div style={{padding:35,textAlign:"center",color:GRAY}}>{empty}</div>}</div>; }

export function CatalogAdminPanel({db,storage,darkMode}){
  const c=cardColors(darkMode), mobile=useMobile();
  const [tab,setTab]=useState("businesses"),[cats,setCats]=useState([]),[businesses,setBusinesses]=useState([]),[products,setProducts]=useState([]),[attrs,setAttrs]=useState([]);
  const [business,setBusiness]=useState({...emptyBusiness}),[product,setProduct]=useState({...emptyProduct}),[attribute,setAttribute]=useState({...emptyAttribute});
  const [editingBusiness,setEditingBusiness]=useState(null),[editingProduct,setEditingProduct]=useState(null),[editingCat,setEditingCat]=useState(null),[editingAttr,setEditingAttr]=useState(null);
  const [catForm,setCatForm]=useState({name:"",icon:"🧱",active:true,sortOrder:0}),[search,setSearch]=useState(""),[busy,setBusy]=useState(false);
  const [logoFile,setLogoFile]=useState(null),[coverFile,setCoverFile]=useState(null),[mainFile,setMainFile]=useState(null),[extraFiles,setExtraFiles]=useState([]);
  const load=async()=>{const [a,b,p,d]=await Promise.all([getAll(db,"catalogCategories"),getAll(db,"catalogBusinesses"),getAll(db,"catalogProducts"),getAll(db,"catalogAttributes")]);setCats(a);setBusinesses(b);setProducts(p);setAttrs(d);};
  useEffect(()=>{load().catch(console.error)},[db]);
  const saveCategory=async()=>{ if(!catForm.name.trim())return alert("اكتب اسم التصنيف"); setBusy(true);try{const data={...catForm,name:catForm.name.trim(),updatedAt:serverTimestamp()};if(editingCat)await updateDoc(doc(db,"catalogCategories",editingCat),data); else await addDoc(collection(db,"catalogCategories"),{...data,createdAt:serverTimestamp()});setCatForm({name:"",icon:"🧱",active:true,sortOrder:0});setEditingCat(null);await load();}catch(e){alert(e.message)}finally{setBusy(false)} };
  const seedCategories=async()=>{ if(cats.length&&!window.confirm("يوجد تصنيفات بالفعل. هل تريد إضافة التصنيفات الأساسية غير الموجودة فقط؟"))return; setBusy(true);try{const names=new Set(cats.map(x=>x.name));for(let i=0;i<CATALOG_DEFAULT_CATEGORIES.length;i++){const [key,icon,name]=CATALOG_DEFAULT_CATEGORIES[i];if(names.has(name))continue;await setDoc(doc(db,"catalogCategories",key),{name,icon,active:true,sortOrder:i+1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});}await load();}catch(e){alert(e.message)}finally{setBusy(false)} };
  const saveBusiness=async()=>{ if(!business.name.trim())return alert("اكتب اسم الشركة أو المحل"); setBusy(true);try{const id=editingBusiness||doc(collection(db,"catalogBusinesses")).id;let data={...business,name:business.name.trim(),updatedAt:serverTimestamp()};if(logoFile)data.logoUrl=await uploadImage(storage,`catalog/businesses/${id}`,logoFile);if(coverFile)data.coverUrl=await uploadImage(storage,`catalog/businesses/${id}`,coverFile);await setDoc(doc(db,"catalogBusinesses",id),{...data,...(!editingBusiness?{createdAt:serverTimestamp()}:{} )},{merge:true});setBusiness({...emptyBusiness});setEditingBusiness(null);setLogoFile(null);setCoverFile(null);await load();}catch(e){alert(e.message)}finally{setBusy(false)} };
  const saveProduct=async()=>{ if(!product.name.trim()||!product.businessId||!product.categoryId)return alert("اسم المنتج والشركة والتصنيف مطلوبين"); setBusy(true);try{const id=editingProduct||doc(collection(db,"catalogProducts")).id;let data={...product,price:product.price===""?"":Number(product.price),updatedAt:serverTimestamp()};if(mainFile)data.mainImage=await uploadImage(storage,`catalog/products/${id}`,mainFile);if(extraFiles.length){const urls=[];for(const f of extraFiles)urls.push(await uploadImage(storage,`catalog/products/${id}`,f));data.images=[...(product.images||[]),...urls];}await setDoc(doc(db,"catalogProducts",id),{...data,...(!editingProduct?{createdAt:serverTimestamp()}:{} )},{merge:true});setProduct({...emptyProduct});setEditingProduct(null);setMainFile(null);setExtraFiles([]);await load();}catch(e){alert(e.message)}finally{setBusy(false)} };
  const saveAttribute=async()=>{ if(!attribute.name.trim())return alert("اكتب اسم الخاصية");const key=(attribute.key||attribute.name).trim();setBusy(true);try{const data={...attribute,key,updatedAt:serverTimestamp()};if(editingAttr)await updateDoc(doc(db,"catalogAttributes",editingAttr),data);else await addDoc(collection(db,"catalogAttributes"),{...data,createdAt:serverTimestamp()});setAttribute({...emptyAttribute});setEditingAttr(null);await load();}catch(e){alert(e.message)}finally{setBusy(false)} };
  const q=normalize(search);
  const filteredBusinesses=businesses.filter(x=>!q||normalize([x.name,x.governorate,x.activityType,x.phones].join(" ")).includes(q));
  const filteredProducts=products.filter(x=>!q||normalize([x.name,x.code,x.color,x.size,businesses.find(b=>b.id===x.businessId)?.name].join(" ")).includes(q));
  const remove=async(type,id,name)=>{if(!window.confirm(`حذف ${name||"العنصر"}؟`))return;const map={businesses:"catalogBusinesses",products:"catalogProducts",categories:"catalogCategories",attributes:"catalogAttributes"};try{await deleteDoc(doc(db,map[type],id));await load();}catch(e){alert(e.message)}};
  const editB=x=>{setBusiness({...emptyBusiness,...x});setEditingBusiness(x.id);setTab("businesses");window.scrollTo(0,0)};
  const editP=x=>{setProduct({...emptyProduct,...x,attributes:x.attributes||{}});setEditingProduct(x.id);setTab("products");window.scrollTo(0,0)};
  const tabs=[["businesses","🏢","الشركات والمحلات"],["products","🧱","المنتجات"],["categories","🗂️","التصنيفات"],["attributes","🎛️","الخصائص"]];
  return <div style={{direction:"rtl"}}>
    <div style={{background:`linear-gradient(135deg,${NAVY_DEEP},${NAVY})`,borderRadius:16,padding:16,marginBottom:13}}><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:19,color:"white"}}>🧱 إدارة كتالوج مواد التشطيب</div><div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginTop:3}}>إدارة مستقلة للمتاجر والمصانع والتوكيلات والمنتجات</div></div>
    <div style={{display:"flex",gap:7,overflowX:"auto",marginBottom:13}}>{tabs.map(([id,icon,label])=><button key={id} onClick={()=>setTab(id)} style={{border:`1px solid ${tab===id?GOLD:c.border}`,background:tab===id?GOLD:c.card,color:tab===id?NAVY_DEEP:c.tc,borderRadius:10,padding:"9px 11px",whiteSpace:"nowrap",cursor:"pointer",fontFamily:"Cairo",fontWeight:800,fontSize:11.5}}>{icon} {label}</button>)}</div>
    {(tab==="businesses"||tab==="products")&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث..." style={{...adminInput,marginBottom:12}}/>}
    {tab==="categories"&&<div><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:13,marginBottom:12}}><div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"2fr .7fr .7fr",gap:8}}><Field label="اسم التصنيف" value={catForm.name} onChange={v=>setCatForm(f=>({...f,name:v}))}/><Field label="الأيقونة" value={catForm.icon} onChange={v=>setCatForm(f=>({...f,icon:v}))}/><Field label="الترتيب" type="number" value={catForm.sortOrder} onChange={v=>setCatForm(f=>({...f,sortOrder:Number(v)}))}/></div><div style={{display:"flex",gap:8,alignItems:"center",marginTop:10,flexWrap:"wrap"}}><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={catForm.active} onChange={e=>setCatForm(f=>({...f,active:e.target.checked}))}/> مفعّل</label><Btn onClick={saveCategory} disabled={busy}>{editingCat?"حفظ التعديل":"إضافة التصنيف"}</Btn><Btn secondary onClick={seedCategories} disabled={busy}>إضافة التصنيفات الأساسية</Btn></div></div><AdminTable items={[...cats].sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))} render={x=><div key={x.id} style={rowStyle(c)}><div style={{flex:1,color:c.tc,fontWeight:800}}>{x.icon||"🧱"} {x.name} <small style={{color:x.active===false?"#EF4444":"#16A34A"}}>{x.active===false?"متوقف":"مفعّل"}</small></div><Btn secondary onClick={()=>{setCatForm({name:x.name,icon:x.icon||"🧱",active:x.active!==false,sortOrder:x.sortOrder||0});setEditingCat(x.id)}}>تعديل</Btn><button onClick={()=>remove("categories",x.id,x.name)} style={dangerBtn}>حذف</button></div>}/></div>}
    {tab==="businesses"&&<div><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:13,marginBottom:12}}><div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)",gap:8}}><Field label="اسم الشركة / المحل / المصنع" value={business.name} onChange={v=>setBusiness(b=>({...b,name:v}))}/><Field label="نوع النشاط" value={business.activityType} onChange={v=>setBusiness(b=>({...b,activityType:v}))} options={["محل","مصنع","توكيل","موزع","مورد","شركة"]}/><Field label="المحافظة" value={business.governorate} onChange={v=>setBusiness(b=>({...b,governorate:v}))}/><Field label="المنطقة" value={business.area} onChange={v=>setBusiness(b=>({...b,area:v}))}/><Field label="العنوان" value={business.address} onChange={v=>setBusiness(b=>({...b,address:v}))}/><Field label="أرقام التواصل (افصل بفاصلة)" value={business.phones} onChange={v=>setBusiness(b=>({...b,phones:v}))}/><Field label="واتساب" value={business.whatsapp} onChange={v=>setBusiness(b=>({...b,whatsapp:v}))}/><Field label="رابط الخريطة" value={business.mapUrl} onChange={v=>setBusiness(b=>({...b,mapUrl:v}))}/><Field label="الموقع الإلكتروني" value={business.website} onChange={v=>setBusiness(b=>({...b,website:v}))}/><Field label="فيسبوك" value={business.facebook} onChange={v=>setBusiness(b=>({...b,facebook:v}))}/><Field label="إنستجرام" value={business.instagram} onChange={v=>setBusiness(b=>({...b,instagram:v}))}/><Field label="الفروع (كل فرع في سطر)" value={business.branches} onChange={v=>setBusiness(b=>({...b,branches:v}))} textarea/><Field label="نبذة" value={business.description} onChange={v=>setBusiness(b=>({...b,description:v}))} textarea/><Field label="العروض الحالية" value={business.offers} onChange={v=>setBusiness(b=>({...b,offers:v}))} textarea/></div><div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:8,marginTop:8}}><label style={{fontSize:11.5,fontWeight:800,color:GRAY}}>اللوجو<input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0]||null)} style={adminInput}/></label><label style={{fontSize:11.5,fontWeight:800,color:GRAY}}>صورة الغلاف<input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files?.[0]||null)} style={adminInput}/></label></div><div style={{display:"flex",gap:12,alignItems:"center",marginTop:11,flexWrap:"wrap"}}><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={business.active} onChange={e=>setBusiness(b=>({...b,active:e.target.checked}))}/> مفعّل</label><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={business.featured} onChange={e=>setBusiness(b=>({...b,featured:e.target.checked}))}/> مميز</label><Btn onClick={saveBusiness} disabled={busy}>{editingBusiness?"حفظ الشركة":"إضافة الشركة"}</Btn>{editingBusiness&&<Btn secondary onClick={()=>{setBusiness({...emptyBusiness});setEditingBusiness(null)}}>إلغاء</Btn>}</div></div><AdminTable items={filteredBusinesses} render={x=><div key={x.id} style={rowStyle(c)}><div style={{width:45,height:45,borderRadius:9,overflow:"hidden"}}><Img src={x.logoUrl}/></div><div style={{flex:1,minWidth:0}}><div style={{color:c.tc,fontWeight:900}}>{x.name}</div><div style={{color:c.sub,fontSize:11}}>{x.activityType} • {x.governorate} • {x.active===false?"متوقف":"مفعّل"}</div></div><Btn secondary onClick={()=>editB(x)}>تعديل</Btn><Btn secondary onClick={()=>window.open(catalogUrl(x.id))}>فتح</Btn><Btn secondary onClick={()=>window.open(qrUrl(x.id))}>QR</Btn><button onClick={()=>remove("businesses",x.id,x.name)} style={dangerBtn}>حذف</button></div>}/></div>}
    {tab==="products"&&<div><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:13,marginBottom:12}}><div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)",gap:8}}><Field label="اسم المنتج" value={product.name} onChange={v=>setProduct(p=>({...p,name:v}))}/><Field label="كود المنتج" value={product.code} onChange={v=>setProduct(p=>({...p,code:v}))}/><Field label="التصنيف" value={product.categoryId} onChange={v=>setProduct(p=>({...p,categoryId:v}))} options={cats.map(x=>({value:x.id,label:x.name}))}/><Field label="الشركة / المورد" value={product.businessId} onChange={v=>setProduct(p=>({...p,businessId:v}))} options={businesses.map(x=>({value:x.id,label:x.name}))}/><Field label="المقاس" value={product.size} onChange={v=>setProduct(p=>({...p,size:v}))}/><Field label="اللون" value={product.color} onChange={v=>setProduct(p=>({...p,color:v}))}/><Field label="الخامة" value={product.material} onChange={v=>setProduct(p=>({...p,material:v}))}/><Field label="السعر" type="number" value={product.price} onChange={v=>setProduct(p=>({...p,price:v}))}/><Field label="حالة التوفر" value={product.availability} onChange={v=>setProduct(p=>({...p,availability:v}))} options={["متوفر","كمية محدودة","حسب الطلب","غير متوفر"]}/><Field label="العرض / الخصم" value={product.discount} onChange={v=>setProduct(p=>({...p,discount:v}))} placeholder="مثال: خصم 15%"/><Field label="وصف مختصر" value={product.description} onChange={v=>setProduct(p=>({...p,description:v}))} textarea/><Field label="المواصفات" value={product.specs} onChange={v=>setProduct(p=>({...p,specs:v}))} textarea/></div>{attrs.filter(a=>a.active!==false&&(!a.categoryId||a.categoryId===product.categoryId)).length>0&&<div style={{marginTop:11,paddingTop:11,borderTop:`1px solid ${c.border}`}}><div style={{fontWeight:900,color:c.tc,fontSize:12,marginBottom:7}}>خصائص إضافية</div><div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)",gap:8}}>{attrs.filter(a=>a.active!==false&&(!a.categoryId||a.categoryId===product.categoryId)).map(a=><Field key={a.id} label={a.name} value={product.attributes?.[a.key||a.name]||""} onChange={v=>setProduct(p=>({...p,attributes:{...(p.attributes||{}),[a.key||a.name]:v}}))} options={lines(a.values)}/>)}</div></div>}<div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:8,marginTop:9}}><label style={{fontSize:11.5,fontWeight:800,color:GRAY}}>الصورة الرئيسية<input type="file" accept="image/*" onChange={e=>setMainFile(e.target.files?.[0]||null)} style={adminInput}/></label><label style={{fontSize:11.5,fontWeight:800,color:GRAY}}>صور إضافية<input type="file" multiple accept="image/*" onChange={e=>setExtraFiles([...e.target.files])} style={adminInput}/></label></div><div style={{display:"flex",gap:12,alignItems:"center",marginTop:11,flexWrap:"wrap"}}><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={product.active} onChange={e=>setProduct(p=>({...p,active:e.target.checked}))}/> مفعّل</label><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={product.featured} onChange={e=>setProduct(p=>({...p,featured:e.target.checked}))}/> مميز</label><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={product.showPrice!==false} onChange={e=>setProduct(p=>({...p,showPrice:e.target.checked}))}/> إظهار السعر</label><Btn onClick={saveProduct} disabled={busy}>{editingProduct?"حفظ المنتج":"إضافة المنتج"}</Btn>{editingProduct&&<Btn secondary onClick={()=>{setProduct({...emptyProduct});setEditingProduct(null)}}>إلغاء</Btn>}</div></div><AdminTable items={filteredProducts} render={x=><div key={x.id} style={rowStyle(c)}><div style={{width:52,height:52,borderRadius:9,overflow:"hidden"}}><Img src={x.mainImage}/></div><div style={{flex:1,minWidth:0}}><div style={{color:c.tc,fontWeight:900}}>{x.name}</div><div style={{color:c.sub,fontSize:11}}>{businesses.find(b=>b.id===x.businessId)?.name||""} • {x.code||"بدون كود"} • {x.active===false?"متوقف":"مفعّل"}</div></div><Btn secondary onClick={()=>editP(x)}>تعديل</Btn><button onClick={()=>remove("products",x.id,x.name)} style={dangerBtn}>حذف</button></div>}/></div>}
    {tab==="attributes"&&<div><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:13,marginBottom:12}}><div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)",gap:8}}><Field label="اسم الخاصية" value={attribute.name} onChange={v=>setAttribute(a=>({...a,name:v}))} placeholder="مثال: التشطيب"/><Field label="المفتاح" value={attribute.key} onChange={v=>setAttribute(a=>({...a,key:v}))} placeholder="مثال: finish"/><Field label="التصنيف (اختياري)" value={attribute.categoryId} onChange={v=>setAttribute(a=>({...a,categoryId:v}))} options={[{value:"",label:"كل التصنيفات"},...cats.map(x=>({value:x.id,label:x.name}))]}/><Field label="القيم (افصل بفاصلة)" value={attribute.values} onChange={v=>setAttribute(a=>({...a,values:v}))} placeholder="مطفي, لامع, خشن"/></div><div style={{display:"flex",gap:12,alignItems:"center",marginTop:10,flexWrap:"wrap"}}><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={attribute.active} onChange={e=>setAttribute(a=>({...a,active:e.target.checked}))}/> مفعّل</label><label style={{color:c.tc,fontSize:12}}><input type="checkbox" checked={attribute.filterable} onChange={e=>setAttribute(a=>({...a,filterable:e.target.checked}))}/> يظهر في الفلاتر</label><Btn onClick={saveAttribute} disabled={busy}>{editingAttr?"حفظ":"إضافة خاصية"}</Btn></div></div><AdminTable items={attrs} render={x=><div key={x.id} style={rowStyle(c)}><div style={{flex:1}}><div style={{color:c.tc,fontWeight:900}}>{x.name}</div><div style={{color:c.sub,fontSize:11}}>{x.values} {x.categoryId?`• ${cats.find(c=>c.id===x.categoryId)?.name||""}`:"• كل التصنيفات"}</div></div><Btn secondary onClick={()=>{setAttribute({...emptyAttribute,...x});setEditingAttr(x.id)}}>تعديل</Btn><button onClick={()=>remove("attributes",x.id,x.name)} style={dangerBtn}>حذف</button></div>}/></div>}
  </div>;
}
const rowStyle=c=>({background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:10,display:"flex",alignItems:"center",gap:8,marginBottom:7,flexWrap:"wrap"});
const dangerBtn={border:"1px solid #FCA5A5",background:"#FEF2F2",color:"#DC2626",borderRadius:9,padding:"8px 10px",cursor:"pointer",fontFamily:"Cairo",fontWeight:800,fontSize:11};

export const CATALOG_COLLECTIONS = Object.freeze({categories:"catalogCategories",businesses:"catalogBusinesses",products:"catalogProducts",attributes:"catalogAttributes"});
