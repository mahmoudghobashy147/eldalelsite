const fs = require('fs');

const file = 'src/App.jsx';
let src = fs.readFileSync(file, 'utf8');

const adCardReplacement = String.raw`// ============================================================
// AD CARD — بطاقة إعلان مرتبة وواضحة بدون تداخل أو تكرار الصورة
// ============================================================
const Ad3DCard = ({ ad, variant="hero", darkMode, style }) => {
  const isHero = variant === "hero";
  const minHeight = isHero ? 260 : variant === "inline" ? 150 : 190;
  const radius = isHero ? 22 : 18;

  return (
    <div
      onClick={() => window.open(ad.link || (ad.phone ? "tel:" + ad.phone : "#"), "_self")}
      style={{
        position:"relative", borderRadius:radius, overflow:"hidden", cursor:"pointer", minHeight,
        background: darkMode ? "#07192B" : "#FFFFFF",
        border:"1px solid " + (darkMode ? "rgba(201,168,76,.22)" : "rgba(10,49,97,.10)"),
        boxShadow: darkMode ? "0 16px 42px rgba(0,0,0,.32)" : "0 16px 42px rgba(15,23,42,.12)",
        transition:"transform .22s ease, box-shadow .22s ease", ...style,
      }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=darkMode?"0 22px 52px rgba(0,0,0,.42)":"0 22px 52px rgba(15,23,42,.16)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=darkMode?"0 16px 42px rgba(0,0,0,.32)":"0 16px 42px rgba(15,23,42,.12)";}}
    >
      {ad.imageUrl ? (
        <>
          <img src={ad.imageUrl} alt={ad.title || "إعلان"} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(0,0,0,.01) 48%,rgba(0,0,0,.62) 100%)"}}/>
          <div style={{position:"absolute",top:12,right:12,background:"rgba(4,22,39,.82)",backdropFilter:"blur(7px)",color:C.gold,border:"1px solid rgba(255,193,7,.45)",borderRadius:999,padding:"5px 10px",fontSize:10,fontWeight:800}}>إعلان</div>
          <div style={{position:"absolute",right:14,left:14,bottom:13,display:"flex",justifyContent:"space-between",alignItems:"end",gap:12}}>
            <div style={{minWidth:0}}>
              {ad.title && <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isHero?17:13.5,color:"white",textShadow:"0 2px 10px rgba(0,0,0,.6)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ad.title}</div>}
              {isHero && ad.desc && <div style={{fontSize:11.5,color:"rgba(255,255,255,.84)",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ad.desc}</div>}
            </div>
            <div style={{width:34,height:34,borderRadius:"50%",display:"grid",placeItems:"center",background:C.gold,color:C.navyDeep,fontWeight:900,flexShrink:0,boxShadow:"0 6px 18px rgba(255,193,7,.3)"}}>←</div>
          </div>
        </>
      ) : (
        <div style={{minHeight,background:"linear-gradient(135deg," + (ad.color1||C.navyDeep) + "," + (ad.color2||C.navy) + ")",padding:isHero?"24px 22px":"18px 16px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:isHero?38:30,marginBottom:10}}>{ad.emoji||"🏢"}</div>
            <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isHero?19:14,color:"white",marginBottom:5}}>{ad.title||"إعلان"}</div>
            <div style={{fontSize:isHero?12.5:11,color:"rgba(255,255,255,.72)",lineHeight:1.7}}>{ad.desc||""}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,color:C.gold,fontSize:11,fontWeight:800}}>اعرف المزيد <span>←</span></div>
        </div>
      )}
    </div>
  );
};
`;

const adCardPattern = /\/\/ ============================================================\n\/\/ AD 3D CARD[\s\S]*?\nconst PromoBanner/;
if (!adCardPattern.test(src)) throw new Error('Ad card block not found');
src = src.replace(adCardPattern, adCardReplacement + '\n\nconst PromoBanner');

const partnerReplacement = String.raw`const PartnerCard = ({ member, onClick, dark }) => {
  const ref = useRef(null);
  const visible = useIntersection(ref);
  const plan = getMemberPlan(member);
  const planInfo = PLANS[plan] || PLANS.company;
  const planC = planInfo.color;
  const isElite = plan === "elite";
  const cover = member.coverUrl || member.workPhotos?.[0] || member.avatarUrl || "";

  return (
    <div ref={ref} onClick={()=>onClick(member)} style={{
      background:dark?C.cardBg:"white",borderRadius:20,overflow:"hidden",cursor:"pointer",
      border:"1px solid " + (dark?"rgba(201,168,76,.16)":"#E7ECF2"),
      boxShadow:dark?"0 14px 34px rgba(0,0,0,.24)":"0 14px 34px rgba(15,23,42,.09)",
      opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(12px)",transition:"all .3s ease"
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow=dark?"0 20px 42px rgba(0,0,0,.34)":"0 20px 42px rgba(15,23,42,.14)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=dark?"0 14px 34px rgba(0,0,0,.24)":"0 14px 34px rgba(15,23,42,.09)";}}
    >
      <div style={{height:138,position:"relative",background:"linear-gradient(135deg," + C.navyDeep + "," + C.navy + ")"}}>
        {cover ? <img src={cover} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/> : <div style={{width:"100%",height:"100%",display:"grid",placeItems:"center",color:C.gold}}><TradeIcon id="company" size={48} strokeWidth={1.4}/></div>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(0,0,0,.01),rgba(0,0,0,.48))"}}/>
        <div style={{position:"absolute",top:10,right:10,background:isElite?"#8B5CF6":C.gold,color:isElite?"white":C.navyDeep,borderRadius:999,padding:"5px 10px",fontSize:10,fontWeight:900}}>{isElite?"👑 شريك نخبة":"🏢 شركة مميزة"}</div>
      </div>
      <div style={{padding:"14px 15px 15px"}}>
        <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:15,color:dark?"white":C.navy,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.name}{member.verified&&" ✅"}</div>
        <div style={{fontSize:11.5,color:C.gray,marginBottom:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.specialty||"خدمات وتشطيبات"}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <span style={{fontSize:10.5,color:C.gray}}>📍 {member.gov||"مصر"}</span>
          <span style={{fontSize:10.5,fontWeight:800,color:planC}}>عرض التفاصيل ←</span>
        </div>
      </div>
    </div>
  );
};`;

