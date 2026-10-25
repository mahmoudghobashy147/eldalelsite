import {useEffect,useRef,useState} from 'react';

export default function AdsCarousel({ads=[],fallbackImage}) {
 const track=useRef(null),[active,setActive]=useState(0),selected=useRef(0);
 selected.current=active;
 const go=index=>{
  const target=Math.max(0,Math.min(index,ads.length-1));
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  track.current?.scrollTo({left:target*track.current.clientWidth,behavior:reduced?'auto':'smooth'});
 };
 useEffect(()=>{setActive(0);track.current?.scrollTo({left:0,behavior:'auto'});},[ads.length]);
 useEffect(()=>{const el=track.current;if(!el)return;const observer=new ResizeObserver(()=>el.scrollTo({left:selected.current*el.clientWidth,behavior:'auto'}));observer.observe(el);return()=>observer.disconnect();},[]);
 if(!ads.length)return null;
 return <section className="ad-carousel" aria-label="الإعلانات" aria-roledescription="عارض إعلانات">
  <div className="ad-track" dir="ltr" ref={track} tabIndex={0} aria-label="اسحب الإعلانات يمينًا ويسارًا" onKeyDown={event=>{if(event.key==='ArrowLeft'){event.preventDefault();go(active+1);}if(event.key==='ArrowRight'){event.preventDefault();go(active-1);}}} onScroll={event=>{const el=event.currentTarget;if(el.clientWidth)setActive(Math.max(0,Math.min(ads.length-1,Math.round(el.scrollLeft/el.clientWidth))));}}>
   {ads.map((ad,index)=><article dir="rtl" className="ad-slide" key={ad.id||index} aria-label={`الإعلان ${index+1} من ${ads.length}`}>
    {(ad.imageUrl||fallbackImage)&&<img className="ad-slide-photo" src={ad.imageUrl||fallbackImage} alt="" draggable="false"/>}
    <div className="ad-slide-shade"/>
    <div className="ad-slide-copy"><span className="ad-label">{ad.badge||'مساحة إعلانية'}</span><h2>{ad.title||'إعلان'}</h2><p>{ad.desc||''}</p>{ad.phone&&<a className="ad-cta" href={`tel:${String(ad.phone).replace(/[^+\d]/g,'')}`} tabIndex={active===index?0:-1}>اعرف المزيد <span>‹</span></a>}</div>
   </article>)}
  </div>
  {ads.length>1&&<><button type="button" className="ad-arrow ad-next" aria-label="الإعلان التالي" onClick={()=>go(active+1)} disabled={active===ads.length-1}>‹</button><button type="button" className="ad-arrow ad-prev" aria-label="الإعلان السابق" onClick={()=>go(active-1)} disabled={active===0}>›</button><div className="ad-dots" aria-label="اختيار الإعلان">{ads.map((ad,index)=><button type="button" key={ad.id||index} aria-label={`انتقل للإعلان ${index+1}`} aria-pressed={active===index} onClick={()=>go(index)}/>)}</div></>}
  <span className="sr-only" aria-live="polite">الإعلان {active+1} من {ads.length}</span>
 </section>;
}
