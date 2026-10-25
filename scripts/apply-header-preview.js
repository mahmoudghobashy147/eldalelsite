const fs=require('fs');let s=fs.readFileSync('src/App.jsx','utf8');
function patch(old,next,label){if(s.includes(next))return;const n=s.split(old).length-1;if(n!==1)throw Error(`${label}: ${n} matches`);s=s.replace(old,next);}
patch('import AdsCarousel from "./AdsCarousel";','import "./header-refinement-preview.css";\nimport AdsCarousel from "./AdsCarousel";','preview styles');
patch('<button className="btn btn-primary btn-sm" onClick={onShowAuth}>+ أضف نشاطك</button>','<button className="btn btn-primary btn-sm nav-login-primary" onClick={onShowAuth}>تسجيل الدخول</button>','top login');
patch('<button className="btn btn-primary btn-sm" onClick={()=>onNavigate("profile")}>+ أضف نشاطك</button>','<button className="btn btn-primary btn-sm nav-login-primary" onClick={()=>onNavigate("profile")}>حسابي</button>','signed in account');
patch('<header className="release-masthead">','<header className="release-masthead single-mobile-brand" style={{display:isDesktop?"none":undefined}}>','single logo');
fs.writeFileSync('src/App.jsx',s);
