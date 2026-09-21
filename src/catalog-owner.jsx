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
  return <button type="button" disabled={disabled} onClick={onClick} style={{border,borderRadius:10,padding:"9px 13px",background:bg,color,fontFamily:"Cairo,Tajawal,sans-serif",fontWeight:800,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1,...style}}>{children}</button>;
}

function Field({label,value,onChange,type="text",textarea=false,options=null,placeholder="",darkMode=false}){
  const c=colors(darkMode);
  const style={width:"100%",boxSizing:"border-box",marginTop:5,padding:"10px 11px",borderRadius:9,border:`1px solid ${c.border}`,background:c.input,color:c.tc,fontFamily:"Cairo",fontSize:12.5,outline:"none"};
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
const qrUrl=id=>`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=${encodeURIComponent(businessUrl(id))}`;

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
  if(status==="approved")return {label:"مقبول",color:"#16A34A",bg:"#F0FDF4"};
  if(status==="rejected")return {label:"مرفوض",color:"#DC2626",bg:"#FEF2F2"};
  return {label:"قيد المراجعة",color:"#B7791F",bg:"#FFFBEB"};
}

function StatusBadge({status}){
  const s=statusMeta(status);
  return <span style={{display:"inline-flex",padding:"4px 9px",borderRadius:20,background:s.bg,color:s.color,fontSize:10.5,fontWeight:900}}>{s.label}</span>;
}

function BusinessForm({value,onChange,darkMode,logoFile,setLogoFile,coverFile,setCoverFile,title="بيانات النشاط"}){
  const mobile=useMobile(),c=colors(darkMode);
  return <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:15,padding:14}}>
    <div style={{fontFamily:"Cairo",fontWeight:900,color:c.tc,fontSize:16,marginBottom:12}}>{title}</div>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,minmax(0,1fr))",gap:9}}>
      <Field darkMode={darkMode} label="اسم الشركة / المحل / المصنع" value={value.name} onChange={v=>onChange(x=>({...x,name:v}))}/>
      <Field darkMode={darkMode} label="نوع النشاط" value={value.activityType} onChange={v=>onChange(x=>({...x,activityType:v}))} options={["محل","مصنع","توكيل","موزع","مورد","شركة"]}/>
      <Field darkMode={darkMode} label="المحافظة" value={value.governorate} onChange={v=>onChange(x=>({...x,governorate:v}))}/>
      <Field darkMode={darkMode} label="المنطقة" value={value.area} onChange={v=>onChange(x=>({...x,area:v}))}/>
      <Field darkMode={darkMode} label="العنوان" value={value.address} onChange={v=>onChange(x=>({...x,address:v}))}/>
      <Field darkMode={darkMode} label="أرقام التواصل" value={value.phones} onChange={v=>onChange(x=>({...x,phones:v}))} placeholder="افصل بين الأرقام بفاصلة"/>
      <Field darkMode={darkMode} label="واتساب" value={value.whatsapp} onChange={v=>onChange(x=>({...x,whatsapp:v}))}/>
      <Field darkMode={darkMode} label="رابط الخريطة" value={value.mapUrl} onChange={v=>onChange(x=>({...x,mapUrl:v}))}/>
      <Field darkMode={darkMode} label="الموقع الإلكتروني" value={value.website} onChange={v=>onChange(x=>({...x,website:v}))}/>
      <Field darkMode={darkMode} label="فيسبوك" value={value.facebook} onChange={v=>onChange(x=>({...x,facebook:v}))}/>
      <Field darkMode={darkMode} label="إنستجرام" value={value.instagram} onChange={v=>onChange(x=>({...x,instagram:v}))}/>
      <Field darkMode={darkMode} label="الفروع" value={value.branches} onChange={v=>onChange(x=>({...x,branches:v}))} textarea placeholder="كل فرع في سطر"/>
      <Field darkMode={darkMode} label="نبذة" value={value.description} onChange={v=>onChange(x=>({...x,description:v}))} textarea/>
      <Field darkMode={darkMode} label="العروض الحالية" value={value.offers} onChange={v=>onChange(x=>({...x,offers:v}))} textarea/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:9,marginTop:9}}>
      <label style={{fontSize:11.5,fontWeight:800,color:c.sub}}>اللوجو<input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0]||null)} style={{width:"100%",marginTop:5,color:c.tc}}/></label>
      <label style={{fontSize:11.5,fontWeight:800,color:c.sub}}>صورة الغلاف<input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files?.[0]||null)} style={{width:"100%",marginTop:5,color:c.tc}}/></label>
    </div>
    {(value.logoUrl||value.coverUrl)&&<div style={{display:"flex",gap:9,marginTop:10}}>{value.logoUrl&&<div style={{width:58,height:58,borderRadius:10,overflow:"hidden"}}><Img src={value.logoUrl}/></div>}{value.coverUrl&&<div style={{width:110,height:58,borderRadius:10,overflow:"hidden"}}><Img src={value.coverUrl}/></div>}</div>}
  </div>;
}

