const fs=require('fs');function edit(path,changes){let s=fs.readFileSync(path,'utf8');for(const [a,b] of changes){if(b&&s.includes(b))continue;if(!b&&!s.includes(a))continue;let n=s.split(a).length-1;if(n!==1)throw Error(path+' expected 1 anchor got '+n+': '+a.slice(0,95));s=s.replace(a,b)}fs.writeFileSync(path,s)}
const owner='src/catalog-owner.jsx';let s=fs.readFileSync(owner,'utf8');let start=s.indexOf('  const submitBusinessRequest=async()=>{'),end=s.indexOf('\n  const saveBusiness=async()=>{',start);if(!s.includes('const publishBusinessDirect=async()=>{')){if(start<0||end<0)throw Error('business function missing');s=s.slice(0,start)+`  const publishBusinessDirect=async()=>{
    if(!uid)return onRequireAuth?.();
    if(!businessForm.name.trim()||!businessForm.activityType||!businessForm.governorate.trim()||!businessForm.phones.trim())return alert("اسم النشاط ونوعه والمحافظة ورقم التواصل مطلوبين");
    if(request?.status==="rejected")return alert("هذا الطلب مرفوض من الإدارة. تواصل مع الإدارة للمساعدة.");
    setBusy(true);
    try{
      let data={...Object.fromEntries(BUSINESS_EDITABLE_FIELDS.map(k=>[k,businessForm[k]??""])),name:businessForm.name.trim(),ownerId:uid,approvalStatus:"approved",active:true,featured:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      if(logoFile)data.logoUrl=await uploadOwnerImage(storage,uid,"request",logoFile);
      if(coverFile)data.coverUrl=await uploadOwnerImage(storage,uid,"request",coverFile);
      await setDoc(doc(db,"catalogBusinesses",uid),data);
      setLogoFile(null);setCoverFile(null);alert("تم نشر نشاطك في الكتالوج ✅");await load();setMode("overview");
    }catch(e){alert(e.message||"تعذر نشر النشاط")}finally{setBusy(false)}
  };
`+s.slice(end);fs.writeFileSync(owner,s)}
edit(owner,[
['بعد موافقة الإدارة هتظهر لك لوحة إدارة الكتالوج','انشر نشاطك مباشرة وابدأ إضافة منتجاتك'],
['<b>⏳ طلبك قيد المراجعة</b>','<b>يمكنك الآن نشر نشاطك مباشرة بعد مراجعة بياناته.</b>'],
['{!pending&&<div style={{marginTop:12}}><Btn onClick={submitBusinessRequest} disabled={busy} style={{width:mobile?"100%":"auto"}}>{busy?"جاري الإرسال...":rejected?"إعادة إرسال الطلب":"إرسال طلب الإضافة"}</Btn></div>}','{!rejected&&<div style={{marginTop:12}}><Btn onClick={publishBusinessDirect} disabled={busy} style={{width:mobile?"100%":"auto"}}>{busy?"جاري النشر...":"نشر النشاط"}</Btn></div>}'],
['if(editingProduct.approvalStatus==="rejected"){data.approvalStatus="pending";data.active=false;data.rejectionReason=""}','if(editingProduct.approvalStatus==="rejected")throw new Error("المنتج موقوف من الإدارة. تواصل مع الإدارة للمساعدة.");\n        if(editingProduct.approvalStatus==="pending"){data.approvalStatus="approved";data.active=true;data.rejectionReason=""}'],
['alert(editingProduct.approvalStatus==="rejected"?"تم تعديل السلعة وإرسالها للمراجعة من جديد ✅":"تم تعديل السلعة ✅");','alert("تم تعديل المنتج ✅");'],
['{...data,approvalStatus:"pending",active:false,featured:false,createdAt:serverTimestamp()}','{...data,approvalStatus:"approved",active:true,featured:false,createdAt:serverTimestamp()}'],
['تم حفظ السلعة وإرسالها للإدارة للمراجعة ✅','تم نشر المنتج في الكتالوج ✅']]);
edit('firestore.rules',[
['      // Business creation/approval stays admin-only.\n      allow create: if isAdmin();',`      // Eligible owners publish their own single catalog directly; featured and moderation remain admin controlled.
      allow create: if isAdmin() || (signedIn() && catalogEligible()
        && businessId == request.auth.uid
        && request.resource.data.get('ownerId','') == request.auth.uid
        && request.resource.data.get('approvalStatus','') == 'approved'
        && request.resource.data.get('active',false) == true
        && request.resource.data.get('featured',true) == false
        && request.resource.data.get('name','') is string && request.resource.data.name.size() > 0
        && request.resource.data.get('activityType','') is string && request.resource.data.activityType.size() > 0
        && request.resource.data.get('governorate','') is string && request.resource.data.governorate.size() > 0
        && request.resource.data.get('phones','') is string && request.resource.data.phones.size() > 0
        && request.resource.data.keys().hasOnly(['ownerId','approvalStatus','active','featured','createdAt','updatedAt',
          'name','activityType','description','governorate','area','address','branches','phones','whatsapp','mapUrl','facebook','instagram','website','logoUrl','coverUrl','offers'])
        && (!exists(/databases/$(database)/documents/catalogBusinessRequests/$(request.auth.uid))
          || get(/databases/$(database)/documents/catalogBusinessRequests/$(request.auth.uid)).data.get('status','') != 'rejected'));`],
["          && request.resource.data.approvalStatus == 'pending'\n          && request.resource.data.active == false\n          && request.resource.data.featured == false);","          && request.resource.data.approvalStatus == 'approved'\n          && request.resource.data.active == true\n          && request.resource.data.featured == false);"],
["            || (resource.data.get('approvalStatus', 'pending') == 'pending'\n              && request.resource.data.get('approvalStatus', 'pending') == 'pending'\n              && request.resource.data.get('active', false) == false)","            || (resource.data.get('approvalStatus', 'pending') == 'pending'\n              && ((request.resource.data.get('approvalStatus', 'pending') == 'pending' && request.resource.data.get('active', false) == false)\n                || (request.resource.data.get('approvalStatus', '') == 'approved' && request.resource.data.get('active', false) == true)))"]]);

edit('firestore.rules',[["        || (signedIn() && requestId == request.auth.uid && resource.data.ownerId == request.auth.uid);", "        || (signedIn() && requestId == request.auth.uid && (!exists(/databases/$(database)/documents/catalogBusinessRequests/$(requestId)) || resource.data.ownerId == request.auth.uid));"]]);
edit('firestore.rules',[["            || (resource.data.get('approvalStatus', '') == 'rejected'\n              && request.resource.data.get('approvalStatus', '') == 'pending'\n              && request.resource.data.get('active', false) == false)\n",""]]);
console.log('Direct catalog publication staged.');
