const fs=require('node:fs');let s=fs.readFileSync('src/App.jsx','utf8');
if(!s.includes('// unique-member-phone-v1')){
 const once=(a,b)=>{if(s.split(a).length!==2)throw Error('Unique phone anchor: '+a.slice(0,80));s=s.replace(a,b)};
 s='// unique-member-phone-v1\n'+s;
 once('    const cred = await createUserWithEmailAndPassword(auth, email, password);',`    await httpsCallable(functions,"assertMemberPhoneAvailable")({phone:data.phone});
    let cred;
    if(auth.currentUser?.email===email && !(await getDoc(doc(db,"members",auth.currentUser.uid))).exists()){
      await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(email,password));
      cred={user:auth.currentUser};
    }else{cred=await createUserWithEmailAndPassword(auth,email,password);}`);
 once('    await setDoc(doc(db,"members",cred.user.uid), { ...data, uid:cred.user.uid, createdAt:new Date(), views:0, calls:0, waMessages:0, saves:0, rating:0, reviews:0, type:data.type||"starter" });','    await httpsCallable(functions,"completeMemberRegistration")({name:data.name,phone:data.phone,accountKind:data.accountKind});');
 once('if(e.code==="auth/email-already-in-use") setError("رقم الموبايل مسجل مسبقاً، سجّل دخولك");','if(e.code==="auth/email-already-in-use"||e.code==="functions/already-exists") setError("رقم الموبايل مسجل بالفعل. سجّل الدخول بحسابك الحالي؛ لا يمكن استخدام نفس الرقم لحساب عميل ومشترك.");');
 s=s.replaceAll('    if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);','    if (digits.startsWith("0020")) digits = digits.slice(2);\n    if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.slice(2);');
 // A login number cannot be reassigned from the profile editor. Existing legacy
 // formatting is preserved; changing the registered number needs an admin review.
 const start=s.indexOf('const RegisterScreen ='),end=s.indexOf('const MyProfileScreen =',start);if(start<0||end<0)throw Error('Profile editor missing');
 let block=s.slice(start,end);
 block=block.replace('        phone: form.phone || currentUser.phone || "",','        ...(originalPlan?{}:{phone:form.phone || currentUser.phone || ""}),');
 // form is spread into memberData, so strip phone fields before existing-profile writes.
 block=block.replace('      // تعديل الملف الشخصي لازم يحدّث بيانات الملف فقط.','      if(originalPlan){delete memberData.phone;delete memberData.phoneNormalized;}\n      // تعديل الملف الشخصي لازم يحدّث بيانات الملف فقط.');
 const phoneInput=block.match(/<input(?:(?!<input)[\s\S])*?value=\{form\[k\]\}(?:(?!<input)[\s\S])*?\/>/);
 if(!phoneInput)throw Error('Profile phone input missing');
 block=block.replace(phoneInput[0],phoneInput[0].replace('<input ','<input readOnly={k==="phone"&&!!originalPlan} title="رقم تسجيل الدخول ثابت. تواصل مع الإدارة لتغييره." '));
 s=s.slice(0,start)+block+s.slice(end);
 fs.writeFileSync('src/App.jsx',s);
}
let main=fs.readFileSync('functions/main.js','utf8');if(!main.includes('./phone-registration/callables.cjs'))main=main.replace('  ...require("./index"),','  ...require("./index"),\n  ...require("./phone-registration/callables.cjs"),');fs.writeFileSync('functions/main.js',main);
let rules=fs.readFileSync('firestore.rules','utf8');
if(!rules.includes('// unique-member-phone-rules')){
 const start=rules.indexOf('      allow create: if self(memberId)'),end=rules.indexOf('\n      allow update: if isAdmin()',start);if(start<0||end<0)throw Error('Member create rule missing');
 const previous=rules.slice(start,end);
 rules=rules.slice(0,start)+'      // unique-member-phone-rules: legacy clients use canonical Auth and the private index.\n'+previous.replace('allow create: if self(memberId)','allow create: if self(memberId) && uniqueLoginPhone(request.resource.data)')+rules.slice(end);
 const helper=fs.readFileSync('functions/phone-registration/legacy-rule.txt','utf8');
 rules=rules.replace('    function memberProtectedFieldsUnchanged() {',helper+'\n    function memberProtectedFieldsUnchanged() {');
 rules=rules.replace("        'accountKind',","        'accountKind',\n        'phone', 'phoneNormalized',");
 fs.writeFileSync('firestore.rules',rules);
}
let test=fs.readFileSync('scripts/test-firestore-rules.js','utf8');
if(!test.includes('// server-owned-unique-phone-fixtures')){
 test=test.replace('await assertSucceeds(setDoc(doc(newbie, "members", "newbie"),','await assertFails(setDoc(doc(newbie, "members", "newbie"),');
 const a='    await assertSucceeds(setDoc(doc(customer, "members", "customerTest"), {';
 const start=test.indexOf(a),end=test.indexOf('\n    await assertSucceeds(getDoc(doc(customer',start);if(start<0||end<0)throw Error('Customer test fixture missing');
 const denied=test.slice(start,end).replace('assertSucceeds','assertFails');
 const seeded=test.slice(start,end).replace('    await assertSucceeds(setDoc(doc(customer,','    await testEnv.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),').replace(/\}\)\);\s*$/, '}));');
 test=test.slice(0,start)+'    // server-owned-unique-phone-fixtures\n'+denied+'\n'+seeded+test.slice(end);
 const legacyTests=fs.readFileSync('functions/phone-registration/legacy-rule-tests.txt','utf8');
 test=test.replace('    // ── Member visibility ────────────────────────────────────────',legacyTests+'\n    // ── Member visibility ────────────────────────────────────────');
 const anchor='    // ── Owner profile edits ──────────────────────────────────────';
 test=test.replace(anchor,'    await assertFails(setDoc(doc(customer,"memberPhoneIndex","forged"),{uid:"customerTest"}));\n    await assertFails(updateDoc(doc(customer,"members","customerTest"),{phone:"01100000000",phoneNormalized:"01100000000"}));\n'+anchor);
 fs.writeFileSync('scripts/test-firestore-rules.js',test);
}
console.log('Server-owned registration, unique phone index and immutable login number staged.');