const partnerPattern = /const PartnerCard = \(\{ member, onClick, dark \}\) => \{[\s\S]*?\n\};\n\n\/\/ ============================================================\n\/\/ HOME SCREEN/;
if (!partnerPattern.test(src)) throw new Error('PartnerCard block not found');
src = src.replace(partnerPattern, partnerReplacement + '\n\n// ============================================================\n// HOME SCREEN');

const desktopHeroReplacement = String.raw`      {/* 🖥️ DESKTOP HERO — واجهة ثابتة فخمة منفصلة عن الإعلانات */}
      {isDesktop && (
        <div style={{background:"radial-gradient(circle at 20% 20%,rgba(255,193,7,.10),transparent 28%),linear-gradient(135deg," + C.navyDeep + ",#082A45 58%,#0A3655)",borderBottom:"1px solid rgba(255,193,7,.14)"}}>
          <div className="desktop-container" style={{padding:"46px 28px 34px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1.15fr .85fr",gap:34,alignItems:"center"}}>
              <div>
                <div style={{color:C.gold,fontSize:12,fontWeight:800,marginBottom:8}}>الدليل الشامل للصنايعية والتشطيبات والمقاولات</div>
                <h1 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:42,lineHeight:1.25,color:"white",marginBottom:10}}>كل اللي محتاجه في التشطيبات<br/><span style={{color:C.gold}}>في مكان واحد</span></h1>
                <p style={{color:"rgba(255,255,255,.68)",fontSize:14,lineHeight:1.9,maxWidth:620,marginBottom:19}}>دور على شركة، مورد أو صنايعي واعرض أعمالك ومنشوراتك بسهولة من نفس المنصة.</p>
                <div className="search-bar" style={{maxWidth:650,marginBottom:18,boxShadow:"0 16px 38px rgba(0,0,0,.20)"}} onClick={()=>onNavigate("search")}>
                  <button>🔍</button><input placeholder="بتدور على إيه؟" readOnly style={{cursor:"pointer"}}/>
                </div>
                <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>{realStats.map(([n,l])=><div key={l}><div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:18,color:C.gold}}>{n}</div><div style={{fontSize:10.5,color:"rgba(255,255,255,.55)"}}>{l}</div></div>)}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  ["شركات","مكاتب وشركات المقاولات والتشطيبات","company","company"],
                  ["موردين","محلات ومصانع مواد البناء","supplier","supplier"],
                  ["صنايعية","كل التخصصات في مكان واحد","craftsman","members"],
                  ["منشورات","أحدث الأعمال والعروض","posts","posts"],
                ].map(([label,desc,category,icon])=>(
                  <div key={label} onClick={()=>category==="posts"?document.getElementById("home-posts")?.scrollIntoView({behavior:"smooth"}):onNavigate("search",{category})} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,193,7,.20)",borderRadius:18,padding:"18px 16px",cursor:"pointer",transition:"all .2s",backdropFilter:"blur(8px)"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,193,7,.14)";e.currentTarget.style.transform="translateY(-3px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.08)";e.currentTarget.style.transform="translateY(0)";}}>
                    <div style={{color:C.gold,marginBottom:10}}><TradeIcon id={icon} size={27} strokeWidth={1.6}/></div>
                    <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:15,color:"white",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:10.5,color:"rgba(255,255,255,.58)",lineHeight:1.6}}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* الإعلانات — صف مرتب وواضح، بدون تداخل أو دوران 3D */}
      {isDesktop && homeAds.length > 0 && (
        <div className="desktop-container" style={{paddingTop:26}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",marginBottom:13}}>
            <div><div className="section-title" style={{color:tc,fontSize:20}}>إعلانات مميزة</div><div className="gold-line"/></div>
            <div style={{fontSize:11,color:sub}}>اضغط على الإعلان للتفاصيل</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:homeAds.length>=5?"1fr 1fr 1.45fr 1fr 1fr":"repeat(" + Math.min(homeAds.length,4) + ",1fr)",gap:12,alignItems:"stretch"}}>
            {homeAds.slice(0,5).map((ad,i)=><Ad3DCard key={ad.id} ad={ad} variant={homeAds.length>=5&&i===2?"hero":"small"} darkMode={darkMode} style={{minHeight:homeAds.length>=5&&i===2?250:220}}/>)}
          </div>
        </div>
      )}

`;

const desktopHeroPattern = /      \{\/\* ═+[\s\S]*?(?=      \{\/\* أقسام الدليل)/;
if (!desktopHeroPattern.test(src)) throw new Error('Desktop hero block not found');
src = src.replace(desktopHeroPattern, desktopHeroReplacement);

src = src.replace('      {/* Posts Feed */}\n      <div className={isDesktop?"desktop-container":"section"}', '      {/* Posts Feed */}\n      <div id="home-posts" className={isDesktop?"desktop-container":"section"}');

fs.writeFileSync(file, src, 'utf8');
console.log('✅ Homepage polished; posts and core sections preserved');
