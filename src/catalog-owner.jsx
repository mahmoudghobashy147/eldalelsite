import React, { useEffect, useMemo, useState } from "react";
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc,
  serverTimestamp, writeBatch
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const GOLD = "#C9A84C";
const GOLD_DARK = "#9E7B28";
const NAVY = "#0A1F44";
const NAVY_DEEP = "#060E1C";
const OFF_WHITE = "#F7F5F0";
const GRAY = "#667085";
const BORDER = "#E5E7EB";

const BUSINESS_EDITABLE_FIELDS = [
  "name","activityType","description","governorate","area","address","branches","phones","whatsapp",
  "mapUrl","facebook","instagram","website","logoUrl","coverUrl","offers"
];

const emptyBusinessForm = {
  name:"", activityType:"محل", description:"", governorate:"", area:"", address:"",
  branches:"", phones:"", whatsapp:"", mapUrl:"", facebook:"", instagram:"", website:"",
  logoUrl:"", coverUrl:"", offers:""
};

const emptyProductForm = {
  name:"", code:"", categoryId:"", subCategory:"", size:"", color:"", material:"", specs:"",
  description:"", price:"", showPrice:true, availability:"متوفر", discount:"", mainImage:"", images:[]
};

function colors(darkMode){
  return {
    bg: darkMode ? NAVY_DEEP : OFF_WHITE,
    card: darkMode ? "#0F2748" : "#fff",
    tc: darkMode ? "#fff" : NAVY,
    sub: darkMode ? "rgba(255,255,255,.58)" : GRAY,
    border: darkMode ? "rgba(201,168,76,.18)" : BORDER,
    input: darkMode ? "rgba(255,255,255,.07)" : "#fff"
  };
}

function useMobile(){
  const get=()=>typeof window!=="undefined"&&window.innerWidth<768;
  const [mobile,setMobile]=useState(get);
  useEffect(()=>{const fn=()=>setMobile(get());window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn)},[]);
  return mobile;
}

function Btn({children,onClick,secondary=false,danger=false,disabled=false,style={}}){
  const bg=danger?"#FEF2F2":secondary?"transparent":`linear-gradient(135deg,${GOLD},${GOLD_DARK})`;
  const color=danger?"#DC2626":secondary?GOLD:NAVY_DEEP;
  const border=danger?"1px solid #FCA5A5":secondary?`1px solid ${GOLD}`:"none";
  return <button type="button" disabled={disabled} onClick={onClick} style={{border,borderRadius:12,padding:"11px 14px",background:bg,color,fontFamily:"Cairo,Tajawal,sans-serif",fontWeight:900,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1,...style}}>{children}</button>;
}

function Field({label,value,onChange,type="text",textarea=false,options=null,placeholder="",darkMode=false}){
  const c=colors(darkMode);
  const style={width:"100%",boxSizing:"border-box",marginTop:5,padding:"12px",borderRadius:11,border:`1px solid ${c.border}`,background:c.input,color:c.tc,fontFamily:"Cairo",fontSize:13,outline:"none"};
  return <label style={{display:"block",fontSize:11.5,fontWeight:800,color:c.sub}}>{label}
    {options?<select value={value||""} onChange={e=>onChange(e.target.value)} style={style}><option value="">اختر</option>{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}</select>
    :textarea?<textarea rows={3} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...style,resize:"vertical"}}/>
    :<input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style}/>}</label>;
}

function Img({src,alt=""}){
  return src?<img src={src} alt={alt} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#F1E8C8,#E8DFC1)",fontSize:28}}>🧱</div>;
}

const businessUrl=id=>{
  const origin=typeof window!=="undefined"?window.location.origin:"https://eldalel-elshamel.online";
  return `${origin}/?catalog=business&businessId=${encodeURIComponent(id)}`;
};
const productUrl=id=>{
  const origin=typeof window!=="undefined"?window.location.origin:"https://eldalel-elshamel.online";
  return `${origin}/?catalog=product&productId=${encodeURIComponent(id)}`;
};
const qrImageUrl=url=>`https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=16&data=${encodeURIComponent(url)}`;

async function shareUrl(title,url){
  if(navigator.share){await navigator.share({title,url}).catch(()=>{});return;}
  await navigator.clipboard?.writeText(url);
  alert("تم نسخ الرابط ✅");
}

async function downloadQr(url,name){
  const qr=qrImageUrl(url);
  try{
    const res=await fetch(qr);
    if(!res.ok)throw new Error("qr");
    const blob=await res.blob();
    const objectUrl=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=objectUrl;a.download=`QR-${String(name||"catalog").replace(/[^\p{L}\p{N}._-]+/gu,"_")}.png`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(objectUrl);
  }catch{window.open(qr,"_blank","noopener,noreferrer")}
}

