import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {preparePostPatch} from './post-editor.js';

export function ImageViewer({images, initialIndex=0, onClose}) {
  const [index,setIndex]=useState(Math.min(initialIndex,images.length-1));
  const [zoom,setZoom]=useState(1);
  const [imageError,setImageError]=useState(false),[retry,setRetry]=useState(0);
  const panel=useRef(null),touch=useRef(null);
  const move=delta=>{setIndex(i=>(i+delta+images.length)%images.length);setZoom(1);setImageError(false);};
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';panel.current?.focus();
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='ArrowLeft'){event.preventDefault();move(1);}
      if(event.key==='ArrowRight'){event.preventDefault();move(-1);}
      if(event.key==='Tab'){
        const controls=[...panel.current.querySelectorAll('button:not(:disabled)')];
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus?.();};
  },[onClose,images.length]);
  if(!images.length)return null;
  const control={border:'1px solid #ffffff40',background:'#ffffff15',borderRadius:12,color:'white',padding:'10px 14px',cursor:'pointer',fontFamily:'inherit',minHeight:44};
  return createPortal(<div ref={panel} role="dialog" aria-modal="true" aria-label="عرض الصور" tabIndex={-1} dir="rtl" style={{position:'fixed',inset:0,zIndex:20000,background:'rgba(4,10,19,.97)',color:'white',display:'flex',flexDirection:'column',fontFamily:'Cairo, sans-serif'}}>
    <div style={{display:'flex',gap:8,alignItems:'center',padding:12,flexWrap:'wrap'}}>
      <button style={control} onClick={onClose} aria-label="إغلاق عرض الصور">✕ إغلاق</button>
      <span role="status" style={{marginInlineEnd:'auto'}}>الصورة {index+1} من {images.length}</span>
      <button style={control} onClick={()=>setZoom(z=>Math.min(3,z+.5))} disabled={zoom>=3} aria-label="تكبير الصورة">＋</button>
      <button style={control} onClick={()=>setZoom(z=>Math.max(1,z-.5))} disabled={zoom<=1} aria-label="تصغير الصورة">−</button>
    </div>
    <div onTouchStart={e=>{touch.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(zoom===1&&touch.current!==null){const delta=e.changedTouches[0].clientX-touch.current;if(Math.abs(delta)>60)move(delta>0?-1:1);}touch.current=null;}} style={{flex:1,minHeight:0,overflow:'auto',display:'grid',placeItems:'center',padding:12}}>
      {imageError?<div role="alert" style={{textAlign:'center',padding:20}}><p>تعذر تحميل الصورة. تحقق من الاتصال ثم حاول مجددًا.</p><button style={control} onClick={()=>{setImageError(false);setRetry(n=>n+1);}}>إعادة تحميل الصورة</button></div>:<img key={`${index}-${retry}`} onError={()=>setImageError(true)} src={images[index]} alt={`الصورة ${index+1} مكبرة`} onDoubleClick={()=>setZoom(z=>z===1?2:1)} style={{width:zoom===1?'auto':`${zoom*100}%`,maxWidth:zoom===1?'100%':'none',maxHeight:zoom===1?'calc(100dvh - 165px)':'none',objectFit:'contain',display:'block'}}/>}
    </div>
    {images.length>1&&<div style={{display:'flex',justifyContent:'center',gap:12,padding:14}}>
      <button style={control} onClick={()=>move(-1)} aria-label="الصورة السابقة">→ السابقة</button>
      <button style={control} onClick={()=>move(1)} aria-label="الصورة التالية">التالية ←</button>
    </div>}
  </div>,document.body);
}

export function MediaGallery({images=[],label='صور المنشور',columns,compact=false}) {
  const [selected,setSelected]=useState(null);
  const close=React.useCallback(()=>setSelected(null),[]);
  if(!images.length)return null;
  return <><div aria-label={label} style={{display:'grid',gridTemplateColumns:`repeat(${columns||(images.length===1?1:2)}, minmax(0,1fr))`,gap:5,borderRadius:10,overflow:'hidden',marginTop:8}}>
    {images.map((src,index)=><button key={`${src}-${index}`} type="button" aria-label={`فتح ${label} ${index+1}`} onClick={()=>setSelected(index)} style={{padding:0,border:0,cursor:'zoom-in',background:'#eef1f5',minWidth:0,aspectRatio:compact?'1':images.length===1?'16/9':'1',overflow:'hidden'}}>
      <img src={src} alt={`${label} ${index+1}`} loading="lazy" style={{width:'100%',height:'100%',objectFit:compact?'cover':'contain',display:'block'}}/>
    </button>)}
  </div>{selected!==null&&<ImageViewer images={images} initialIndex={selected} onClose={close}/>}</>;
}

