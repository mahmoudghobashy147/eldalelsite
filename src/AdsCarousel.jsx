import {useEffect,useRef,useState} from 'react';
import './ad-review-refinement.css';
import {ImageViewer} from './MediaFeatures';

const INTERVAL=4500;
export default function AdsCarousel({ads:allAds=[]}) {
 const ads=allAds.filter(ad=>ad.id!=='advertise-with-us' && ad.imageUrl && (!ad.status || ad.status==='active') && (!ad.endDate || new Date(String(ad.endDate).slice(0,10)+'T23:59:59').getTime()>=Date.now()));
 const track=useRef(null),frame=useRef(0),settle=useRef(0),selected=useRef(0);
 const [active,setActive]=useState(0),[paused,setPaused]=useState(false),[viewImage,setViewImage]=useState(null);
 const [visible,setVisible]=useState(!document.hidden),[interacting,setInteracting]=useState(false),[reduceMotion,setReduceMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const looping=ads.length>1;
 const slides=looping?[ads[ads.length-1],...ads,ads[0]]:ads;
 const positionFor=(el,index)=>{const slide=el?.children[index];return slide?slide.offsetLeft+slide.offsetWidth/2-el.clientWidth/2:0;};
 const go=(index,behavior='smooth')=>{const el=track.current;if(!el||!ads.length)return;const target=looping?Math.max(-1,Math.min(index,ads.length))+1:0;el.scrollTo({left:positionFor(el,target),behavior:reduceMotion?'auto':behavior});};
 useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduceMotion(m.matches),vis=()=>setVisible(!document.hidden);m.addEventListener?.('change',change);document.addEventListener('visibilitychange',vis);return()=>{m.removeEventListener?.('change',change);document.removeEventListener('visibilitychange',vis);};},[]);
 useEffect(()=>{selected.current=0;setActive(0);const el=track.current;if(el)el.scrollTo({left:positionFor(el,looping?1:0),behavior:'auto'});},[ads.length,looping]);
 useEffect(()=>{const el=track.current;if(!el||typeof ResizeObserver==='undefined')return;const ro=new ResizeObserver(()=>el.scrollTo({left:positionFor(el,looping?selected.current+1:0),behavior:'auto'}));ro.observe(el);return()=>ro.disconnect();},[looping]);
 useEffect(()=>()=>{cancelAnimationFrame(frame.current);clearTimeout(settle.current);},[]);
 const running=looping&&!paused&&!viewImage&&visible&&!reduceMotion&&!interacting;
 useEffect(()=>{if(!running)return;const timer=setTimeout(()=>go(selected.current+1),INTERVAL);return()=>clearTimeout(timer);},[active,running,ads.length]);
 const onScroll=e=>{
  const el=e.currentTarget;
  if(!frame.current)frame.current=requestAnimationFrame(()=>{
   frame.current=0;
   const center=el.scrollLeft+el.clientWidth/2;
   let closest=0,distance=Infinity;
   Array.from(el.children).forEach((slide,i)=>{const delta=Math.abs(slide.offsetLeft+slide.offsetWidth/2-center);if(delta<distance){distance=delta;closest=i;}});
   const real=looping?(closest===0?ads.length-1:closest===ads.length+1?0:closest-1):0;
   if(real!==selected.current){selected.current=real;setActive(real);}
  });
  clearTimeout(settle.current);
  settle.current=setTimeout(()=>{
   if(!looping||!el.isConnected)return;
   const center=el.scrollLeft+el.clientWidth/2;
   const first=el.children[0],last=el.children[ads.length+1];
   if(first&&Math.abs(first.offsetLeft+first.offsetWidth/2-center)<2)el.scrollTo({left:positionFor(el,ads.length),behavior:'auto'});
   else if(last&&Math.abs(last.offsetLeft+last.offsetWidth/2-center)<2)el.scrollTo({left:positionFor(el,1),behavior:'auto'});
  },180);
 };
 if(!ads.length)return null;
 return <section className={`ad-carousel ad-fixed-frame ad-cinema${looping?' ad-peek':''}`} aria-label="الإعلانات" aria-roledescription="عارض إعلانات">
  <div className="ad-track" dir="ltr" ref={track} tabIndex={0} aria-label="اسحب الإعلانات يمينًا ويسارًا" onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();go(selected.current+1);}if(e.key==='ArrowRight'){e.preventDefault();go(selected.current-1);}}} onPointerDown={()=>setInteracting(true)} onPointerUp={()=>setInteracting(false)} onPointerCancel={()=>setInteracting(false)} onScroll={onScroll}>
   {slides.map((ad,i)=>{const real=looping?(i===0?ads.length-1:i===ads.length+1?0:i-1):i,clone=looping&&(i===0||i===ads.length+1);return <article dir="rtl" className={`ad-slide${active===real&&!clone?' ad-slide-active':''}`} key={clone?`clone-${i}`:ad.id||i} aria-label={`الإعلان ${real+1} من ${ads.length}`} aria-hidden={clone||active!==real}>
    {(ad.imageUrl)&&<button type="button" className="ad-artwork" tabIndex={!clone&&active===real?0:-1} aria-label={`عرض الإعلان: ${ad.title||"إعلان"}`} onClick={()=>{if(clone||active!==real){go(i-1);return;}const url=ad.targetUrl||ad.link||ad.url||ad.website;if(url && /^https?:\\/\\//i.test(url))window.open(url,"_blank","noopener,noreferrer");else if(ad.phone)window.location.href=`tel:${String(ad.phone).replace(/[^+\\d]/g,"")}`;else setViewImage(ad.imageUrl);}}><img className="ad-slide-photo" src={ad.imageUrl} alt={ad.title||"إعلان"} draggable="false" decoding="async" loading={i<=2?"eager":"lazy"}/></button>}

   </article>;})}
  </div>
  {looping&&<><div className="ad-pagination" aria-label="التنقل بين الإعلانات" dir="rtl"><button type="button" className="ad-nav-button" aria-label="الإعلان السابق" onClick={()=>go(selected.current-1)}>→</button><span className="ad-pagination-count">{(active+1).toLocaleString('ar-EG')}<small> / {ads.length.toLocaleString('ar-EG')}</small></span><div className="ad-pages" aria-label="اختيار الإعلان">{ads.map((ad,index)=><button type="button" className="ad-page-button" key={ad.id||index} aria-label={`انتقل للإعلان ${index+1}`} aria-pressed={active===index} onClick={()=>go(index)}><span aria-hidden="true"/></button>)}</div><button type="button" className="ad-nav-button" aria-label="الإعلان التالي" onClick={()=>go(selected.current+1)}>←</button><button type="button" className="ad-cinema-pause" aria-label={paused?"تشغيل حركة الإعلانات":"إيقاف حركة الإعلانات"} onClick={()=>setPaused(v=>!v)}>{paused?"▶":"Ⅱ"}</button></div><div className="ad-cinema-progress" aria-hidden="true"><span key={`${active}-${running}`} style={{animationPlayState:running?'running':'paused'}}/></div></>}
  {viewImage&&<ImageViewer images={[viewImage]} onClose={()=>setViewImage(null)}/>}
  <span className="sr-only" aria-live={paused?"polite":"off"}>الإعلان {active+1} من {ads.length}</span>
 </section>;
}