async function uploadOwnerImage(storage,uid,path,file){
  if(!file)return "";
  if(!file.type?.startsWith("image/"))throw new Error("الملف لازم يكون صورة");
  if(file.size>8*1024*1024)throw new Error("حجم الصورة أكبر من 8 ميجا");
  const safe=(file.name||"image").replace(/[^\w.\-]/g,"_");
  const ref=storageRef(storage,`catalog/owners/${uid}/${path}/${Date.now()}_${safe}`);
  await uploadBytes(ref,file,{contentType:file.type});
  return getDownloadURL(ref);
}

function statusMeta(status){
  if(status==="approved")return {label:"منشور",color:"#16A34A",bg:"#F0FDF4"};
  if(status==="rejected")return {label:"مرفوض",color:"#DC2626",bg:"#FEF2F2"};
  return {label:"قيد المراجعة",color:"#B7791F",bg:"#FFFBEB"};
}
function StatusBadge({status}){const s=statusMeta(status);return <span style={{display:"inline-flex",padding:"4px 9px",borderRadius:20,background:s.bg,color:s.color,fontSize:10.5,fontWeight:900}}>{s.label}</span>}

function BusinessForm({value,onChange,darkMode,setLogoFile,setCoverFile,title="بيانات الكتالوج"}){
  const mobile=useMobile(),c=colors(darkMode);
  return <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:16,padding:14}}>
    <div style={{fontFamily:"Cairo",fontWeight:900,color:c.tc,fontSize:17,marginBottom:12}}>{title}</div>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,minmax(0,1fr))",gap:9}}>
      <Field darkMode={darkMode} label="اسم الشركة / المحل / المصنع" value={value.name} onChange={v=>onChange(x=>({...x,name:v}))}/>
      <Field darkMode={darkMode} label="نوع النشاط" value={value.activityType} onChange={v=>onChange(x=>({...x,activityType:v}))} options={["محل","مصنع","توكيل","موزع","مورد","شركة"]}/>
      <Field darkMode={darkMode} label="المحافظة" value={value.governorate} onChange={v=>onChange(x=>({...x,governorate:v}))}/>
      <Field darkMode={darkMode} label="المنطقة" value={value.area} onChange={v=>onChange(x=>({...x,area:v}))}/>
      <Field darkMode={darkMode} label="العنوان" value={value.address} onChange={v=>onChange(x=>({...x,address:v}))}/>
      <Field darkMode={darkMode} label="رقم التواصل" value={value.phones} onChange={v=>onChange(x=>({...x,phones:v}))}/>
      <Field darkMode={darkMode} label="واتساب" value={value.whatsapp} onChange={v=>onChange(x=>({...x,whatsapp:v}))}/>
      <Field darkMode={darkMode} label="رابط الخريطة" value={value.mapUrl} onChange={v=>onChange(x=>({...x,mapUrl:v}))}/>
      <Field darkMode={darkMode} label="الموقع الإلكتروني" value={value.website} onChange={v=>onChange(x=>({...x,website:v}))}/>
      <Field darkMode={darkMode} label="فيسبوك" value={value.facebook} onChange={v=>onChange(x=>({...x,facebook:v}))}/>
      <Field darkMode={darkMode} label="إنستجرام" value={value.instagram} onChange={v=>onChange(x=>({...x,instagram:v}))}/>
      <Field darkMode={darkMode} label="نبذة مختصرة" value={value.description} onChange={v=>onChange(x=>({...x,description:v}))} textarea/>
      <Field darkMode={darkMode} label="الفروع" value={value.branches} onChange={v=>onChange(x=>({...x,branches:v}))} textarea placeholder="كل فرع في سطر"/>
      <Field darkMode={darkMode} label="العروض الحالية" value={value.offers} onChange={v=>onChange(x=>({...x,offers:v}))} textarea/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:9,marginTop:10}}>
      <label style={{fontSize:11.5,fontWeight:800,color:c.sub}}>شعار النشاط<input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0]||null)} style={{width:"100%",marginTop:6,color:c.tc}}/></label>
      <label style={{fontSize:11.5,fontWeight:800,color:c.sub}}>صورة الغلاف<input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files?.[0]||null)} style={{width:"100%",marginTop:6,color:c.tc}}/></label>
    </div>
  </div>;
}

