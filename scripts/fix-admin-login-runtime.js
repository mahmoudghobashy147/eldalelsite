const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
const functionsPath = path.join(__dirname, "..", "functions", "index.js");

let app = fs.readFileSync(appPath, "utf8");
let fn = fs.readFileSync(functionsPath, "utf8");
let appChanged = false;
let fnChanged = false;

const oldLoginNormalize = `    const cleanPhone = form.phone.replace(/^(\\+2|2)/,"");\n    const cleanAdminPhone = (cfg.adminPhone||"").replace(/^(\\+2|2)/,"");`;
const newLoginNormalize = `    const normalizeLoginPhone = (value) => {\n      let digits = String(value ?? "")\n        .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))\n        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))\n        .replace(/\\D/g, "");\n      if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);\n      return digits;\n    };\n    const cleanPhone = normalizeLoginPhone(form.phone);\n    const cleanAdminPhone = normalizeLoginPhone(cfg.adminPhone);`;
if (!app.includes(newLoginNormalize)) {
  if (!app.includes(oldLoginNormalize)) throw new Error("Admin runtime patch: main login phone normalization anchor not found");
  app = app.replace(oldLoginNormalize, newLoginNormalize);
  appChanged = true;
}

const oldSecureError = `        if (!migrationRequired) {\n          setError(code.includes("resource-exhausted") ? "محاولات دخول كثيرة. حاول لاحقاً" : "رقم الموبايل أو الرقم السري غير صحيح");\n          setLoading(false);\n          return;\n        }`;
const newSecureError = `        if (!migrationRequired) {\n          let message = "تعذر تسجيل دخول الإدارة";\n          if (code.includes("resource-exhausted")) message = "محاولات دخول كثيرة. حاول لاحقاً";\n          else if (code.includes("permission-denied") || code.includes("invalid-argument")) message = "رقم الموبايل أو الرقم السري غير صحيح";\n          else if (code.includes("unavailable") || code.includes("network") || code.includes("internal")) message = "تعذر الاتصال بخادم تسجيل الدخول. تأكد من الإنترنت وحاول مرة أخرى";\n          else if (code) message = \`تعذر تسجيل دخول الإدارة (\${code})\`;\n          setError(message);\n          setLoading(false);\n          return;\n        }`;
if (!app.includes(newSecureError)) {
  if (!app.includes(oldSecureError)) throw new Error("Admin runtime patch: secure error anchor not found");
  app = app.replace(oldSecureError, newSecureError);
  appChanged = true;
}

const oldGateOpen = `<button className="btn btn-primary btn-lg" style={{ width:220 }} onClick={()=>{\n        const cleanPhone = adminPhone.replace(/^(\\+2|2)/,"");\n        const configPhone = (cfg.adminPhone||"").replace(/^(\\+2|2)/,"");\n        if (cleanPhone === configPhone && pinInput === cfg.adminPin) {\n          setPinVerified(true); setPinError(false);\n        } else { setPinError(true); setPinInput(""); }\n      }}>دخول 👑</button>`;
const newGateOpen = `<button className="btn btn-primary btn-lg" style={{ width:220 }} onClick={async ()=>{\n        const normalizeAdminPhone = (value) => {\n          let digits = String(value ?? "")\n            .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))\n            .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))\n            .replace(/\\D/g, "");\n          if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);\n          return digits;\n        };\n        const cleanPhone = normalizeAdminPhone(adminPhone);\n        const configPhone = normalizeAdminPhone(cfg.adminPhone);\n        if (!cleanPhone || cleanPhone !== configPhone || !String(pinInput||"").trim()) {\n          setPinError(true); setPinInput(""); return;\n        }\n        try {\n          const secureLogin = httpsCallable(functions, "secureAdminLogin");\n          const result = await secureLogin({ phone: adminPhone, pin: pinInput });\n          const customToken = result?.data?.token;\n          if (!customToken) throw new Error("لم يتم استلام جلسة دخول آمنة");\n          const cred = await signInWithCustomToken(auth, customToken);\n          const adminMemberSnap = await getDoc(doc(db, "members", cred.user.uid));\n          if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) throw new Error("الحساب غير مصرح له");\n          const adminUser = { uid:cred.user.uid, email:cred.user.email, phone:cfg.adminPhone||adminPhone, displayName:"الأدمن", isAdmin:true };\n          localStorage.setItem("daleel_user", JSON.stringify(adminUser));\n          setPinVerified(true); setPinError(false);\n          window.location.reload();\n        } catch (e) {\n          console.error("admin gate login:", e?.code || e?.message || e);\n          setPinError(true); setPinInput("");\n        }\n      }}>دخول 👑</button>`;
if (!app.includes(newGateOpen)) {
  if (!app.includes(oldGateOpen)) throw new Error("Admin runtime patch: legacy admin gate anchor not found");
  app = app.replace(oldGateOpen, newGateOpen);
  appChanged = true;
}

const oldFnPhone = `const normalizePhone = (value) => {\n  let digits = String(value || "").replace(/\\D/g, "");\n  if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);\n  return digits;\n};`;
const newFnPhone = `const normalizePhone = (value) => {\n  let digits = String(value || "")\n    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))\n    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))\n    .replace(/\\D/g, "");\n  if (digits.startsWith("20") && digits.length >= 12) digits = "0" + digits.slice(2);\n  return digits;\n};`;
if (!fn.includes(newFnPhone)) {
  if (!fn.includes(oldFnPhone)) throw new Error("Admin runtime patch: Functions normalizePhone anchor not found");
  fn = fn.replace(oldFnPhone, newFnPhone);
  fnChanged = true;
}

if (appChanged) fs.writeFileSync(appPath, app, "utf8");
if (fnChanged) fs.writeFileSync(functionsPath, fn, "utf8");
console.log(appChanged || fnChanged ? "✅ Admin login runtime fixed" : "✓ Admin login runtime already fixed");
