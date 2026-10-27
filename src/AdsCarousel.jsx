import {useEffect,useRef,useState} from 'react';
import './ad-review-refinement.css';
import {ImageViewer} from './MediaFeatures';

export default function AdsCarousel({ads=[],fallbackImage}) {
 const track=useRef(null),[active,setActive]=useState(0),[paused,setPaused]=useState(false),[viewImage,setViewImage]=useState(null),selected=useRef(0),scrollFrame=useRef(0);
 selected.current=active;
 const positionFor=(el,index)=>{const slide=el?.children[index];if(!slide)return 0;const trackRect=el.getBoundingClientRect(),slideRect=slide.getBoundingClientRect();return el.scrollLeft+slideRect.left-trackRect.left-(el.clientWidth-slideRect.width)/2;};
 const go=index=>{
  const target=Math.max(0,Math.min(index,ads.length-1));
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(track.current)track.current.scrollTo({left:positionFor(track.current,target),behavior:reduced?'auto':'smooth'});
 };

 useEffect(()=>()=>{if(scrollFrame.current)cancelAnimationFrame(scrollFrame.current);},[]);
 useEffect(()=>{setActive(0);track.current?.scrollTo({left:0,behavior:'auto'});},[ads.length]);
 useEffect(()=>{const el=track.current;if(!el)return;const observer=new ResizeObserver(()=>el.scrollTo({left:positionFor(el,selected.current),behavior:'auto'}));observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(paused||viewImage||ads.length<2)return;
  const timer=window.setInterval(()=>{
   const el=track.current;if(!el||document.hidden||(el.matches(':focus-visible')||el.querySelector(':focus-visible')))return;
   const target=(selected.current+1)%ads.length;
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(reduced)return;
   el.scrollTo({left:positionFor(el,target),behavior:reduced||target===0?'auto':'smooth'});
  },5000);
  return()=>window.clearInterval(timer);
 },[ads.length,paused,viewImage]);
 if(!ads.length)return null;
 return <section className={`ad-carousel ad-fixed-frame${ads.length>1?' ad-peek':''}`} aria-label="الإعلانات" aria-roledescription="عارض إعلانات">
  <div className="ad-track" dir="ltr" ref={track} tabIndex={0} aria-label="اسحب الإعلانات يمينًا ويسارًا" onKeyDown={event=>{if(event.key==='ArrowLeft'){event.preventDefault();go(active+1);}if(event.key==='ArrowRight'){event.preventDefault();go(active-1);}}} onScroll={event=>{const el=event.currentTarget;if(scrollFrame.current)return;scrollFrame.current=requestAnimationFrame(()=>{scrollFrame.current=0;const center=el.getBoundingClientRect().left+el.clientWidth/2;let closest=0,distance=Infinity;Array.from(el.children).forEach((slide,i)=>{const r=slide.getBoundingClientRect(),delta=Math.abs(r.left+r.width/2-center);if(delta<distance){distance=delta;closest=i;}});if(closest!==selected.current){selected.current=closest;setActive(closest);}});}}>
   {ads.map((ad,index)=><article dir="rtl" className={`ad-slide${active===index?' ad-slide-active':''}`} key={ad.id||index} aria-label={`الإعلان ${index+1} من ${ads.length}`}>
    {(ad.imageUrl||fallbackImage)&&<button type="button" className="ad-artwork" tabIndex={active===index?0:-1} aria-label={`تكبير صورة الإعلان: ${ad.title||"إعلان"}`} onClick={()=>setViewImage(ad.imageUrl||fallbackImage)}><img className="ad-slide-photo" src={ad.imageUrl||fallbackImage} alt={ad.title||"إعلان"} draggable="false" decoding="async" loading={index===0?"eager":"lazy"}/><span className="ad-expand" aria-hidden="true">⛶ تكبير</span></button>}
    
    <div className="ad-slide-copy"><span className="ad-label">{ad.badge||'مساحة إعلانية'}</span><h2>{ad.title||'إعلان'}</h2><p>{ad.desc||''}</p>{ad.phone&&<a className="ad-cta" href={`tel:${String(ad.phone).replace(/[^+\d]/g,'')}`} tabIndex={active===index?0:-1}>اعرف المزيد <span>‹</span></a>}</div>
   </article>)}
  </div>
  {ads.length>1&&<div className="ad-pagination" aria-label="التنقل بين الإعلانات" dir="rtl"><button type="button" className="ad-nav-button" aria-label="الإعلان السابق" onClick={()=>go(active-1)} disabled={active===0}>→</button><span className="ad-pagination-count">{(active+1).toLocaleString('ar-EG')}<small> / {ads.length.toLocaleString('ar-EG')}</small></span><div className="ad-pages" aria-label="اختيار الإعلان">{ads.map((ad,index)=><button type="button" className="ad-page-button" key={ad.id||index} aria-label={`انتقل للإعلان ${index+1}`} aria-pressed={active===index} onClick={()=>go(index)}><span aria-hidden="true"/></button>)}</div><button type="button" className="ad-nav-button" aria-label="الإعلان التالي" onClick={()=>go(active+1)} disabled={active===ads.length-1}>←</button></div>}

  {ads.length>1&&<button type="button" aria-label={paused?"تشغيل حركة الإعلانات":"إيقاف حركة الإعلانات"} onClick={()=>setPaused(value=>!value)} style={{position:"absolute",top:10,left:10,zIndex:3,minWidth:44,minHeight:44,border:"1px solid #ffffff88",borderRadius:12,background:"#143d2bd9",color:"white",fontSize:16,cursor:"pointer"}}>{paused?"▶":"Ⅱ"}</button>}
  {viewImage&&<ImageViewer images={[viewImage]} onClose={()=>setViewImage(null)}/>}
  <span className="sr-only" aria-live={paused?"polite":"off"}>الإعلان {active+1} من {ads.length}</span>
 </section>;
}
