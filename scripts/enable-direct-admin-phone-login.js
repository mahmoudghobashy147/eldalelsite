const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let source = fs.readFileSync(appPath, 'utf8');
let changed = false;

// Replace only the admin branch inside doLogin. Normal member login remains untouched.
const start = source.indexOf('  const doLogin = async () => {');
if (start < 0) throw new Error('Direct admin login patch: doLogin not found');
const genericValidation = source.indexOf('    if(!form.phone||!form.pin) return setError("أدخل رقم الموبايل والرقم السري");', start);
if (genericValidation < 0) throw new Error('Direct admin login patch: generic login validation not found');

const directAdminPrefix = `  const doLogin = async () => {\n    const normalizeLoginPhone = (value) => {\n      let digits = String(value ?? "")\n        .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))\n        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))\n        .replace(/\\D/g, "");\n      if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);\n      return digits;\n    };\n    const cleanPhone = normalizeLoginPhone(form.phone);\n    const cleanAdminPhone = normalizeLoginPhone(cfg.adminPhone);\n\n    // Admin signs in directly to the existing Firebase Auth account using the phone-derived email.\n    // The UID is then verified against members/{uid}.isAdmin before granting dashboard access.\n    if (cleanPhone && cleanPhone === cleanAdminPhone) {\n      if (!form.pin) return setError("أدخل الرقم السري للإدارة");\n      setLoading(true); setError("");\n      try {\n        const adminEmail = phoneToEmail(cleanAdminPhone);\n        const cred = await DB.signIn(adminEmail, form.pin);\n        const adminMemberSnap = await getDoc(doc(db, "members", cred.user.uid));\n        if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) {\n          await DB.signOut();\n          throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة");\n        }\n        const adminUser = { uid:cred.user.uid, email:cred.user.email, phone:cleanAdminPhone, displayName:"الأدمن", isAdmin:true };\n        localStorage.setItem("daleel_user", JSON.stringify(adminUser));\n        setLoading(false);\n        onLogin(adminUser);\n        return;\n      } catch (e) {\n        setLoading(false);\n        const code = String(e?.code || "");\n        if (code.includes("network-request-failed")) setError("تعذر الاتصال بـ Firebase — تأكد من الإنترنت وحاول مرة أخرى");\n        else if (code.includes("too-many-requests")) setError("محاولات دخول كثيرة. حاول لاحقاً");\n        else setError("رقم الموبايل أو الرقم السري غير صحيح");\n        return;\n      }\n    }\n\n`;

const currentPrefix = source.slice(start, genericValidation);
if (!currentPrefix.includes('Admin signs in directly to the existing Firebase Auth account')) {
  source = source.slice(0, start) + directAdminPrefix + source.slice(genericValidation);
  changed = true;
}

// The optional admin-email alias must use the same direct Firebase Auth account too,
// rather than the Cloud Function that can be blocked by Cloud Run IAM.
const emailStart = source.indexOf('  const doAdminEmailLogin = async () => {');
if (emailStart >= 0) {
  const emailEnd = source.indexOf('\n\n  const handleLogin = async () => {', emailStart);
  if (emailEnd < 0) throw new Error('Direct admin login patch: admin email login end not found');
  const directEmail = `  const doAdminEmailLogin = async () => {\n    const enteredEmail = String(form.phone || "").trim().toLowerCase();\n    const configuredAdminEmail = String(cfg.adminEmail || "").trim().toLowerCase();\n    const authEmail = phoneToEmail(normalizeLoginIdentifierPhone(cfg.adminPhone));\n    if (enteredEmail !== configuredAdminEmail && enteredEmail !== authEmail.toLowerCase()) {\n      setError("إيميل الإدارة غير صحيح");\n      return;\n    }\n    if (!form.pin) return setError("أدخل الرقم السري للإدارة");\n    setLoading(true); setError("");\n    try {\n      const cred = await DB.signIn(authEmail, form.pin);\n      const adminMemberSnap = await getDoc(doc(db, "members", cred.user.uid));\n      if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) {\n        await DB.signOut();\n        throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة");\n      }\n      const adminUser = { uid:cred.user.uid, email:cred.user.email, phone:cfg.adminPhone||"", displayName:"الأدمن", isAdmin:true };\n      localStorage.setItem("daleel_user", JSON.stringify(adminUser));\n      onLogin(adminUser);\n    } catch (e) {\n      const code = String(e?.code || "");\n      if (code.includes("network-request-failed")) setError("تعذر الاتصال بـ Firebase — تأكد من الإنترنت وحاول مرة أخرى");\n      else setError("إيميل الإدارة أو الرقم السري غير صحيح");\n    } finally {\n      setLoading(false);\n    }\n  };`;

  // helper is scoped outside both login handlers and safely normalizes Arabic/English digits.
  const helperMarker = '  const normalizeLoginIdentifierPhone = (value) => {';
  if (!source.includes(helperMarker)) {
    const helperAnchor = '  const phoneToEmail = (phone) => `${phone.replace(/\\s/g,"")}@daleel.app`;';
    const helper = `${helperAnchor}\n  const normalizeLoginIdentifierPhone = (value) => {\n    let digits = String(value ?? "")\n      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))\n      .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))\n      .replace(/\\D/g, "");\n    if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);\n    return digits;\n  };`;
    if (!source.includes(helperAnchor)) throw new Error('Direct admin login patch: phoneToEmail helper not found');
    source = source.replace(helperAnchor, helper);
    changed = true;
  }

  const currentEmail = source.slice(emailStart, emailEnd);
  if (!currentEmail.includes('const cred = await DB.signIn(authEmail, form.pin);')) {
    source = source.slice(0, emailStart) + directEmail + source.slice(emailEnd);
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(appPath, source, 'utf8');
  console.log('✅ Direct admin phone/PIN login enabled');
} else {
  console.log('✓ Direct admin phone/PIN login already enabled');
}
