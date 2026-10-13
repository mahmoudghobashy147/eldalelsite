const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
const fnPath = path.join(__dirname, "..", "functions", "index.js");

let app = fs.readFileSync(appPath, "utf8");
let fn = fs.readFileSync(fnPath, "utf8");
let appChanged = false;
let fnChanged = false;

// 1) Canonical Egyptian phone normalization for ALL member login/registration paths.
const oldPhoneHelper = '  const phoneToEmail = (phone) => `${phone.replace(/\\s/g,"")}@daleel.app`;';
const newPhoneHelper = `  const normalizeMemberPhone = (value) => {
    let digits = String(value ?? "")
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/\\D/g, "");
    if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);
    if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
    return digits;
  };
  const phoneToEmail = (phone) => \`\${normalizeMemberPhone(phone)}@daleel.app\`;`;
if (!app.includes("const normalizeMemberPhone = (value) =>")) {
  if (!app.includes(oldPhoneHelper)) throw new Error("Member login fix: phoneToEmail anchor not found");
  app = app.replace(oldPhoneHelper, newPhoneHelper);
  appChanged = true;
}

// 2) Generic member login: normalize the entered phone before Firebase Auth lookup.
const oldGenericLogin = `    if(!form.phone||!form.pin) return setError("أدخل رقم الموبايل والرقم السري");
    if(form.phone.length < 10) return setError("رقم الموبايل غير صحيح");
    if(form.pin.length < 4) return setError("الرقم السري 4 أرقام على الأقل");

    setLoading(true); setError("");
    try {
      const email = phoneToEmail(form.phone);
      const cred = await DB.signIn(email, form.pin);
      const u = { uid:cred.user.uid, email:cred.user.email, phone:form.phone, displayName:cred.user.displayName||form.phone };
      localStorage.setItem("daleel_user", JSON.stringify(u));
      onLogin(u);
    } catch(e) {
      if(e.code==="auth/user-not-found"||e.code==="auth/invalid-credential") setError("رقم الموبايل غير مسجل");
      else if(e.code==="auth/wrong-password") setError("الرقم السري غلط");
      else if(e.code==="auth/network-request-failed") setError("تعذر الاتصال بـ Firebase — تأكد إن الموبايل متصل بالنت فعلاً وجرّب تاني");
      else setError(\`حدث خطأ (\\${e.code||"بدون كود"}): \\${e.message||e}\`);
    }
    setLoading(false);`;

const newGenericLogin = `    if(!form.phone||!form.pin) return setError("أدخل رقم الموبايل والرقم السري");
    const canonicalPhone = normalizeMemberPhone(form.phone);
    if(canonicalPhone.length !== 11 || !canonicalPhone.startsWith("01")) return setError("رقم الموبايل غير صحيح");
    if(form.pin.length < 4) return setError("الرقم السري 4 أرقام على الأقل");

    setLoading(true); setError("");
    try {
      const email = phoneToEmail(canonicalPhone);
      const cred = await DB.signIn(email, form.pin);
      const u = { uid:cred.user.uid, email:cred.user.email, phone:canonicalPhone, displayName:cred.user.displayName||canonicalPhone };
      localStorage.setItem("daleel_user", JSON.stringify(u));
      onLogin(u);
    } catch(e) {
      if(e.code==="auth/user-not-found"||e.code==="auth/invalid-credential"||e.code==="auth/wrong-password") setError("رقم الموبايل أو الرقم السري غير صحيح");
      else if(e.code==="auth/network-request-failed") setError("تعذر الاتصال بـ Firebase — تأكد إن الموبايل متصل بالنت فعلاً وجرّب تاني");
      else setError(\`حدث خطأ (\\${e.code||"بدون كود"}): \\${e.message||e}\`);
    }
    setLoading(false);`;

if (!app.includes("const canonicalPhone = normalizeMemberPhone(form.phone);")) {
  if (!app.includes(oldGenericLogin)) throw new Error("Member login fix: generic login anchor not found");
  app = app.replace(oldGenericLogin, newGenericLogin);
  appChanged = true;
}

// 3) Registration uses the same canonical phone so new accounts can never drift.
const oldRegValidation = '    if(form.phone.length < 10) return setError("رقم الموبايل غير صحيح");';
const newRegValidation = '    const registrationPhone = normalizeMemberPhone(form.phone);\n    if(registrationPhone.length !== 11 || !registrationPhone.startsWith("01")) return setError("رقم الموبايل غير صحيح");';
if (!app.includes("const registrationPhone = normalizeMemberPhone(form.phone);")) {
  const regStart = app.indexOf("  const doCreateAccount = async () => {");
  if (regStart < 0) throw new Error("Member login fix: registration function not found");
  const pos = app.indexOf(oldRegValidation, regStart);
  if (pos < 0) throw new Error("Member login fix: registration validation anchor not found");
  app = app.slice(0, pos) + newRegValidation + app.slice(pos + oldRegValidation.length);
  appChanged = true;
}