function ProductForm({value,onChange,categories,darkMode,setMainFile,setExtraFiles}){
  const mobile=useMobile(),c=colors(darkMode),[advanced,setAdvanced]=useState(false);
  const pickImages=e=>{const files=[...(e.target.files||[])];setMainFile(files[0]||null);setExtraFiles(files.slice(1));};
  return <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:16,padding:mobile?13:16}}>
    <label style={{display:"block",border:`2px dashed ${GOLD}`,borderRadius:15,padding:"18px 14px",textAlign:"center",cursor:"pointer",marginBottom:12,background:darkMode?"rgba(201,168,76,.05)":"#FFFCF3",color:c.tc,fontWeight:900}}>
      <div style={{fontSize:30}}>📷</div><div>صور المنتج</div><div style={{fontSize:10.5,color:c.sub,marginTop:3}}>صوّر المنتج أو اختر أكثر من صورة</div>
      <input type="file" accept="image/*" multiple onChange={pickImages} style={{display:"none"}}/>
    </label>
    {value.mainImage&&<div style={{width:86,height:86,borderRadius:12,overflow:"hidden",marginBottom:10}}><Img src={value.mainImage}/></div>}
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(2,minmax(0,1fr))",gap:10}}>
      <Field darkMode={darkMode} label="اسم المنتج *" value={value.name} onChange={v=>onChange(x=>({...x,name:v}))} placeholder="مثال: سيراميك رمادي"/>
      <Field darkMode={darkMode} label="القسم / التصنيف *" value={value.categoryId} onChange={v=>onChange(x=>({...x,categoryId:v}))} options={categories.map(x=>({value:x.id,label:x.name}))}/>
      <Field darkMode={darkMode} label="السعر (اختياري)" type="number" value={value.price} onChange={v=>onChange(x=>({...x,price:v}))}/>
      <Field darkMode={darkMode} label="حالة المنتج" value={value.availability} onChange={v=>onChange(x=>({...x,availability:v}))} options={["متوفر","غير متوفر","كمية محدودة","حسب الطلب"]}/>
      <Field darkMode={darkMode} label="المقاسات (اختياري)" value={value.size} onChange={v=>onChange(x=>({...x,size:v}))} placeholder="مثال: 60×60، 80×80"/>
      <Field darkMode={darkMode} label="الألوان (اختياري)" value={value.color} onChange={v=>onChange(x=>({...x,color:v}))} placeholder="مثال: رمادي، بيج"/>
      <div style={{gridColumn:mobile?"auto":"1/-1"}}><Field darkMode={darkMode} label="وصف مختصر (اختياري)" value={value.description} onChange={v=>onChange(x=>({...x,description:v}))} textarea/></div>
    </div>
    <button type="button" onClick={()=>setAdvanced(x=>!x)} style={{marginTop:11,border:0,background:"transparent",color:GOLD,fontWeight:900,fontFamily:"Cairo",cursor:"pointer"}}>{advanced?"إخفاء التفاصيل الإضافية ▲":"تفاصيل إضافية اختيارية ▼"}</button>
    {advanced&&<div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(2,minmax(0,1fr))",gap:9,marginTop:8}}>
      <Field darkMode={darkMode} label="كود المنتج" value={value.code} onChange={v=>onChange(x=>({...x,code:v}))}/>
      <Field darkMode={darkMode} label="نوع المنتج / قسم فرعي" value={value.subCategory} onChange={v=>onChange(x=>({...x,subCategory:v}))}/>
      <Field darkMode={darkMode} label="الخامة" value={value.material} onChange={v=>onChange(x=>({...x,material:v}))}/>
      <Field darkMode={darkMode} label="عرض / خصم" value={value.discount} onChange={v=>onChange(x=>({...x,discount:v}))}/>
      <div style={{gridColumn:mobile?"auto":"1/-1"}}><Field darkMode={darkMode} label="مواصفات إضافية" value={value.specs} onChange={v=>onChange(x=>({...x,specs:v}))} textarea/></div>
      <label style={{fontSize:12,color:c.tc}}><input type="checkbox" checked={value.showPrice!==false} onChange={e=>onChange(x=>({...x,showPrice:e.target.checked}))}/> إظهار السعر للزوار</label>
    </div>}
  </div>;
}

