const fs=require('fs');function edit(path,changes){let s=fs.readFileSync(path,'utf8');for(let [a,b] of changes){if(b&&s.includes(b))continue;if(s.split(a).length!==2)throw Error(path+' anchor missing: '+a.slice(0,80));s=s.replace(a,b)}fs.writeFileSync(path,s)}
edit('src/App.jsx',[
['{ name:form.name, phone:registrationPhone, phoneNormalized:registrationPhone, type:accountKind==="customer"?"customer":"starter", accountKind, plan:"starter" }','{ name:form.name, phone:registrationPhone, phoneNormalized:registrationPhone, type:accountKind==="customer"?"customer":"starter", accountKind, plan:"starter", ...(accountKind==="customer"?{}:{status:"pending"}) }'],
[`  const doChoosePlan = async () => {
    try {
      await updateDoc(doc(db,"members",createdUser.uid), { plan: form.plan });
    } catch {}
    // All plans need admin approval
    localStorage.setItem("daleel_user", JSON.stringify(createdUser));
    setRegStep(5); // waiting screen
  };`,`  const doChoosePlan = async () => {
    if (!createdUser?.uid) return setError("سجّل دخولك لإكمال الاشتراك");
    setLoading(true); setError("");
    try {
      await updateDoc(doc(db,"members",createdUser.uid), { plan: form.plan });
      localStorage.setItem("daleel_user", JSON.stringify(createdUser));
      setRegStep(getPlanPrice(form.plan,cfg)>0 ? 4 : 5);
    } catch (e) { setError("تعذر حفظ الباقة. حاول مرة أخرى."); }
    finally { setLoading(false); }
  };`],
['{key==="starter"&&<span style={{fontSize:10,color:C.success,fontWeight:700}}>مجاني</span>}','{getPlanPrice(key,cfg)===0&&<span style={{fontSize:10,color:C.success,fontWeight:700}}>مجاني</span>}'],
['onClick={doChoosePlan}>{form.plan==="starter"?"تفعيل":"التالي للدفع ←"}','onClick={doChoosePlan} disabled={loading}>{loading?<Spinner size={15} color={C.navyDeep}/>:getPlanPrice(form.plan,cfg)===0?"تفعيل":"التالي للدفع ←"}'],
['  const canPost = memberInfo?.accountKind !== "customer" && remainingPosts > 0;','  const canPost = (memberInfo?.isAdmin===true || memberInfo?.status==="approved") && memberInfo?.accountKind !== "customer" && remainingPosts > 0;'],
['{memberInfo?.accountKind === "customer" ? "حساب العميل مخصص لطلب صنايعي" : postLimit === 0 ? "ميزة النشر غير متاحة في باقتك الحالية" : "وصلت للحد الأقصى من المنشورات لهذا الشهر"}','{memberInfo?.accountKind === "customer" ? "حساب العميل مخصص لطلب صنايعي" : memberInfo?.status!=="approved" && !memberInfo?.isAdmin ? "حسابك لم يُفعّل بعد" : postLimit === 0 ? "ميزة النشر غير متاحة في باقتك الحالية" : "وصلت للحد الأقصى من المنشورات لهذا الشهر"}'],
['{memberInfo?.accountKind === "customer" ? "تقدر تستخدم زر اطلب صنايعي لإرسال طلبك." : postLimit === 0 ? "قم بترقية اشتراكك لتتمكن من نشر منشوراتك وأعمالك." : `باقتك (${PLANS[memberType]?.label || memberType}) تسمح بـ ${postLimit} منشور شهريًا. حد النشر بيتجدد أول كل شهر، أو قم بالترقية لنشر المزيد.`}','{memberInfo?.accountKind === "customer" ? "تقدر تستخدم زر اطلب صنايعي لإرسال طلبك." : memberInfo?.status!=="approved" && !memberInfo?.isAdmin ? "أكمل الاشتراك وتواصل مع الإدارة لتأكيد الدفع وتفعيل حسابك." : postLimit === 0 ? "قم بترقية اشتراكك لتتمكن من نشر منشوراتك وأعمالك." : `باقتك (${PLANS[memberType]?.label || memberType}) تسمح بـ ${postLimit} منشور شهريًا. حد النشر بيتجدد أول كل شهر، أو قم بالترقية لنشر المزيد.`}'],
['        <section className="release-account-progress"','        {profile.status!=="approved"&&!profile.isAdmin&&<div role="status" style={{background:"#fff5d8",color:"#5e4710",padding:16,borderRadius:14,marginBottom:12,lineHeight:1.8}}><strong>⏳ حسابك غير مفعّل بعد</strong><div>أكمل بياناتك وسداد الاشتراك، ثم تواصل مع الإدارة لتأكيد الدفع وتفعيل حسابك.</div><button type="button" className="btn btn-primary" onClick={onShowPayment}>إكمال الاشتراك والدفع</button></div>}\n        <section className="release-account-progress"']]);
edit('firestore.rules',[
["          && (resource.data.get('accountKind', '') != 'customer' || !request.resource.data.diff(resource.data).affectedKeys().hasAny(['workPhotos'])))","          && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['workPhotos']) || (resource.data.get('accountKind', '') != 'customer' && resource.data.get('status', '') == 'approved')))"],
["        && get(memberDoc(request.auth.uid)).data.get('accountKind', '') != 'customer';","        && get(memberDoc(request.auth.uid)).data.get('accountKind', '') != 'customer'\n        && (isAdmin() || get(memberDoc(request.auth.uid)).data.get('status', '') == 'approved');"]]);
edit('storage.rules',[
["        && firestore.get(/databases/(default)/documents/members/$(request.auth.uid)).data.get('accountKind', '') != 'customer';","        && firestore.get(/databases/(default)/documents/members/$(request.auth.uid)).data.get('accountKind', '') != 'customer'\n        && (isAdmin() || firestore.get(/databases/(default)/documents/members/$(request.auth.uid)).data.get('status', '') == 'approved');"]]);
console.log('Payment and activation protection staged.');