const oldSignup = '      const email = phoneToEmail(form.phone);\n      const cred = await DB.signUp(email, form.pin, { name:form.name, phone:form.phone, type:"starter" });\n      const u = { uid:cred.user.uid, email:cred.user.email, phone:form.phone, displayName:form.name };';
const newSignup = '      const email = phoneToEmail(registrationPhone);\n      const cred = await DB.signUp(email, form.pin, { name:form.name, phone:registrationPhone, phoneNormalized:registrationPhone, type:"starter" });\n      const u = { uid:cred.user.uid, email:cred.user.email, phone:registrationPhone, displayName:form.name };';
if (!app.includes("phoneNormalized:registrationPhone")) {
  if (!app.includes(oldSignup)) throw new Error("Member login fix: signup anchor not found");
  app = app.replace(oldSignup, newSignup);
  appChanged = true;
}

const oldProfilePhone = '        name: form.name, phone: form.phone,';
const newProfilePhone = '        name: form.name, phone: normalizeMemberPhone(form.phone), phoneNormalized: normalizeMemberPhone(form.phone),';
if (!app.includes(newProfilePhone)) {
  if (!app.includes(oldProfilePhone)) throw new Error("Member login fix: profile phone anchor not found");
  app = app.replace(oldProfilePhone, newProfilePhone);
  appChanged = true;
}

// 4) Admin password reset also repairs missing/misaligned Firebase Auth accounts.
const resetStart = fn.indexOf('exports.resetMemberPassword = onCall');
const resetEndMarker = '\n// ─────────────────────────────────────────────\n// 2) ترحيل دخول الأدمن';
const resetEnd = fn.indexOf(resetEndMarker, resetStart);
if (resetStart < 0 || resetEnd < 0) throw new Error("Member login fix: resetMemberPassword block not found");

const newResetBlock = `exports.resetMemberPassword = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request.auth?.uid);

  const { memberId, newPassword } = request.data || {};
  if (!memberId || !newPassword || String(newPassword).length < 6) {
    throw new HttpsError("invalid-argument", "بيانات ناقصة أو كلمة السر أقل من 6 أرقام");
  }

  const memberRef = db.collection("members").doc(String(memberId));
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) throw new HttpsError("not-found", "العضو غير موجود");
  const member = memberSnap.data() || {};
  const phone = normalizePhone(member.phone || "");
  if (!phone || phone.length !== 11 || !phone.startsWith("01")) {
    throw new HttpsError("failed-precondition", "رقم موبايل العضو غير صالح لتسجيل الدخول");
  }

  const canonicalEmail = \`\${phone}@daleel.app\`;
  const authApi = admin.auth();

  try {
    let user = null;
    try {
      user = await authApi.getUser(String(memberId));
    } catch (e) {
      if (e?.code !== "auth/user-not-found") throw e;
    }

    if (!user) {
      // Legacy/imported member: create the missing Auth identity with the same UID.
      try {
        const byEmail = await authApi.getUserByEmail(canonicalEmail);
        if (byEmail.uid !== String(memberId)) {
          throw new HttpsError("already-exists", "رقم الموبايل مربوط بحساب دخول آخر");
        }
        user = byEmail;
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        if (e?.code !== "auth/user-not-found") throw e;
      }

      if (!user) {
        user = await authApi.createUser({
          uid: String(memberId),
          email: canonicalEmail,
          password: String(newPassword),
          displayName: String(member.name || phone),
        });
        await memberRef.set({
          uid: String(memberId),
          phoneNormalized: phone,
          authRepairedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true, repaired: true, createdAuth: true };
      }
    }

    // Existing Auth identity: canonicalize email safely, then reset password.
    if (String(user.email || "").toLowerCase() !== canonicalEmail.toLowerCase()) {
      try {
        const byEmail = await authApi.getUserByEmail(canonicalEmail);
        if (byEmail.uid !== user.uid) {
          throw new HttpsError("already-exists", "رقم الموبايل مربوط بحساب دخول آخر");
        }
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        if (e?.code !== "auth/user-not-found") throw e;
      }
    }

    await authApi.updateUser(user.uid, {
      email: canonicalEmail,
      password: String(newPassword),
      displayName: user.displayName || String(member.name || phone),
    });
    await memberRef.set({
      uid: user.uid,
      phoneNormalized: phone,
      authRepairedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, repaired: true, createdAuth: false };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", "فشل إصلاح حساب الدخول: " + (e?.message || e));
  }
});
`;

const currentResetBlock = fn.slice(resetStart, resetEnd);
if (!currentResetBlock.includes("Legacy/imported member: create the missing Auth identity")) {
  fn = fn.slice(0, resetStart) + newResetBlock + fn.slice(resetEnd);
  fnChanged = true;
}

if (appChanged) fs.writeFileSync(appPath, app, "utf8");
if (fnChanged) fs.writeFileSync(fnPath, fn, "utf8");

console.log(appChanged || fnChanged ? "✅ Member login consistency fixes applied" : "✓ Member login consistency already fixed");