function OwnerProductCard({p,c,onEdit,onDelete,onToggleHidden,onToggleAvailability,onQr}){
  const approved=(p.approvalStatus||"approved")==="approved";
  const hidden=p.ownerHidden===true;
  return <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:15,padding:10,display:"grid",gridTemplateColumns:"76px 1fr",gap:11,marginBottom:9}}>
    <div style={{width:76,height:76,borderRadius:12,overflow:"hidden"}}><Img src={p.mainImage}/></div>
    <div style={{minWidth:0}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:7,alignItems:"start"}}><div style={{minWidth:0}}><div style={{fontWeight:900,color:c.tc,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div><div style={{fontSize:11,color:p.price?GOLD:c.sub,fontWeight:800,marginTop:2}}>{p.showPrice!==false&&p.price?`${Number(p.price).toLocaleString("ar-EG")} ج`:"السعر غير معلن"}</div></div><StatusBadge status={p.approvalStatus||"approved"}/></div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:7}}>
        <button type="button" disabled={!approved} onClick={()=>onToggleAvailability(p)} style={{border:"1px solid #BBF7D0",background:p.availability==="غير متوفر"?"#FEF2F2":"#F0FDF4",color:p.availability==="غير متوفر"?"#DC2626":"#15803D",borderRadius:20,padding:"5px 9px",fontWeight:900,fontSize:10.5,cursor:approved?"pointer":"default",opacity:approved?1:.55}}>{p.availability||"متوفر"}</button>
        {hidden&&<span style={{fontSize:10.5,color:"#B45309",fontWeight:900}}>مخفي</span>}
      </div>
      {p.rejectionReason&&p.approvalStatus==="rejected"&&<div style={{fontSize:10.5,color:"#DC2626",marginTop:5}}>سبب الرفض: {p.rejectionReason}</div>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
        <Btn secondary onClick={()=>onEdit(p)} style={{padding:"7px 9px",fontSize:10.5}}>تعديل</Btn>
        <Btn secondary disabled={!approved} onClick={()=>onToggleHidden(p)} style={{padding:"7px 9px",fontSize:10.5}}>{hidden?"إظهار":"إخفاء"}</Btn>
        <Btn secondary onClick={()=>onQr(p)} style={{padding:"7px 9px",fontSize:10.5}}>QR</Btn>
        <Btn danger onClick={()=>onDelete(p)} style={{padding:"7px 9px",fontSize:10.5}}>حذف</Btn>
      </div>
    </div>
  </div>;
}

