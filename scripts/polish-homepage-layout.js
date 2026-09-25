const fs = require('fs');

const file = 'src/App.jsx';
let src = fs.readFileSync(file, 'utf8');

// 1) إعلان مرتب وواضح: صورة واحدة بدون تكرار/Blur/3D.
const adCardReplacement = String.raw`// ============================================================
// AD CARD — صورة واحدة مرتبة وواضحة
// ============================================================
const Ad3DCard = ({ ad, variant="hero", darkMode, style }) => {
  const isHero = variant === "hero";
  const minHeight = isHero ? 300 : 238;
  return (
    <div
      onClick={() => window.open(ad.link || (ad.phone ? "tel:" + ad.phone : "#"), "_self")}
      style={{
        position:"relative", minHeight, borderRadius:isHero?22:18, overflow:"hidden", cursor:"pointer",
        background:"linear-gradient(135deg," + (ad.color1||C.navyDeep) + "," + (ad.color2||C.navy) + ")",
        border:"1px solid rgba(255,193,7,.34)", boxShadow:"0 14px 34px rgba(0,0,0,.20)",
        transition:"transform .2s ease, box-shadow .2s ease", ...style,
      }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 20px 42px rgba(0,0,0,.28)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 14px 34px rgba(0,0,0,.20)";}}
    >
      {ad.imageUrl ? <img src={ad.imageUrl} alt={ad.title||"إعلان"} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block"}}/> :
        <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",fontSize:isHero?54:42}}>{ad.emoji||"🏢"}</div>}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(0,0,0,.02) 42%,rgba(0,0,0,.78) 100%)"}}/>
      <div style={{position:"absolute",top:12,right:12,background:"rgba(3,20,35,.82)",color:C.gold,border:"1px solid rgba(255,193,7,.45)",borderRadius:999,padding:"5px 10px",fontSize:10,fontWeight:800}}>إعلان</div>
      <div style={{position:"absolute",right:14,left:14,bottom:14,display:"flex",alignItems:"end",justifyContent:"space-between",gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isHero?20:14,color:"white",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textShadow:"0 2px 8px rgba(0,0,0,.55)"}}>{ad.title||"إعلان مميز"}</div>
          {isHero && <div style={{fontSize:11.5,color:"rgba(255,255,255,.82)",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ad.desc||"اعرف المزيد"}</div>}
        </div>
        <div style={{width:34,height:34,borderRadius:"50%",background:C.gold,color:C.navyDeep,display:"grid",placeItems:"center",fontWeight:900,flexShrink:0}}>←</div>
      </div>
    </div>
  );
};
`;
const adPattern = /\/\/ ============================================================\n\/\/ AD 3D CARD[\s\S]*?\nconst PromoBanner/;
if (adPattern.test(src)) src = src.replace(adPattern, adCardReplacement + '\n\nconst PromoBanner');

// 2) نفس ترتيب الصورة المرجعية على الديسكتوب: هيدر/بحث، 5 إعلانات، 4 خانات، أحدث صنايعية، شركات مميزة.
const startMarker = '      {/* ═══════════════════════════════════════════════ */}\n      {/* 🖥️ DESKTOP HERO';
const endMarker = '      {/* Mobile Hero */}';
const start = src.indexOf(startMarker);
const end = start >= 0 ? src.indexOf(endMarker, start) : -1;
if (start < 0 || end < 0) throw new Error('Desktop home block markers not found');

