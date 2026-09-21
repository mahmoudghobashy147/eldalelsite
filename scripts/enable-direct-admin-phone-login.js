const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let source = fs.readFileSync(appPath, 'utf8');

const start = source.indexOf('  const doLogin = async () => {');
if (start < 0) throw new Error('Direct admin login patch: doLogin not found');

const genericValidation = source.indexOf('    if(!form.phone||!form.pin) return setError("أدخل رقم الموبايل والرقم السري");', start);
if (genericValidation < 0) throw new Error('Direct admin login patch: generic login validation not found');

const directAdminPrefix = `  const doLogin = async () => {\n    const normalizeLoginPhone = (value) => {\n      let digits = String(value ?? "")\n        .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))\n        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))\n        .replace(/\\D/g, "");\n      if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);\n      return digits;\n    };\n    const cleanPhone = normalizeLoginPhone(form.phone);\n    const cleanAdminPhone = normalizeLoginPhone(cfg.adminPhone);\n\n    // دخول الأدمن مباشر على حساب Firebase Auth الحقيقي باستخدام رقم الموبايل والـ PIN.\n    // بعد نجاح Firebase بنراجع isAdmin على نفس UID قبل فتح لوحة الإدارة.\n    if (cleanPhone && cleanPhone === cleanAdminPhone) {\n      if (!form.pin) return setError("أدخل الرقم السري للإدارة");\n      setLoading(true); setError("");\n      try {\n        const adminEmail = phoneToEmail(cleanAdminPhone);\n        const cred = await DB.signIn(adminEmail, form.pin);\n        const adminMemberSnap = await getDoc(doc(db, "members", cred.user.uid));\n        if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) {\n          await DB.signOut();\n          throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة");\n        }\n        const adminUser = {\n          uid: cred.user.uid,\n          email: cred.user.email,\n          phone: cleanAdminPhone,\n          displayName: "الأدمن",\n          isAdmin: true,\n        };\n        localStorage.setItem("daleel_user", JSON.stringify(adminUser));\n        setLoading(false);\n        onLogin(adminUser);\n        return;\n      } catch (e) {\n        setLoading(false);\n        const code = String(e?.code || "");\n        if (code.includes("network-request-failed")) setError("تعذر الاتصال بـ Firebase — تأكد من الإنترنت وحاول مرة أخرى");\n        else if (code.includes("too-many-requests")) setError("محاولات دخول كثيرة. حاول لاحقاً");\n        else setError("رقم الموبايل أو الرقم السري غير صحيح");\n        return;\n      }\n    }\n\n`;

const currentPrefix = source.slice(start, genericValidation);
if (!currentPrefix.includes('دخول الأدمن مباشر على حساب Firebase Auth الحقيقي')) {
  source = source.slice(0, start) + directAdminPrefix + source.slice(genericValidation);
  fs.writeFileSync(appPath, source, 'utf8');
  console.log('✅ Direct admin phone/PIN login enabled');
} else {
  console.log('✓ Direct admin phone/PIN login already enabled');
}