export function CatalogOwnerPortal({db,storage,user,darkMode,onRequireAuth,onBack}){
  const c=colors(darkMode),mobile=useMobile(),uid=user?.uid||"";
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[request,setRequest]=useState(null),[business,setBusiness]=useState(null),[products,setProducts]=useState([]),[categories,setCategories]=useState([]);
  const [businessForm,setBusinessForm]=useState({...emptyBusinessForm}),[productForm,setProductForm]=useState({...emptyProductForm}),[editingProduct,setEditingProduct]=useState(null);
  const [logoFile,setLogoFile]=useState(null),[coverFile,setCoverFile]=useState(null),[mainFile,setMainFile]=useState(null),[extraFiles,setExtraFiles]=useState([]);
  const [mode,setMode]=useState("overview");

  const load=async()=>{
    if(!uid){setLoading(false);return;}
    setLoading(true);
    try{
      const [reqSnap,bizSnap,prodSnap,catSnap]=await Promise.all([
        getDoc(doc(db,"catalogBusinessRequests",uid)),
        getDocs(query(collection(db,"catalogBusinesses"),where("ownerId","==",uid))),
        getDocs(query(collection(db,"catalogProducts"),where("ownerId","==",uid))),
        getDocs(query(collection(db,"catalogCategories"),where("active","==",true)))
      ]);
      const req=reqSnap.exists()?{id:reqSnap.id,...reqSnap.data()}:null;
      const biz=bizSnap.docs.map(x=>({id:x.id,...x.data()}))[0]||null;
      setRequest(req);setBusiness(biz);setProducts(prodSnap.docs.map(x=>({id:x.id,...x.data()})));setCategories(catSnap.docs.map(x=>({id:x.id,...x.data()})));
      if(biz)setBusinessForm({...emptyBusinessForm,...Object.fromEntries(BUSINESS_EDITABLE_FIELDS.map(k=>[k,biz[k]??emptyBusinessForm[k]??""]))});
      else if(req)setBusinessForm({...emptyBusinessForm,...Object.fromEntries(BUSINESS_EDITABLE_FIELDS.map(k=>[k,req[k]??emptyBusinessForm[k]??""]))});
    }finally{setLoading(false)}
  };
  useEffect(()=>{load().catch(console.error)},[uid,db]);

  const submitBusinessRequest=async()=>{
    if(!uid)return onRequireAuth?.();
    if(!businessForm.name.trim()||!businessForm.activityType||!businessForm.governorate.trim()||!businessForm.phones.trim())return alert("اسم النشاط ونوعه والمحافظة ورقم التواصل مطلوبين");
    if(request?.status==="pending")return alert("طلبك بالفعل قيد المراجعة");
    if(request?.status==="approved")return alert("نشاطك مقبول بالفعل");
    setBusy(true);
    try{
      let data={...businessForm,name:businessForm.name.trim(),ownerId:uid,ownerName:user?.name||"",ownerPhone:user?.phone||"",status:"pending",updatedAt:serverTimestamp()};
      if(logoFile)data.logoUrl=await uploadOwnerImage(storage,uid,"request",logoFile);
      if(coverFile)data.coverUrl=await uploadOwnerImage(storage,uid,"request",coverFile);
      if(request)await updateDoc(doc(db,"catalogBusinessRequests",uid),data);else await setDoc(doc(db,"catalogBusinessRequests",uid),{...data,createdAt:serverTimestamp()});
      setLogoFile(null);setCoverFile(null);alert("تم إرسال طلب إضافة النشاط للإدارة للمراجعة ✅");await load();setMode("overview");
    }catch(e){alert(e.message||"تعذر إرسال الطلب")}finally{setBusy(false)}
  };

  const saveBusiness=async()=>{
    if(!business)return;
    if(!businessForm.name.trim()||!businessForm.governorate.trim()||!businessForm.phones.trim())return alert("اسم النشاط والمحافظة ورقم التواصل مطلوبين");
    setBusy(true);
    try{
      const data={...Object.fromEntries(BUSINESS_EDITABLE_FIELDS.map(k=>[k,businessForm[k]??""])),name:businessForm.name.trim(),updatedAt:serverTimestamp()};
      if(logoFile)data.logoUrl=await uploadOwnerImage(storage,uid,`businesses/${business.id}`,logoFile);
      if(coverFile)data.coverUrl=await uploadOwnerImage(storage,uid,`businesses/${business.id}`,coverFile);
      await updateDoc(doc(db,"catalogBusinesses",business.id),data);
      setLogoFile(null);setCoverFile(null);alert("تم تحديث بيانات الكتالوج ✅");await load();setMode("overview");
    }catch(e){alert(e.message||"تعذر حفظ البيانات")}finally{setBusy(false)}
  };

  const startNewProduct=()=>{setEditingProduct(null);setProductForm({...emptyProductForm});setMainFile(null);setExtraFiles([]);setMode("product")};
  const startEditProduct=p=>{setEditingProduct(p);setProductForm({...emptyProductForm,...p,images:p.images||[]});setMainFile(null);setExtraFiles([]);setMode("product")};
  const saveProduct=async()=>{
    if(!business)return alert("لا يوجد نشاط معتمد");
    if(!productForm.name.trim()||!productForm.categoryId)return alert("اسم المنتج والتصنيف مطلوبين فقط");
    setBusy(true);
    try{
      const id=editingProduct?.id||doc(collection(db,"catalogProducts")).id;
      let data={
        name:productForm.name.trim(),code:productForm.code||"",categoryId:productForm.categoryId,subCategory:productForm.subCategory||"",businessId:business.id,ownerId:uid,
        size:productForm.size||"",color:productForm.color||"",material:productForm.material||"",specs:productForm.specs||"",description:productForm.description||"",
        price:productForm.price===""?"":Number(productForm.price),showPrice:productForm.showPrice!==false,availability:productForm.availability||"متوفر",discount:productForm.discount||"",
        mainImage:productForm.mainImage||"",images:productForm.images||[],updatedAt:serverTimestamp()
      };
      if(mainFile)data.mainImage=await uploadOwnerImage(storage,uid,`products/${id}`,mainFile);
      if(extraFiles.length){const urls=[];for(const f of extraFiles)urls.push(await uploadOwnerImage(storage,uid,`products/${id}`,f));data.images=[...(data.images||[]),...urls]}
      if(editingProduct){
        data.ownerHidden=editingProduct.ownerHidden===true;
        if(editingProduct.approvalStatus==="rejected"){data.approvalStatus="pending";data.active=false;data.ownerHidden=false;data.rejectionReason=""}
        await updateDoc(doc(db,"catalogProducts",id),data);
        alert(editingProduct.approvalStatus==="rejected"?"تم تعديل السلعة وإرسالها للمراجعة من جديد ✅":"تم تعديل السلعة ✅");
      }else{
        await setDoc(doc(db,"catalogProducts",id),{...data,approvalStatus:"pending",active:false,featured:false,ownerHidden:false,createdAt:serverTimestamp()});
        alert("تم حفظ السلعة وإرسالها للإدارة للمراجعة ✅");
      }
      setEditingProduct(null);setProductForm({...emptyProductForm});setMainFile(null);setExtraFiles([]);await load();setMode("products");
    }catch(e){alert(e.message||"تعذر حفظ السلعة")}finally{setBusy(false)}
  };

  const removeProduct=async p=>{if(!window.confirm(`حذف السلعة ${p.name}؟`))return;try{await deleteDoc(doc(db,"catalogProducts",p.id));await load()}catch(e){alert(e.message)}};
  const toggleAvailability=async p=>{if((p.approvalStatus||"approved")!=="approved")return;const next=p.availability==="غير متوفر"?"متوفر":"غير متوفر";try{await updateDoc(doc(db,"catalogProducts",p.id),{availability:next,updatedAt:serverTimestamp()});setProducts(xs=>xs.map(x=>x.id===p.id?{...x,availability:next}:x))}catch(e){alert(e.message)}};
  const toggleHidden=async p=>{if((p.approvalStatus||"approved")!=="approved")return;const next=!(p.ownerHidden===true);try{await updateDoc(doc(db,"catalogProducts",p.id),{ownerHidden:next,updatedAt:serverTimestamp()});setProducts(xs=>xs.map(x=>x.id===p.id?{...x,ownerHidden:next}:x))}catch(e){alert(e.message)}};

  if(!user)return <div style={{minHeight:"70vh",background:c.bg,padding:25,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:18,padding:25,maxWidth:430,textAlign:"center"}}><div style={{fontSize:42}}>🏪</div><div style={{fontFamily:"Cairo",fontWeight:900,color:c.tc,fontSize:19,marginTop:8}}>إدارة الكتالوج</div><div style={{color:c.sub,fontSize:12.5,margin:"8px 0 16px"}}>سجّل دخولك أولًا لإدارة نشاطك أو تقديم طلب إضافة.</div><Btn onClick={onRequireAuth}>تسجيل الدخول</Btn></div></div>;
  if(loading)return <div style={{minHeight:"70vh",background:c.bg,padding:60,textAlign:"center",color:c.sub}}>جاري تحميل الكتالوج...</div>;

  if(!business){
    const pending=request?.status==="pending",rejected=request?.status==="rejected";
    return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:14}}><div><div style={{fontFamily:"Cairo",fontSize:22,fontWeight:900,color:c.tc}}>إضافة نشاطك للكتالوج</div><div style={{fontSize:12,color:c.sub}}>بعد موافقة الإدارة هتظهر لك لوحة إدارة الكتالوج</div></div>{onBack&&<Btn secondary onClick={onBack}>رجوع</Btn>}</div>
      {pending&&<div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:14,padding:16,color:"#92400E",marginBottom:13}}><b>⏳ طلبك قيد المراجعة</b></div>}
      {rejected&&<div style={{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:14,padding:16,color:"#991B1B",marginBottom:13}}><b>تم رفض الطلب</b>{request?.rejectionReason&&<div style={{fontSize:12,marginTop:4}}>السبب: {request.rejectionReason}</div>}</div>}
      <BusinessForm value={businessForm} onChange={setBusinessForm} darkMode={darkMode} setLogoFile={setLogoFile} setCoverFile={setCoverFile} title="بيانات النشاط"/>
      {!pending&&<div style={{marginTop:12}}><Btn onClick={submitBusinessRequest} disabled={busy} style={{width:mobile?"100%":"auto"}}>{busy?"جاري الإرسال...":rejected?"إعادة إرسال الطلب":"إرسال طلب الإضافة"}</Btn></div>}
    </div></div>;
  }

  const orderedProducts=[...products].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const productCards=<div>{orderedProducts.length===0?<div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:35,textAlign:"center",color:c.sub}}>لسه مفيش سلع. اضغط + إضافة سلعة.</div>:orderedProducts.map(p=><OwnerProductCard key={p.id} p={p} c={c} onEdit={startEditProduct} onDelete={removeProduct} onToggleHidden={toggleHidden} onToggleAvailability={toggleAvailability} onQr={()=>setMode(`qr:${p.id}`)}/>)}</div>;

  if(mode==="business")return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:950,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:20,color:c.tc}}>تعديل بيانات الكتالوج</div><Btn secondary onClick={()=>setMode("overview")}>رجوع</Btn></div><BusinessForm value={businessForm} onChange={setBusinessForm} darkMode={darkMode} setLogoFile={setLogoFile} setCoverFile={setCoverFile}/><div style={{marginTop:12}}><Btn onClick={saveBusiness} disabled={busy} style={{width:mobile?"100%":"auto"}}>{busy?"جاري الحفظ...":"حفظ التعديلات"}</Btn></div></div></div>;

  if(mode==="product")return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"18px 12px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:760,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:21,color:c.tc}}>{editingProduct?"تعديل السلعة":"+ إضافة سلعة"}</div><div style={{fontSize:11.5,color:c.sub}}>الاسم والتصنيف فقط مطلوبين، والباقي اختياري</div></div><Btn secondary onClick={()=>setMode("overview")}>رجوع</Btn></div><ProductForm value={productForm} onChange={setProductForm} categories={categories} darkMode={darkMode} setMainFile={setMainFile} setExtraFiles={setExtraFiles}/><div style={{marginTop:12}}><Btn onClick={saveProduct} disabled={busy} style={{width:"100%",padding:"14px",fontSize:15}}>{busy?"جاري الحفظ...":editingProduct?"حفظ التعديل":"نشر السلعة"}</Btn></div></div></div>;

  if(mode==="products")return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"18px 12px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:820,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12}}><div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:21,color:c.tc}}>السلع الحالية</div><div style={{fontSize:11,color:c.sub}}>{products.length} سلعة</div></div><div style={{display:"flex",gap:7}}><Btn onClick={startNewProduct}>+ إضافة سلعة</Btn><Btn secondary onClick={()=>setMode("overview")}>رجوع</Btn></div></div>{productCards}</div></div>;

  if(mode==="qr"||mode.startsWith("qr:")){
    const productId=mode.startsWith("qr:")?mode.slice(3):"";
    const p=products.find(x=>x.id===productId);
    const url=p?productUrl(p.id):businessUrl(business.id),title=p?p.name:business.name;
    return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:620,margin:"0 auto",textAlign:"center"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:20,color:c.tc}}>QR {p?"السلعة":"الكتالوج"}</div><Btn secondary onClick={()=>setMode(p?"products":"overview")}>رجوع</Btn></div><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:18,padding:20}}><div style={{fontWeight:900,color:c.tc,fontSize:17,marginBottom:12}}>{title}</div><img src={qrImageUrl(url)} alt={`QR ${title}`} style={{width:300,maxWidth:"85vw",borderRadius:12}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}><Btn onClick={()=>downloadQr(url,title)}>تحميل QR</Btn><Btn secondary onClick={()=>shareUrl(title,url)}>مشاركة</Btn><Btn secondary onClick={()=>window.open(url,"_blank")} style={{gridColumn:"1/-1"}}>فتح الرابط</Btn></div></div></div></div>;
  }

  const actions=[
    {icon:"➕",title:"إضافة سلعة جديدة",sub:"صورة + اسم + سعر",go:startNewProduct,primary:true},
    {icon:"🧱",title:"السلع الحالية",sub:`${products.length} سلعة`,go:()=>setMode("products")},
    {icon:"✏️",title:"تعديل بيانات الكتالوج",sub:"الشعار والتواصل والعنوان",go:()=>setMode("business")},
    {icon:"▦",title:"QR الكتالوج",sub:"تحميل أو مشاركة",go:()=>setMode("qr")},
  ];

  return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"18px 12px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:900,margin:"0 auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14}}><div><div style={{color:GOLD,fontWeight:800,fontSize:11}}>كتالوج مواد التشطيب</div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:24,color:c.tc}}>إدارة الكتالوج</div></div>{onBack&&<Btn secondary onClick={onBack}>رجوع</Btn>}</div>
    <div style={{background:`linear-gradient(135deg,${NAVY_DEEP},${NAVY})`,borderRadius:18,padding:15,display:"grid",gridTemplateColumns:mobile?"64px 1fr":"70px 1fr auto",gap:12,alignItems:"center",marginBottom:13}}><div style={{width:64,height:64,borderRadius:14,overflow:"hidden",background:"#fff"}}><Img src={business.logoUrl}/></div><div><div style={{color:"white",fontFamily:"Cairo",fontWeight:900,fontSize:18}}>{business.name}</div><div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>{business.activityType} • {business.governorate}</div></div><Btn secondary onClick={()=>window.open(businessUrl(business.id),"_blank")} style={{gridColumn:mobile?"1/-1":"auto"}}>عرض الكتالوج للعميل</Btn></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9,marginBottom:15}}>{actions.map(a=><button key={a.title} type="button" onClick={a.go} style={{minHeight:112,border:`1px solid ${a.primary?GOLD:c.border}`,background:a.primary?`linear-gradient(145deg,${GOLD},${GOLD_DARK})`:c.card,color:a.primary?NAVY_DEEP:c.tc,borderRadius:16,padding:12,textAlign:"right",cursor:"pointer",fontFamily:"Cairo"}}><div style={{fontSize:25}}>{a.icon}</div><div style={{fontWeight:900,fontSize:13,marginTop:5}}>{a.title}</div><div style={{fontSize:10.5,opacity:.7,marginTop:2}}>{a.sub}</div></button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:13}}><div style={{fontSize:10.5,color:c.sub}}>السلع المنشورة</div><div style={{fontWeight:900,fontSize:23,color:c.tc}}>{products.filter(p=>(p.approvalStatus||"approved")==="approved"&&p.ownerHidden!==true).length}</div></div><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:13}}><div style={{fontSize:10.5,color:c.sub}}>قيد المراجعة</div><div style={{fontWeight:900,fontSize:23,color:c.tc}}>{products.filter(p=>p.approvalStatus==="pending").length}</div></div></div>
  </div></div>;
}

