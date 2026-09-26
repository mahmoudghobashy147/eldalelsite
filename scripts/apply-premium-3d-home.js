const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'HomeLanding.jsx');
if (!fs.existsSync(file)) process.exit(0);
let s = fs.readFileSync(file, 'utf8');

// 3D avatar placeholder for members without photos.
s = s.replace(
  /<span><Icon name="craftsman" size=\{39\}\/\><\/span>/g,
  '<span className="dl-avatar-3d" aria-label="صورة افتراضية"><i/><b/></span>'
);
s = s.replace(
  /<span><Icon name=\{supplier\?"supplier":"company"\} size=\{42\}\/\><\/span>/g,
  '<span className="dl-avatar-3d" aria-label="صورة افتراضية"><i/><b/></span>'
);

// Make the premium section titles match the dark 3D cards.
s = s.replace(
  '<section className="dl-featured">',
  '<section className="dl-featured dl-premium-panel">'
);
s = s.replace(
  '<section id="feed" className="dl-feed-section">',
  '<section id="feed" className="dl-feed-section dl-premium-panel">'
);

const premiumCss = `
/* ===== Premium 3D launch skin ===== */
.dl-page{
  position:relative;
  isolation:isolate;
  overflow-x:hidden;
  background:
    radial-gradient(circle at 12% 8%,rgba(242,210,127,.20),transparent 22%),
    radial-gradient(circle at 88% 16%,rgba(18,63,97,.90),transparent 30%),
    radial-gradient(circle at 18% 72%,rgba(215,170,67,.14),transparent 24%),
    linear-gradient(155deg,#041827 0%,#082a43 42%,#0b3554 72%,#031522 100%) !important;
  color:#fff;
}
.dl-page:before,.dl-page:after{content:"";position:fixed;pointer-events:none;z-index:-2;filter:blur(.1px)}
.dl-page:before{inset:-8vh -12vw auto auto;width:72vw;height:52vh;background:linear-gradient(135deg,transparent 20%,rgba(215,170,67,.13) 21%,rgba(215,170,67,.03) 43%,transparent 44%),linear-gradient(38deg,rgba(255,255,255,.035),transparent 55%);transform:skewY(-8deg);border-radius:40px}
.dl-page:after{left:-18vw;bottom:5vh;width:70vw;height:48vh;background:linear-gradient(145deg,rgba(215,170,67,.12),transparent 35%),linear-gradient(20deg,rgba(18,63,97,.9),rgba(3,21,34,.08));transform:rotate(-10deg);border-radius:48px;box-shadow:0 0 100px rgba(215,170,67,.08)}
.dl-main{position:relative;z-index:1}
.dl-main:before{content:"";position:absolute;inset:0;pointer-events:none;z-index:-1;background:repeating-linear-gradient(128deg,transparent 0 120px,rgba(255,255,255,.018) 121px 122px),repeating-linear-gradient(32deg,transparent 0 170px,rgba(215,170,67,.018) 171px 172px)}

.dl-top-shell{background:linear-gradient(145deg,rgba(3,20,34,.98),rgba(8,42,67,.97) 58%,rgba(11,53,84,.96));border-bottom:1px solid rgba(242,210,127,.62);box-shadow:0 18px 45px rgba(0,0,0,.28),inset 0 -1px 0 rgba(255,255,255,.04)}
.dl-logo-mark,.dl-icon,.dl-login{box-shadow:inset 0 0 0 1px rgba(255,255,255,.035),0 8px 20px rgba(0,0,0,.24)}
.dl-search{border:1px solid rgba(242,210,127,.86);box-shadow:0 14px 32px rgba(0,0,0,.28),inset 0 1px 0 #fff;background:linear-gradient(180deg,#fff,#f6f0e5)}
.dl-search button{box-shadow:0 8px 16px rgba(215,170,67,.28),inset 0 1px 0 rgba(255,255,255,.5)}

.dl-ad-section{background:linear-gradient(145deg,rgba(4,27,44,.97),rgba(8,43,68,.97));border:1px solid rgba(242,210,127,.58);box-shadow:0 22px 50px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.035);padding:15px;border-radius:22px}
.dl-section-head h2,.dl-section-title h2{color:#fff !important;text-shadow:0 3px 12px rgba(0,0,0,.35)}
.dl-section-head p,.dl-section-title p{color:rgba(255,255,255,.62)}
.dl-kicker{color:#f5d987;background:rgba(215,170,67,.10);border-color:rgba(242,210,127,.35)}
.dl-ad-controls button{border-color:rgba(242,210,127,.85);box-shadow:0 6px 16px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.04)}
.dl-ad-main{height:300px !important;border-radius:18px !important;border:1px solid rgba(242,210,127,.72) !important;box-shadow:0 18px 38px rgba(0,0,0,.30),inset 0 0 0 1px rgba(255,255,255,.05)}
.dl-ad-pair{gap:10px !important;margin-top:10px !important}
.dl-ad-mini{height:142px !important;border-radius:15px !important;border:1px solid rgba(242,210,127,.62) !important;box-shadow:0 12px 26px rgba(0,0,0,.24)}
.dl-ad-main img,.dl-ad-mini img{filter:saturate(1.04) contrast(1.02)}
.dl-ad-copy h3{color:#f6d477 !important;text-shadow:0 3px 15px rgba(0,0,0,.6)}
.dl-ad-copy.small h3{color:#fff !important}
.dl-ad-copy>span{box-shadow:0 8px 16px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.55)}

.dl-shortcuts{margin-top:4px;margin-bottom:26px;gap:11px}
.dl-shortcut{position:relative;overflow:hidden;min-height:128px;background:linear-gradient(155deg,#fffaf0,#efe2c7 72%,#d9bd82);border:1px solid rgba(242,210,127,.9);box-shadow:0 16px 28px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.85);color:#0a2b43}
.dl-shortcut:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 75% 5%,rgba(255,255,255,.75),transparent 34%),linear-gradient(145deg,transparent 58%,rgba(215,170,67,.13));pointer-events:none}
.dl-shortcut:first-child{background:linear-gradient(155deg,#0b3554,#06243b);color:#fff;border-color:rgba(242,210,127,.65)}
.dl-shortcut:first-child small{color:rgba(255,255,255,.65)}
.dl-shortcut>span{width:52px;height:52px;background:linear-gradient(145deg,#f6d477,#b8862f);color:#06243b;box-shadow:0 8px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.55)}
.dl-shortcut i{background:linear-gradient(145deg,#e0b54f,#a97a22);box-shadow:0 6px 13px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.55)}

.dl-premium-panel{background:linear-gradient(145deg,rgba(5,31,50,.96),rgba(8,46,72,.95));border:1px solid rgba(242,210,127,.46);border-radius:22px;padding:18px;margin-top:24px;box-shadow:0 22px 48px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.035)}
.dl-section-title>button{background:linear-gradient(145deg,#0b3554,#061f33);border:1px solid rgba(242,210,127,.65);box-shadow:0 8px 17px rgba(0,0,0,.22)}
.dl-person-card,.dl-company-card{border-color:rgba(242,210,127,.56);box-shadow:0 16px 28px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.75);background:linear-gradient(180deg,#fffdf7,#f0e4cb)}
.dl-person-img,.dl-company-img{background:linear-gradient(145deg,#143f60,#061f33);position:relative;overflow:hidden}
.dl-person-img:after,.dl-company-img:after{content:"";position:absolute;inset:auto -18% -48% -18%;height:70%;background:radial-gradient(ellipse,rgba(215,170,67,.18),transparent 64%);pointer-events:none}
.dl-name-row b,.dl-person-info small,.dl-company-info small,.dl-person-info>span,.dl-company-info>span{color:#18344a}
.dl-card-cta{background:linear-gradient(145deg,#0b3554,#06243b);border:1px solid rgba(215,170,67,.44)}

.dl-avatar-3d{position:relative;width:84px;height:84px;border-radius:50%;display:block;background:radial-gradient(circle at 34% 28%,#fff5dc 0 9%,#efc982 10% 28%,#b67d31 29% 45%,#133b59 46% 74%,#071c2c 75%);box-shadow:0 14px 26px rgba(0,0,0,.38),inset 0 2px 2px rgba(255,255,255,.48),0 0 0 3px rgba(242,210,127,.75);z-index:1}
.dl-avatar-3d:before{content:"";position:absolute;left:50%;top:18%;width:28px;height:31px;transform:translateX(-50%);border-radius:50% 50% 45% 45%;background:linear-gradient(145deg,#f0c982,#c1893e);box-shadow:inset -5px -4px 8px rgba(99,55,14,.22)}
.dl-avatar-3d:after{content:"";position:absolute;left:50%;bottom:12%;width:52px;height:34px;transform:translateX(-50%);border-radius:50% 50% 18px 18px;background:linear-gradient(145deg,#174766,#082a43);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.dl-avatar-3d i,.dl-avatar-3d b{position:absolute;display:block;z-index:3}.dl-avatar-3d i{left:50%;top:15%;width:36px;height:10px;transform:translateX(-50%);border-radius:12px 12px 4px 4px;background:linear-gradient(145deg,#f2d27f,#b8862f);box-shadow:0 3px 5px rgba(0,0,0,.24)}.dl-avatar-3d b{left:50%;top:37%;width:20px;height:4px;transform:translateX(-50%);border-radius:999px;background:rgba(66,34,12,.7)}

.dl-post{border-color:rgba(242,210,127,.35);box-shadow:0 15px 30px rgba(0,0,0,.22)}
.dl-sidebox{border-color:rgba(242,210,127,.68);box-shadow:0 18px 36px rgba(0,0,0,.28)}

@media(max-width:900px){
  .dl-ad-main{height:260px !important}
  .dl-ad-mini{height:128px !important}
  .dl-premium-panel{padding:14px}
}
@media(max-width:560px){
  .dl-wrap{padding:0 10px}
  .dl-main{padding-top:12px}
  .dl-ad-section{padding:9px;border-radius:16px}
  .dl-ad-main{height:210px !important;border-radius:14px !important}
  .dl-ad-pair{gap:7px !important;margin-top:7px !important}
  .dl-ad-mini{height:98px !important;border-radius:12px !important}
  .dl-ad-copy{right:14px;left:14px}
  .dl-ad-copy h3{font-size:19px}
  .dl-ad-copy.small h3{font-size:13px;line-height:1.35}
  .dl-ad-copy.small>span{display:none}
  .dl-shortcuts{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  .dl-shortcut{min-height:116px;padding:9px 5px;display:flex;flex-direction:column;justify-content:center;text-align:center;gap:7px;border-radius:14px}
  .dl-shortcut>span{width:42px;height:42px}
  .dl-shortcut b{font-size:13px;line-height:1.25}.dl-shortcut small{font-size:8px;line-height:1.35}.dl-shortcut i{display:grid;width:28px;height:28px}
  .dl-premium-panel{border-radius:16px;padding:11px;margin-top:18px}
  .dl-person-card{flex-basis:176px}.dl-company-card{flex-basis:202px}
  .dl-avatar-3d{width:72px;height:72px}
}
`;

if (!s.includes('Premium 3D launch skin')) {
  s = s.replace(/\n`;\s*$/m, `\n${premiumCss}\n`;`);
}

fs.writeFileSync(file, s);
console.log('Premium 3D homepage skin applied.');
