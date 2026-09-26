const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'src','HomeLanding.jsx');
if(!fs.existsSync(file)) process.exit(0);
let s=fs.readFileSync(file,'utf8');
const before=s;

// Keep the same approved layout while reducing Firestore payload on first load.
s=s.replace(/limit\(60\)/g,'limit(24)');
s=s.replace(/limit\(20\)/g,'limit(8)');

// Prioritize only the center hero ad; defer the surrounding carousel images.
s=s.replace(
  'function AdVisual({ad}){const src=adImg(ad);return src?<img src={src} alt={ad.title||"إعلان"} loading="lazy"/>:<div className="ad-placeholder"><I n="building" s={54}/><b>{clean(ad.title)||"مساحة إعلانية"}</b></div>}',
  'function AdVisual({ad,priority=false}){const src=adImg(ad);return src?<img src={src} alt={ad.title||"إعلان"} loading={priority?"eager":"lazy"} fetchPriority={priority?"high":"low"} decoding="async"/>:<div className="ad-placeholder"><I n="building" s={54}/><b>{clean(ad.title)||"مساحة إعلانية"}</b></div>}'
);
s=s.replace(/<AdVisual ad=\{a\}\/>/g,'<AdVisual ad={a} priority={i===2}/>');

// Decode member images off the main thread where supported.
s=s.replace(/loading="lazy"\/>/g,'loading="lazy" decoding="async"/>');

// Let Chromium skip painting below-the-fold directory panels until needed.
if(!s.includes('contain-intrinsic-size:420px')){
  s=s.replace('.dir-panel{background:', '.dir-panel{content-visibility:auto;contain-intrinsic-size:420px;background:');
}

if(s!==before){
  fs.writeFileSync(file,s);
  console.log('Home performance optimization applied');
}else{
  console.log('Home performance optimization already applied');
}