export function PostEditor({post,currentUser,onClose,onSaved,onSave,uploadImage,darkMode=false}) {
  const [text,setText]=useState(post.content||'');
  const [images,setImages]=useState((post.images||[]).map(url=>({url})));
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const files=useRef(null),dialog=useRef(null),previews=useRef(new Set());
  useEffect(()=>{const prev=document.activeElement;dialog.current?.focus();const key=e=>{if(e.key==='Escape'&&!saving)onClose();if(e.key==='Tab'){const controls=[...dialog.current.querySelectorAll('button:not(:disabled),textarea,input:not([type="file"])')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prev?.focus?.();};},[onClose,saving]);
  useEffect(()=>()=>{previews.current.forEach(URL.revokeObjectURL);},[]);
  const addFiles=e=>{
    const incoming=[...e.target.files];e.target.value='';setError('');
    if(incoming.some(file=>!file.type.startsWith('image/'))){setError('اختر صورًا فقط');return;}
    if(images.length+incoming.length>4){setError('يمكن إرفاق أربع صور بحد أقصى');return;}
    if(incoming.some(file=>file.size>=8*1024*1024)){setError('حجم كل صورة يجب أن يكون أقل من 8 ميجابايت');return;}
    setImages(items=>[...items,...incoming.map(file=>{const url=URL.createObjectURL(file);previews.current.add(url);return {url,file};})]);
  };
  const save=async()=>{
    setError('');setSaving(true);
    try {
      if(currentUser?.uid!==post.authorId)throw new Error('يمكن لصاحب المنشور فقط تعديله');
      // Validate before uploading any new file.
      preparePostPatch(text,images.map(item=>item.url));
      const urls=[];
      for(const item of images)urls.push(item.file?await uploadImage(item.file):item.url);
      const patch=preparePostPatch(text,urls);
      const saved=await onSave(post.id,patch);
      onSaved({...post,...patch,...saved});onClose();
    }catch(e){setError(e.message||'تعذر حفظ التعديل، جرّب مرة أخرى');}
    finally{setSaving(false);}
  };
  const color=darkMode?'white':'#102038';
  return createPortal(<div style={{position:'fixed',inset:0,zIndex:18000,background:'#071324aa',display:'flex',alignItems:'center',justifyContent:'center',padding:12}}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="تعديل المنشور" dir="rtl" style={{background:darkMode?'#14233b':'white',color,borderRadius:20,padding:20,width:'100%',maxWidth:480,maxHeight:'90dvh',overflow:'auto',fontFamily:'Cairo, sans-serif'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}><h2 style={{fontSize:19}}>تعديل المنشور</h2><button type="button" aria-label="إلغاء التعديل" disabled={saving} onClick={onClose} style={{border:0,borderRadius:8,padding:10,cursor:'pointer'}}>✕</button></div>
      <label htmlFor="post-edit-content" style={{display:'block',marginBottom:8}}>نص المنشور</label>
      <textarea id="post-edit-content" value={text} onChange={e=>setText(e.target.value)} maxLength={10000} rows={5} disabled={saving} style={{boxSizing:'border-box',width:'100%',border:'1px solid #aeb9c6',borderRadius:12,padding:12,fontFamily:'inherit',fontSize:14,resize:'vertical',background:darkMode?'#0a1628':'white',color}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,marginTop:12}}>{images.map((item,i)=><div key={item.url} style={{position:'relative',borderRadius:10,overflow:'hidden',background:'#edf1f5'}}><img src={item.url} alt={`مرفق المنشور ${i+1}`} style={{width:'100%',height:140,objectFit:'contain'}}/><button disabled={saving} onClick={()=>setImages(items=>items.filter((_,index)=>index!==i))} aria-label={`إزالة الصورة ${i+1}`} style={{position:'absolute',top:5,left:5,border:0,borderRadius:'50%',width:32,height:32,background:'#102038de',color:'white',cursor:'pointer'}}>✕</button></div>)}</div>
      <input ref={files} type="file" accept="image/*" multiple onChange={addFiles} style={{display:'none'}}/>
      <button disabled={saving||images.length>=4} onClick={()=>files.current.click()} style={{padding:12,border:'1px solid #c9a84c',borderRadius:10,background:'transparent',color,marginTop:12,cursor:'pointer',fontFamily:'inherit'}}>إضافة صور ({images.length}/4)</button>
      {error&&<p role="alert" style={{color:'#c12d2d',marginTop:12}}>{error}</p>}
      <div style={{display:'flex',gap:10,marginTop:20}}><button disabled={saving} onClick={save} style={{flex:1,border:0,borderRadius:12,padding:13,background:'#c9a84c',color:'#102038',fontFamily:'inherit',fontWeight:800,cursor:'pointer'}}>{saving?'جاري الحفظ…':'حفظ التعديلات'}</button><button disabled={saving} onClick={onClose} style={{border:'1px solid #cbd3dd',borderRadius:12,padding:13,fontFamily:'inherit',cursor:'pointer'}}>إلغاء</button></div>
    </div>
  </div>,document.body);
}