const desktopReference = String.raw`      {/* 🖥️ DESKTOP HOME — مطابق للصورة المرجعية */}
      {isDesktop && (
        <>
          <div style={{position:"relative",backgroundImage:"linear-gradient(rgba(0,31,63,.78),rgba(0,31,63,.92)),url(/images/hero-team.png)",backgroundSize:"cover",backgroundPosition:"center",borderBottom:"1px solid rgba(255,193,7,.18)"}}>
            <div className="desktop-container" style={{padding:"22px 28px 34px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:18}}>
                <img src={LOGO_URL} alt="الدليل الشامل" style={{width:58,height:58,objectFit:"contain"}}/>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:36,color:C.gold,lineHeight:1.15}}>الدليل الشامل</div>
                  <div style={{color:"white",fontSize:14,fontWeight:700,marginTop:4}}>للصنايعية والتشطيبات والمقاولات</div>
                </div>
              </div>
              <div className="search-bar" style={{maxWidth:860,margin:"0 auto",height:58,borderRadius:30,boxShadow:"0 12px 32px rgba(0,0,0,.22)"}} onClick={()=>onNavigate("search")}>
                <button style={{fontSize:22}}>⌕</button>
                <input placeholder="بتدور على إيه؟" readOnly style={{cursor:"pointer",fontSize:16}}/>
              </div>
            </div>
          </div>

          {homeAds.length > 0 && (
            <div className="desktop-container" style={{padding:"26px 28px 0"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1.05fr 1.75fr 1.05fr 1fr",gap:10,alignItems:"center"}}>
                {Array.from({length:5}).map((_,i)=>{
                  const ad = homeAds[(heroAdIdx+i)%homeAds.length];
                  const center = i===2;
                  return <Ad3DCard key={(ad?.id||i)+"-ref"} ad={ad||MOCK_ADS[i%MOCK_ADS.length]} variant={center?"hero":"small"} darkMode={darkMode} style={{minHeight:center?330:270,transform:center?"scale(1)":"scale(.96)"}}/>;
                })}
              </div>
              <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:11}}>
                {homeAds.slice(0,5).map((ad,i)=><div key={ad.id} onClick={()=>setHeroAdIdx(i)} style={{width:i===heroAdIdx?18:7,height:7,borderRadius:5,background:i===heroAdIdx?C.gold:"rgba(255,255,255,.32)",border:"1px solid rgba(10,49,97,.18)",cursor:"pointer"}}/>)}
              </div>
            </div>
          )}

          <div className="desktop-container" style={{padding:"22px 28px 0"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[
                ["شركات","مكاتب وشركات مقاولات وتشطيبات","company","company"],
                ["موردين","محلات ومصانع مواد البناء والتشطيب","supplier","supplier"],
                ["صنايعية","ابحث عن صنايعي في جميع التخصصات","craftsman","members"],
                ["منشورات","أحدث الأعمال والإعلانات والمناقشات","posts","posts"],
              ].map(([label,desc,category,icon])=>{
                const sample = category==="posts" ? null : members.find(m => m.status==="approved" && ((m.category||m.professionType||m.role||m.type)===category || (category==="craftsman" && !["company","supplier","developer"].includes(m.category||m.professionType||m.role||m.type))));
                const image = sample?.coverUrl || sample?.workPhotos?.[0] || sample?.avatarUrl || "";
                return <div key={label} onClick={()=>category==="posts"?document.getElementById("home-posts")?.scrollIntoView({behavior:"smooth"}):onNavigate("search",{category})} style={{background:darkMode?C.cardBg:"#FFF9EF",borderRadius:18,overflow:"hidden",cursor:"pointer",border:"1px solid rgba(201,168,76,.34)",boxShadow:"0 10px 24px rgba(0,0,0,.08)",transition:"all .2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 16px 30px rgba(0,0,0,.14)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 10px 24px rgba(0,0,0,.08)";}}>
                  <div style={{height:154,position:"relative",background:"linear-gradient(135deg,#DCE6EF,#F7E7C2)"}}>
                    {image ? <img src={image} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/> : <div style={{width:"100%",height:"100%",display:"grid",placeItems:"center",color:C.navy}}><TradeIcon id={icon} size={58} strokeWidth={1.5}/></div>}
                  </div>
                  <div style={{padding:"13px 15px 15px",display:"flex",alignItems:"end",justifyContent:"space-between",gap:10}}>
                    <div><div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:20,color:tc,marginBottom:4}}>{label}</div><div style={{fontSize:11.5,color:sub,lineHeight:1.65}}>{desc}</div></div>
                    <div style={{width:34,height:34,borderRadius:"50%",background:"#8A6500",color:"white",display:"grid",placeItems:"center",fontWeight:900,flexShrink:0}}>←</div>
                  </div>
                </div>;
              })}
            </div>
          </div>

          <div className="desktop-container" style={{padding:"22px 28px 0"}}>
            <div style={{background:darkMode?C.cardBg:"white",borderRadius:22,padding:"18px 18px 20px",border:"1px solid rgba(10,49,97,.10)",boxShadow:"0 12px 28px rgba(0,0,0,.06)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div><div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:22,color:tc}}>أحدث الصنايعية</div><div style={{fontSize:11,color:sub,marginTop:3}}>أحدث المنضمين للدليل الشامل</div></div>
                <button className="btn btn-outline btn-sm" onClick={()=>onNavigate("search",{category:"craftsman"})}>عرض الكل ←</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
                {members.filter(m=>m.status==="approved" && !["company","supplier","developer"].includes(m.category||m.professionType||m.role||m.type)).slice(0,6).map(m=>{
                  const img=m.coverUrl||m.workPhotos?.[0]||m.avatarUrl||"";
                  return <div key={m.id} onClick={()=>onMemberClick(m)} style={{borderRadius:14,overflow:"hidden",cursor:"pointer",background:darkMode?"#0B2947":"#F8FAFC",border:"1px solid #E4EAF0"}}>
                    <div style={{height:118,background:"#E7EEF4"}}>{img?<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{height:"100%",display:"grid",placeItems:"center",color:C.navy}}><TradeIcon id="members" size={34}/></div>}</div>
                    <div style={{padding:"9px 10px"}}><div style={{fontWeight:900,fontSize:12,color:tc,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.name}</div><div style={{fontSize:10.5,color:sub,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.specialty||"صنايعي"}</div></div>
                  </div>;
                })}
              </div>
            </div>
          </div>

          <div className="desktop-container" style={{padding:"22px 28px 0"}}>
            <div style={{background:darkMode?C.cardBg:"white",borderRadius:22,padding:"18px 18px 20px",border:"1px solid rgba(10,49,97,.10)",boxShadow:"0 12px 28px rgba(0,0,0,.06)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div><div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:22,color:tc}}>شركات مميزة</div><div style={{fontSize:11,color:sub,marginTop:3}}>شركات ومكاتب موثوقة داخل الدليل</div></div>
                <button className="btn btn-outline btn-sm" onClick={()=>onNavigate("search",{category:"company"})}>عرض الكل ←</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
                {members.filter(m=>m.status==="approved" && ((m.category||m.professionType||m.role||m.type)==="company" || ["company","elite"].includes(getMemberPlan(m)))).slice(0,5).map(m=><PartnerCard key={m.id} member={m} onClick={onMemberClick} dark={darkMode}/>)}
              </div>
            </div>
          </div>
        </>
      )}

`;

src = src.slice(0,start) + desktopReference + src.slice(end);

// posts تفضل موجودة كما هي ونوصل لها من كارت منشورات.
if (!src.includes('id="home-posts"')) {
  src = src.replace('      {/* Posts Feed */}\n      <div className={isDesktop?"desktop-container":"section"}', '      {/* Posts Feed */}\n      <div id="home-posts" className={isDesktop?"desktop-container":"section"}');
}

// اخفاء البانر الترويجي الإضافي على الديسكتوب حتى يفضل الشكل مطابق للصورة المرجعية.
src = src.replaceAll('{promoSlot === 0 && <PromoBanner cfg={cfg} />}', '{!isDesktop && promoSlot === 0 && <PromoBanner cfg={cfg} />}');
src = src.replaceAll('{promoSlot === 1 && <PromoBanner cfg={cfg} />}', '{!isDesktop && promoSlot === 1 && <PromoBanner cfg={cfg} />}');

fs.writeFileSync(file, src);
console.log('Applied reference-style homepage layout');
