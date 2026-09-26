const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'HomeLanding.jsx');
let src = fs.readFileSync(file, 'utf8');

// Make the ad area match the approved reference: five equal, distinct cards in one row.
const oldAds = `        <button className="dl-ad-main" onClick={()=>openAd(currentAd)}>
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
        </button>`;

const newAds = `        <div className="dl-ad-row" aria-label="الإعلانات المميزة">
          {Array.from({length:Math.min(5,ads.length)},(_,offset)=>ads[(adIndex+offset)%ads.length]).map((ad,slot)=><button className="dl-ad-card" key={\`${'${ad.id||slot}'}-${'${slot}'}\`} onClick={()=>openAd(ad)}>
            <img src={clean(ad.imageUrl||ad.image||ad.bannerUrl)||FALLBACK_ADS[slot%FALLBACK_ADS.length].imageUrl} alt={clean(ad.title)||"إعلان"}/>
            <div className="dl-ad-card-shade"/>
            <span className="dl-ad-badge">إعلان</span>
            <div className="dl-ad-card-copy"><h3>{clean(ad.title)||"إعلان مميز"}</h3><p>{clean(ad.subtitle||ad.description)||"اعرف التفاصيل"}</p></div>
          </button>)}
        </div>`;
if (src.includes(oldAds)) src = src.replace(oldAds, newAds);

src = src.replace('إعلانات كبيرة وواضحة ومتغيرة تلقائيًا','إعلانات مختارة وواضحة من داخل الدليل');
src = src.replace('5 إعلانات واضحة ومتغيرة تلقائيًا','إعلانات مختارة وواضحة من داخل الدليل');

