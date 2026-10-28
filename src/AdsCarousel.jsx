import {useEffect,useRef,useState} from 'react';
import './ad-review-refinement.css';
import {ImageViewer} from './MediaFeatures';

const INTERVAL=4500;
export default function AdsCarousel({ads:allAds=[]}) {
 const ads=allAds.filter(ad=>ad.id!=='advertise-with-us' && ad.imageUrl && (!ad.status || ad.status==='active') && (!ad.endDate || new Date(String(ad.endDate).slice(0,10)+'T23:59:59').getTime()>=Date.now()));
 const [active,setActive]=useState(0),[paused,setPaused]=useState(false),[viewImage,setViewImage]=useState(null),[hover,setHover]=useState(false),[focused,setFocused]=useState(false),[visible,setVisible]=useState(!document.hidden),[reduceMotion,setReduceMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const pointer=useRef(null),dragged=useRef(false);
 const n=ads.length, current=n?active%n:0, multiple=n>1;
 const go=index=>{if(n)setActive((index+n)%n)};
 useEffect(()=>{setActive(0)},[n]);
 useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduceMotion(m.matches),vis=()=>setVisible(!document.hidden);m.addEventListener?.('change',change);document.addEventListener('visibilitychange',vis);return()=>{m.removeEventListener?.('change',change);document.removeEventListener('visibilitychange',vis)}},[]);
 const running=multiple&&!paused&&!viewImage&&visible&&!reduceMotion&&!hover&&!focused;
 useEffect(()=>{if(!running)return;const timer=setTimeout(()=>setActive(i=>(i+1)%n),INTERVAL);return()=>clearTimeout(timer)},[running,current,n]);
 function openAd(ad){const url=ad.targetUrl||ad.link||ad.url||ad.website;if(url && (String(url).startsWith('https://')||String(url).startsWith('http://')))window.open(url,'_blank','noopener,noreferrer');else if(ad.phone)window.location.href=`tel:${String(ad.phone).replace(/[^+0-9]/g,'')}`;else setViewImage(ad.imageUrl)}
 if(!n)return null;
 return <section className="ad-carousel ad-fixed-frame ad-cinema video-coverflow" aria-label="الإعلانات الممولة" aria-roledescription="عارض إعلانات" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false)}}>
  <div className="video-coverflow-stage" dir="ltr" aria-label="اسحب الإعلانات يمينًا ويسارًا" onPointerDown={e=>{pointer.current=e.clientX;dragged.current=false}} onPointerUp={e=>{if(pointer.current!==null){const dx=e.clientX-pointer.current;if(Math.abs(dx)>40){dragged.current=true;go(current+(dx<0?1:-1))}pointer.current=null}}} onPointerCancel={()=>{pointer.current=null}}>
   {ads.map((ad,i)=>{const isCurrent=i===current,isPrev=multiple&&i===(current+n-1)%n,isNext=n>2&&i===(current+1)%n;const pos=isCurrent?'current':isPrev?'previous':isNext?'next':'hidden';return <article key={ad.id||i} className={`video-coverflow-card ${pos}`} aria-hidden={!isCurrent} aria-label={`الإعلان ${i+1} من ${n}`}>
    <button type="button" tabIndex={isCurrent?0:-1} className="video-coverflow-art" aria-label={`عرض الإعلان: ${ad.title||'إعلان'}`} onClick={()=>{if(dragged.current){dragged.current=false;return}if(!isCurrent){go(i);return}openAd(ad)}}>
     <img className="video-coverflow-backdrop" src={ad.imageUrl} alt="" aria-hidden="true" loading="lazy" draggable="false"/>
     <img className="video-coverflow-photo" src={ad.imageUrl} alt={ad.title||'إعلان'} loading={isCurrent?'eager':'lazy'} decoding="async" draggable="false"/>
    </button>
   </article>})}
  </div>
  {multiple&&<><div className="video-coverflow-controls" dir="rtl"><span className="video-coverflow-count">{(current+1).toLocaleString('ar-EG')} / {n.toLocaleString('ar-EG')}</span><div className="video-coverflow-dots">{ads.map((ad,i)=><button key={ad.id||i} type="button" aria-label={`انتقل للإعلان ${i+1}`} aria-pressed={i===current} onClick={()=>go(i)}/>)}</div><button type="button" className="video-coverflow-control" aria-label="الإعلان السابق" onClick={()=>go(current-1)}>→</button><button type="button" className="video-coverflow-control" aria-label="الإعلان التالي" onClick={()=>go(current+1)}>←</button><button type="button" className="video-coverflow-control" aria-label={paused?'تشغيل حركة الإعلانات':'إيقاف حركة الإعلانات'} onClick={()=>setPaused(v=>!v)}>{paused?'▶':'Ⅱ'}</button></div><div className="video-coverflow-progress" aria-hidden="true"><span key={`${current}-${running}`} style={{animationPlayState:running?'running':'paused'}}/></div></>}
  {viewImage&&<ImageViewer images={[viewImage]} onClose={()=>setViewImage(null)}/>}
  <span className="sr-only" aria-live={paused?'polite':'off'}>الإعلان {current+1} من {n}</span>
 </section>;
}