export function CatalogOwnerRequestsPanel({db,darkMode,onChanged}){
  const c=colors(darkMode),mobile=useMobile();
  const [requests,setRequests]=useState([]),[products,setProducts]=useState([]),[busy,setBusy]=useState(false),[open,setOpen]=useState(true);
  const load=async()=>{
    const [r,p]=await Promise.all([getDocs(collection(db,"catalogBusinessRequests")),getDocs(collection(db,"catalogProducts"))]);
    setRequests(r.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.status==="pending"));
    setProducts(p.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.ownerId&&x.approvalStatus==="pending"));
  };
  useEffect(()=>{load().catch(console.error)},[db]);
  const approveRequest=async r=>{if(!window.confirm(`قبول نشاط ${r.name}؟`))return;setBusy(true);try{const businessId=r.ownerId;const businessData={ownerId:r.ownerId,ownerRequestId:r.id,approvalStatus:"approved",active:true,featured:false,approvedAt:serverTimestamp(),updatedAt:serverTimestamp(),createdAt:serverTimestamp()};BUSINESS_EDITABLE_FIELDS.forEach(k=>{if(r[k]!==undefined)businessData[k]=r[k]});const batch=writeBatch(db);batch.set(doc(db,"catalogBusinesses",businessId),businessData,{merge:true});batch.update(doc(db,"catalogBusinessRequests",r.id),{status:"approved",businessId,reviewedAt:serverTimestamp(),rejectionReason:""});await batch.commit();await load();await onChanged?.();alert("تم قبول النشاط وتفعيل لوحة صاحبه ✅")}catch(e){alert(e.message)}finally{setBusy(false)}};
  const rejectRequest=async r=>{const reason=window.prompt("سبب رفض الطلب (اختياري):",r.rejectionReason||"");if(reason===null)return;setBusy(true);try{await updateDoc(doc(db,"catalogBusinessRequests",r.id),{status:"rejected",rejectionReason:reason.trim(),reviewedAt:serverTimestamp()});await load()}catch(e){alert(e.message)}finally{setBusy(false)}};
  const approveProduct=async p=>{if(!window.confirm(`اعتماد السلعة ${p.name} ونشرها؟`))return;setBusy(true);try{await updateDoc(doc(db,"catalogProducts",p.id),{approvalStatus:"approved",active:true,ownerHidden:false,rejectionReason:"",approvedAt:serverTimestamp(),updatedAt:serverTimestamp()});await load();await onChanged?.()}catch(e){alert(e.message)}finally{setBusy(false)}};
  const rejectProduct=async p=>{const reason=window.prompt("سبب رفض السلعة (اختياري):",p.rejectionReason||"");if(reason===null)return;setBusy(true);try{await updateDoc(doc(db,"catalogProducts",p.id),{approvalStatus:"rejected",active:false,rejectionReason:reason.trim(),reviewedAt:serverTimestamp(),updatedAt:serverTimestamp()});await load();await onChanged?.()}catch(e){alert(e.message)}finally{setBusy(false)}};
  const count=requests.length+products.length;
  return <div style={{background:c.card,border:`1px solid ${count?GOLD:c.border}`,borderRadius:14,padding:12,marginBottom:13,direction:"rtl"}}>
    <div onClick={()=>setOpen(x=>!x)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,cursor:"pointer"}}><div><div style={{fontFamily:"Cairo",fontWeight:900,color:c.tc,fontSize:15}}>🕓 طلبات الكتالوجات والسلع</div><div style={{fontSize:11,color:c.sub}}>{count?`${count} طلب يحتاج مراجعة`:"لا توجد طلبات معلقة"}</div></div><span style={{color:GOLD}}>{open?"▲":"▼"}</span></div>
    {open&&<div style={{marginTop:11}}>
      {requests.map(r=><div key={r.id} style={{borderTop:`1px solid ${c.border}`,padding:"10px 0",display:"grid",gridTemplateColumns:mobile?"1fr":"1fr auto",gap:8}}><div><b style={{color:c.tc}}>{r.name}</b><div style={{fontSize:10.5,color:c.sub}}>{r.activityType} • {r.governorate} • {r.phones}</div></div><div style={{display:"flex",gap:6}}><Btn onClick={()=>approveRequest(r)} disabled={busy}>قبول</Btn><Btn danger onClick={()=>rejectRequest(r)} disabled={busy}>رفض</Btn></div></div>)}
      {products.map(p=><div key={p.id} style={{borderTop:`1px solid ${c.border}`,padding:"10px 0",display:"grid",gridTemplateColumns:mobile?"1fr":"52px 1fr auto",gap:8,alignItems:"center"}}><div style={{width:52,height:52,borderRadius:9,overflow:"hidden"}}><Img src={p.mainImage}/></div><div><b style={{color:c.tc}}>{p.name}</b><div style={{fontSize:10.5,color:c.sub}}>{p.price?`${Number(p.price).toLocaleString("ar-EG")} ج`:"بدون سعر"}</div></div><div style={{display:"flex",gap:6}}><Btn onClick={()=>approveProduct(p)} disabled={busy}>اعتماد ونشر</Btn><Btn danger onClick={()=>rejectProduct(p)} disabled={busy}>رفض</Btn></div></div>)}
      {count===0&&<div style={{padding:12,textAlign:"center",color:c.sub,fontSize:12}}>كل الطلبات تمت مراجعتها ✅</div>}
    </div>}
  </div>;
}