const oldCss = `.dl-ad-main,.dl-ad-second{position:relative;width:100%;padding:0;border:0;overflow:hidden;cursor:pointer;text-align:right;background:#102a3b}.dl-ad-main{height:390px;border-radius:20px}.dl-ad-second{height:170px;border-radius:17px;margin-top:12px}.dl-ad-main img,.dl-ad-second img{width:100%;height:100%;object-fit:cover;display:block}.dl-ad-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(4,24,40,.03),rgba(4,24,40,.16) 48%,rgba(4,24,40,.84))}.dl-ad-shade.second{background:linear-gradient(90deg,rgba(4,24,40,.02),rgba(4,24,40,.72))}.dl-ad-badge{position:absolute;top:15px;right:15px;background:var(--gold2);color:var(--navy);font-size:10px;font-weight:900;padding:6px 11px;border-radius:999px}.dl-ad-copy{position:absolute;right:28px;top:50%;transform:translateY(-50%);color:#fff;max-width:480px}.dl-ad-copy h3{margin:0 0 7px;font-size:32px;line-height:1.25}.dl-ad-copy p{margin:0 0 16px;color:rgba(255,255,255,.78);font-size:14px}.dl-ad-copy>span{display:inline-flex;align-items:center;gap:6px;background:var(--gold2);color:var(--navy);padding:10px 15px;border-radius:11px;font-weight:900}.dl-ad-copy.small h3{font-size:22px}`;
const newCss = `.dl-ad-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px 1px 4px}.dl-ad-row::-webkit-scrollbar{display:none}.dl-ad-card{position:relative;min-width:0;height:224px;padding:0;border:0;border-radius:18px;overflow:hidden;cursor:pointer;text-align:right;background:#102a3b;scroll-snap-align:start;box-shadow:0 8px 22px rgba(8,42,67,.12);transition:transform .2s ease,box-shadow .2s ease}.dl-ad-card:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(8,42,67,.16)}.dl-ad-card img{width:100%;height:100%;object-fit:cover;display:block}.dl-ad-card-shade{position:absolute;inset:0;background:linear-gradient(0deg,rgba(4,24,40,.90),rgba(4,24,40,.04) 68%)}.dl-ad-badge{position:absolute;top:11px;right:11px;background:var(--gold2);color:var(--navy);font-size:10px;font-weight:900;padding:5px 9px;border-radius:999px}.dl-ad-card-copy{position:absolute;right:14px;left:14px;bottom:12px;color:#fff}.dl-ad-card-copy h3{margin:0 0 4px;font-size:16px;line-height:1.35}.dl-ad-card-copy p{margin:0;color:rgba(255,255,255,.78);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
if (src.includes(oldCss)) src = src.replace(oldCss, newCss);

// Final launch polish: tighter header, cleaner spacing, consistent card sizing.
src = src.replace('.dl-top-shell{background:linear-gradient(135deg,#08263d,#0b3554);padding:18px 0 22px;border-bottom:1px solid rgba(214,170,67,.45)}', '.dl-top-shell{background:linear-gradient(135deg,#06243b,#0b3554);padding:14px 0 18px;border-bottom:1px solid rgba(214,170,67,.38);box-shadow:0 6px 18px rgba(6,36,59,.10)}');
src = src.replace('.dl-logo-mark{width:54px;height:54px;', '.dl-logo-mark{width:50px;height:50px;');
src = src.replace('.dl-brand strong{display:block;color:var(--gold2);font-size:28px;', '.dl-brand strong{display:block;color:var(--gold2);font-size:25px;');
src = src.replace('.dl-search{max-width:920px;margin:16px auto 0;', '.dl-search{max-width:860px;margin:13px auto 0;');
src = src.replace('.dl-main{padding:26px 0 60px}', '.dl-main{padding:20px 0 52px}');
src = src.replace('.dl-ad-section{background:#fff;border:1px solid var(--line);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(8,42,67,.09);margin-bottom:22px}', '.dl-ad-section{background:#fff;border:1px solid var(--line);border-radius:22px;padding:16px;box-shadow:0 10px 30px rgba(8,42,67,.07);margin-bottom:18px}');
src = src.replace('.dl-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}', '.dl-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0 26px}');
src = src.replace('.dl-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0 32px}', '.dl-shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0 26px}');
src = src.replace('min-height:98px;padding:16px;', 'min-height:88px;padding:14px;');
src = src.replace('.dl-featured,.dl-feed-section{margin-top:31px}', '.dl-featured,.dl-feed-section{margin-top:26px}');
src = src.replace('flex:0 0 220px;', 'flex:0 0 210px;');
src = src.replace('flex-basis:260px', 'flex-basis:248px');
src = src.replace('.dl-person-img,.dl-company-img{height:145px;', '.dl-person-img,.dl-company-img{height:136px;');
src = src.replace('.dl-company-img{height:150px}', '.dl-company-img{height:142px}');

// Homepage performance: only fetch what is rendered initially.
src = src.replace('collection(db,"members"),limit(160)', 'collection(db,"members"),limit(72)');
src = src.replace('collection(db,"posts"),limit(40)', 'collection(db,"posts"),limit(16)');
src = src.replace('collection(db,"ads"),where("status","==","active"),limit(30)', 'collection(db,"ads"),where("status","==","active"),limit(12)');

// Lazy-load non-critical member/post imagery.
src = src.replace('<img src={img} alt={m.name||"صنايعي"}/>', '<img loading="lazy" decoding="async" src={img} alt={m.name||"صنايعي"}/>');
src = src.replace('<img src={img} alt={m.name||"شركة"}/>', '<img loading="lazy" decoding="async" src={img} alt={m.name||"شركة"}/>');
src = src.replace('<img className="dl-post-img" src={img} alt=""/>', '<img loading="lazy" decoding="async" className="dl-post-img" src={img} alt=""/>');

// Responsive carousel: one large card with the next card peeking on phones; 3 on tablets.
const marker = '@media(max-width:760px){';
if (src.includes(marker) && !src.includes('.dl-ad-row{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:84%')) {
  src = src.replace(marker, `${marker}.dl-ad-row{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:84%;gap:11px}.dl-ad-card{height:205px}`);
}
const tabletMarker = '@media(max-width:1050px){';
if (src.includes(tabletMarker) && !src.includes('grid-template-columns:repeat(3,minmax(0,1fr))')) {
  src = src.replace(tabletMarker, `${tabletMarker}.dl-ad-row{grid-template-columns:repeat(3,minmax(0,1fr))}`);
}

// Fallback for the existing breakpoints in this file.
src = src.replace('@media(max-width:900px){.dl-wrap{padding:0 14px}', '@media(max-width:900px){.dl-ad-row{grid-template-columns:repeat(3,minmax(0,1fr))}.dl-wrap{padding:0 14px}');
src = src.replace('@media(max-width:560px){.dl-top-shell', '@media(max-width:560px){.dl-ad-row{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:84%;gap:10px}.dl-ad-card{height:205px}.dl-top-shell');

fs.writeFileSync(file, src);
console.log('Homepage launch-ready visual and performance patch applied');