function ProductForm({value,onChange,categories,darkMode,mainFile,setMainFile,extraFiles,setExtraFiles}){
  const mobile=useMobile(),c=colors(darkMode);
  return <div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:15,padding:14}}>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,minmax(0,1fr))",gap:9}}>
      <Field darkMode={darkMode} label="اسم المنتج" value={value.name} onChange={v=>onChange(x=>({...x,name:v}))}/>
      <Field darkMode={darkMode} label="كود المنتج" value={value.code} onChange={v=>onChange(x=>({...x,code:v}))}/>
      <Field darkMode={darkMode} label="التصنيف" value={value.categoryId} onChange={v=>onChange(x=>({...x,categoryId:v}))} options={categories.map(x=>({value:x.id,label:x.name}))}/>
      <Field darkMode={darkMode} label="القسم الفرعي / نوع المنتج" value={value.subCategory} onChange={v=>onChange(x=>({...x,subCategory:v}))} placeholder="مثال: أرضيات"/>
      <Field darkMode={darkMode} label="المقاس" value={value.size} onChange={v=>onChange(x=>({...x,size:v}))}/>
      <Field darkMode={darkMode} label="اللون" value={value.color} onChange={v=>onChange(x=>({...x,color:v}))}/>
      <Field darkMode={darkMode} label="الخامة" value={value.material} onChange={v=>onChange(x=>({...x,material:v}))}/>
      <Field darkMode={darkMode} label="السعر" type="number" value={value.price} onChange={v=>onChange(x=>({...x,price:v}))}/>
      <Field darkMode={darkMode} label="حالة التوفر" value={value.availability} onChange={v=>onChange(x=>({...x,availability:v}))} options={["متوفر","كمية محدودة","حسب الطلب","غير متوفر"]}/>
      <Field darkMode={darkMode} label="الخصم / العرض" value={value.discount} onChange={v=>onChange(x=>({...x,discount:v}))} placeholder="مثال: خصم 10%"/>
      <Field darkMode={darkMode} label="المواصفات" value={value.specs} onChange={v=>onChange(x=>({...x,specs:v}))} textarea/>
      <Field darkMode={darkMode} label="وصف مختصر" value={value.description} onChange={v=>onChange(x=>({...x,description:v}))} textarea/>
    </div>
    <div style={{display:"flex",gap:12,alignItems:"center",marginTop:9,flexWrap:"wrap"}}><label style={{fontSize:12,color:c.tc}}><input type="checkbox" checked={value.showPrice!==false} onChange={e=>onChange(x=>({...x,showPrice:e.target.checked}))}/> إظهار السعر</label></div>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:9,marginTop:9}}>
      <label style={{fontSize:11.5,fontWeight:800,color:c.sub}}>الصورة الرئيسية<input type="file" accept="image/*" onChange={e=>setMainFile(e.target.files?.[0]||null)} style={{width:"100%",marginTop:5,color:c.tc}}/></label>
      <label style={{fontSize:11.5,fontWeight:800,color:c.sub}}>صور إضافية<input type="file" accept="image/*" multiple onChange={e=>setExtraFiles([...e.target.files])} style={{width:"100%",marginTop:5,color:c.tc}}/></label>
    </div>
    {(mainFile||extraFiles.length>0)&&<div style={{fontSize:10.5,color:c.sub,marginTop:6}}>تم اختيار {mainFile?1:0}{extraFiles.length?` + ${extraFiles.length} صور إضافية`:""}</div>}
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
      if(request){await updateDoc(doc(db,"catalogBusinessRequests",uid),data)}
      else await setDoc(doc(db,"catalogBusinessRequests",uid),{...data,createdAt:serverTimestamp()});
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
      setLogoFile(null);setCoverFile(null);alert("تم تحديث بيانات النشاط ✅");await load();setMode("overview");
    }catch(e){alert(e.message||"تعذر حفظ البيانات")}finally{setBusy(false)}
  };

  const startNewProduct=()=>{setEditingProduct(null);setProductForm({...emptyProductForm});setMainFile(null);setExtraFiles([]);setMode("product")};
  const startEditProduct=p=>{setEditingProduct(p);setProductForm({...emptyProductForm,...p,images:p.images||[]});setMainFile(null);setExtraFiles([]);setMode("product")};
  const saveProduct=async()=>{
    if(!business)return alert("لا يوجد نشاط معتمد");
    if(!productForm.name.trim()||!productForm.categoryId)return alert("اسم المنتج والتصنيف مطلوبين");
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
        if(editingProduct.approvalStatus==="rejected"){data.approvalStatus="pending";data.active=false;data.rejectionReason=""}
        await updateDoc(doc(db,"catalogProducts",id),data);
        alert(editingProduct.approvalStatus==="rejected"?"تم تعديل المنتج وإرساله للمراجعة من جديد ✅":"تم تعديل المنتج ✅");
      }else{
        await setDoc(doc(db,"catalogProducts",id),{...data,approvalStatus:"pending",active:false,featured:false,createdAt:serverTimestamp()});
        alert("تم إرسال المنتج للإدارة للمراجعة ✅");
      }
      setEditingProduct(null);setProductForm({...emptyProductForm});setMainFile(null);setExtraFiles([]);await load();setMode("overview");
    }catch(e){alert(e.message||"تعذر حفظ المنتج")}finally{setBusy(false)}
  };

  const removeProduct=async p=>{
    if(!window.confirm(`حذف المنتج ${p.name}؟`))return;
    try{await deleteDoc(doc(db,"catalogProducts",p.id));await load()}catch(e){alert(e.message)}
  };

  if(!user)return <div style={{minHeight:"70vh",background:c.bg,padding:25,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:18,padding:25,maxWidth:430,textAlign:"center"}}><div style={{fontSize:42}}>🏪</div><div style={{fontFamily:"Cairo",fontWeight:900,color:c.tc,fontSize:19,marginTop:8}}>أضف نشاطك إلى الكتالوج</div><div style={{color:c.sub,fontSize:12.5,margin:"8px 0 16px"}}>سجّل دخولك أولًا لتقديم طلب إضافة محل أو مصنع أو توكيل.</div><Btn onClick={onRequireAuth}>تسجيل الدخول</Btn>{onBack&&<Btn secondary onClick={onBack} style={{marginRight:8}}>رجوع</Btn>}</div></div>;
  if(loading)return <div style={{minHeight:"70vh",background:c.bg,padding:60,textAlign:"center",color:c.sub}}>جاري تحميل لوحة نشاطك...</div>;

  if(!business){
    const pending=request?.status==="pending",rejected=request?.status==="rejected";
    return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:14}}><div><div style={{fontFamily:"Cairo",fontSize:22,fontWeight:900,color:c.tc}}>إضافة نشاطك للكتالوج</div><div style={{fontSize:12,color:c.sub}}>الطلب يراجع من الإدارة قبل ظهور النشاط للزوار</div></div>{onBack&&<Btn secondary onClick={onBack}>رجوع</Btn>}</div>
      {pending&&<div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:14,padding:16,color:"#92400E",marginBottom:13}}><div style={{fontWeight:900}}>⏳ طلبك قيد المراجعة</div><div style={{fontSize:12,marginTop:4}}>هنفعّل صفحة نشاطك ولوحة المنتجات بعد موافقة الإدارة.</div></div>}
      {rejected&&<div style={{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:14,padding:16,color:"#991B1B",marginBottom:13}}><div style={{fontWeight:900}}>تم رفض الطلب</div>{request?.rejectionReason&&<div style={{fontSize:12,marginTop:4}}>السبب: {request.rejectionReason}</div>}<div style={{fontSize:12,marginTop:4}}>يمكنك تعديل البيانات وإعادة الإرسال.</div></div>}
      <BusinessForm value={businessForm} onChange={setBusinessForm} darkMode={darkMode} logoFile={logoFile} setLogoFile={setLogoFile} coverFile={coverFile} setCoverFile={setCoverFile} title={pending?"بيانات الطلب":"بيانات النشاط"}/>
      {!pending&&<div style={{marginTop:12}}><Btn onClick={submitBusinessRequest} disabled={busy}>{busy?"جاري الإرسال...":rejected?"إعادة إرسال الطلب":"إرسال طلب الإضافة"}</Btn></div>}
    </div></div>;
  }

  const orderedProducts=[...products].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  if(mode==="business")return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:950,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:20,color:c.tc}}>تعديل بيانات نشاطي</div><Btn secondary onClick={()=>setMode("overview")}>رجوع</Btn></div><BusinessForm value={businessForm} onChange={setBusinessForm} darkMode={darkMode} logoFile={logoFile} setLogoFile={setLogoFile} coverFile={coverFile} setCoverFile={setCoverFile}/><div style={{marginTop:12}}><Btn onClick={saveBusiness} disabled={busy}>{busy?"جاري الحفظ...":"حفظ التعديلات"}</Btn></div></div></div>;

  if(mode==="product")return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:950,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:20,color:c.tc}}>{editingProduct?"تعديل المنتج":"إضافة منتج جديد"}</div><div style={{fontSize:11.5,color:c.sub}}>{editingProduct?.approvalStatus==="approved"?"تعديلات المنتج المعتمد تُحفظ مباشرة":"المنتج الجديد لن يظهر للزوار قبل موافقة الإدارة"}</div></div><Btn secondary onClick={()=>setMode("overview")}>رجوع</Btn></div><ProductForm value={productForm} onChange={setProductForm} categories={categories} darkMode={darkMode} mainFile={mainFile} setMainFile={setMainFile} extraFiles={extraFiles} setExtraFiles={setExtraFiles}/><div style={{marginTop:12}}><Btn onClick={saveProduct} disabled={busy}>{busy?"جاري الحفظ...":editingProduct?"حفظ المنتج":"إرسال المنتج للمراجعة"}</Btn></div></div></div>;

  return <div style={{minHeight:"100vh",background:c.bg,padding:mobile?"22px 14px 100px":"34px 28px 70px",direction:"rtl"}}><div style={{maxWidth:1000,margin:"0 auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:15}}><div><div style={{color:GOLD,fontWeight:800,fontSize:11}}>كتالوج مواد التشطيب</div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:23,color:c.tc}}>لوحة متجري</div></div>{onBack&&<Btn secondary onClick={onBack}>رجوع للكتالوج</Btn>}</div>
    <div style={{background:`linear-gradient(135deg,${NAVY_DEEP},${NAVY})`,borderRadius:18,padding:16,display:"grid",gridTemplateColumns:mobile?"1fr":"auto 1fr auto",gap:14,alignItems:"center",marginBottom:14}}>
      <div style={{width:70,height:70,borderRadius:14,overflow:"hidden",background:"#fff"}}><Img src={business.logoUrl}/></div>
      <div><div style={{color:"white",fontFamily:"Cairo",fontWeight:900,fontSize:18}}>{business.name}</div><div style={{color:"rgba(255,255,255,.6)",fontSize:11.5}}>{business.activityType} • {business.governorate}{business.area?` • ${business.area}`:""}</div><div style={{marginTop:6}}><StatusBadge status="approved"/></div></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Btn secondary onClick={()=>setMode("business")}>تعديل بياناتي</Btn><Btn secondary onClick={()=>window.open(businessUrl(business.id),"_blank")}>عرض الصفحة</Btn><Btn secondary onClick={()=>window.open(qrUrl(business.id),"_blank")}>QR</Btn></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:10,marginBottom:14}}><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:14}}><div style={{fontSize:11,color:c.sub}}>إجمالي المنتجات</div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:25,color:c.tc}}>{products.length}</div></div><div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:14}}><div style={{fontSize:11,color:c.sub}}>قيد المراجعة</div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:25,color:c.tc}}>{products.filter(p=>(p.approvalStatus||"approved")==="pending").length}</div></div></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}><div><div style={{fontFamily:"Cairo",fontWeight:900,fontSize:17,color:c.tc}}>منتجاتي</div><div style={{fontSize:11,color:c.sub}}>أي منتج جديد يراجع من الإدارة قبل النشر</div></div><Btn onClick={startNewProduct}>+ إضافة منتج</Btn></div>
    {orderedProducts.length===0?<div style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:14,padding:35,textAlign:"center",color:c.sub}}>لم تضف منتجات بعد</div>:orderedProducts.map(p=>{const st=p.approvalStatus||"approved";return <div key={p.id} style={{background:c.card,border:`1px solid ${c.border}`,borderRadius:13,padding:10,display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}><div style={{width:52,height:52,borderRadius:9,overflow:"hidden"}}><Img src={p.mainImage}/></div><div style={{flex:1,minWidth:150}}><div style={{fontWeight:900,color:c.tc}}>{p.name}</div><div style={{fontSize:10.5,color:c.sub}}>{p.code||"بدون كود"} {p.subCategory?`• ${p.subCategory}`:""}</div>{p.rejectionReason&&st==="rejected"&&<div style={{fontSize:10.5,color:"#DC2626",marginTop:2}}>سبب الرفض: {p.rejectionReason}</div>}</div><StatusBadge status={st}/><Btn secondary onClick={()=>startEditProduct(p)}>تعديل</Btn><Btn danger onClick={()=>removeProduct(p)}>حذف</Btn></div>})}
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
  const approveRequest=async r=>{
    if(!window.confirm(`قبول نشاط ${r.name}؟`))return;setBusy(true);
    try{
      const businessId=r.ownerId;
      const businessData={ownerId:r.ownerId,ownerRequestId:r.id,approvalStatus:"approved",active:true,featured:false,approvedAt:serverTimestamp(),updatedAt:serverTimestamp(),createdAt:serverTimestamp()};
      BUSINESS_EDITABLE_FIELDS.forEach(k=>{if(r[k]!==undefined)businessData[k]=r[k]});
      const batch=writeBatch(db);
      batch.set(doc(db,"catalogBusinesses",businessId),businessData,{merge:true});
      batch.update(doc(db,"catalogBusinessRequests",r.id),{status:"approved",businessId,reviewedAt:serverTimestamp(),rejectionReason:""});
      await batch.commit();await load();await onChanged?.();alert("تم قبول النشاط وتفعيل لوحة صاحبه ✅");
    }catch(e){alert(e.message)}finally{setBusy(false)}
  };
  const rejectRequest=async r=>{
    const reason=window.prompt("سبب رفض الطلب (اختياري):",r.rejectionReason||"");if(reason===null)return;setBusy(true);
    try{await updateDoc(doc(db,"catalogBusinessRequests",r.id),{status:"rejected",rejectionReason:reason.trim(),reviewedAt:serverTimestamp()});await load();alert("تم رفض الطلب") }catch(e){alert(e.message)}finally{setBusy(false)}
  };
  const approveProduct=async p=>{if(!window.confirm(`اعتماد المنتج ${p.name} ونشره؟`))return;setBusy(true);try{await updateDoc(doc(db,"catalogProducts",p.id),{approvalStatus:"approved",active:true,rejectionReason:"",approvedAt:serverTimestamp(),updatedAt:serverTimestamp()});await load();await onChanged?.();}catch(e){alert(e.message)}finally{setBusy(false)}};
  const rejectProduct=async p=>{const reason=window.prompt("سبب رفض المنتج (اختياري):",p.rejectionReason||"");if(reason===null)return;setBusy(true);try{await updateDoc(doc(db,"catalogProducts",p.id),{approvalStatus:"rejected",active:false,rejectionReason:reason.trim(),reviewedAt:serverTimestamp(),updatedAt:serverTimestamp()});await load();await onChanged?.();}catch(e){alert(e.message)}finally{setBusy(false)}};
  const count=requests.length+products.length;
  return <div style={{background:c.card,border:`1px solid ${count?GOLD:c.border}`,borderRadius:14,padding:12,marginBottom:13,direction:"rtl"}}>
    <div onClick={()=>setOpen(x=>!x)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,cursor:"pointer"}}><div><div style={{fontFamily:"Cairo",fontWeight:900,color:c.tc,fontSize:15}}>🕓 طلبات أصحاب الأنشطة والمنتجات</div><div style={{fontSize:11,color:c.sub}}>{count?`${count} طلب يحتاج مراجعة`:"لا توجد طلبات معلقة"}</div></div><div style={{display:"flex",alignItems:"center",gap:7}}>{count>0&&<span style={{background:"#EF4444",color:"white",fontWeight:900,borderRadius:20,padding:"3px 8px",fontSize:10}}>{count}</span>}<span style={{color:GOLD}}>{open?"▲":"▼"}</span></div></div>
    {open&&<div style={{marginTop:11}}>
      {requests.length>0&&<><div style={{fontWeight:900,color:c.tc,fontSize:12.5,marginBottom:7}}>طلبات إضافة نشاط</div>{requests.map(r=><div key={r.id} style={{borderTop:`1px solid ${c.border}`,padding:"10px 0",display:"grid",gridTemplateColumns:mobile?"1fr":"1fr auto",gap:8,alignItems:"center"}}><div><div style={{fontWeight:900,color:c.tc}}>{r.name}</div><div style={{fontSize:10.5,color:c.sub}}>{r.activityType} • {r.governorate}{r.area?` • ${r.area}`:""} • {r.phones}</div><div style={{fontSize:10.5,color:c.sub,marginTop:2}}>صاحب الطلب: {r.ownerName||r.ownerId}</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>approveRequest(r)} disabled={busy}>قبول</Btn><Btn danger onClick={()=>rejectRequest(r)} disabled={busy}>رفض</Btn></div></div>)}</>}
      {products.length>0&&<><div style={{fontWeight:900,color:c.tc,fontSize:12.5,margin:"12px 0 7px"}}>منتجات جديدة للمراجعة</div>{products.map(p=><div key={p.id} style={{borderTop:`1px solid ${c.border}`,padding:"10px 0",display:"grid",gridTemplateColumns:mobile?"1fr":"auto 1fr auto",gap:9,alignItems:"center"}}><div style={{width:50,height:50,borderRadius:9,overflow:"hidden"}}><Img src={p.mainImage}/></div><div><div style={{fontWeight:900,color:c.tc}}>{p.name}</div><div style={{fontSize:10.5,color:c.sub}}>{p.code||"بدون كود"} • {p.subCategory||p.size||p.color||"منتج جديد"}</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>approveProduct(p)} disabled={busy}>اعتماد ونشر</Btn><Btn danger onClick={()=>rejectProduct(p)} disabled={busy}>رفض</Btn></div></div>)}</>}
      {count===0&&<div style={{padding:12,textAlign:"center",color:c.sub,fontSize:12}}>كل الطلبات تمت مراجعتها ✅</div>}
      <div style={{marginTop:8}}><Btn secondary onClick={()=>load()} disabled={busy}>تحديث القائمة</Btn></div>
    </div>}
  </div>;
}
