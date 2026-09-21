const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
let source = fs.readFileSync(appPath, "utf8");
let changed = false;

const marker = "const doAdminEmailLogin = async () =>";

if (!source.includes(marker)) {
  const anchor = `  const doLogin = async () => {`;
  if (!source.includes(anchor)) throw new Error("Admin email login patch: doLogin anchor not found");

  const block = `  // دخول الإدارة بالإيميل — الإيميل هنا Alias فقط لنفس حساب الإدارة الآمن.\n  // التحقق الحقيقي يفضل server-side بنفس PIN ورقم الإدارة، لذلك لا يتم إنشاء حساب Admin جديد\n  // ولا تغيير UID أو بيانات Firebase Auth الحالية.\n  const doAdminEmailLogin = async () => {\n    const enteredEmail = String(form.phone || \"\").trim().toLowerCase();\n    const configuredAdminEmail = String(cfg.adminEmail || \"\").trim().toLowerCase();\n    if (!configuredAdminEmail || enteredEmail !== configuredAdminEmail) {\n      setError(\"إيميل الإدارة غير صحيح\");\n      return;\n    }\n    if (!form.pin) {\n      setError(\"أدخل الرقم السري للإدارة\");\n      return;\n    }\n\n    setLoading(true); setError(\"\");\n    try {\n      const secureLogin = httpsCallable(functions, \"secureAdminLogin\");\n      const result = await secureLogin({ phone: cfg.adminPhone || \"\", pin: form.pin });\n      const customToken = result?.data?.token;\n      if (!customToken) throw new Error(\"لم يتم استلام جلسة دخول آمنة\");\n\n      const cred = await signInWithCustomToken(auth, customToken);\n      const adminMemberSnap = await getDoc(doc(db, \"members\", cred.user.uid));\n      if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) {\n        await DB.signOut();\n        throw new Error(\"هذا الحساب غير مصرح له بدخول لوحة الإدارة\");\n      }\n\n      const adminUser = {\n        uid: cred.user.uid,\n        email: configuredAdminEmail,\n        phone: cfg.adminPhone || \"\",\n        displayName: \"الأدمن\",\n        isAdmin: true,\n      };\n      localStorage.setItem(\"daleel_user\", JSON.stringify(adminUser));\n      onLogin(adminUser);\n    } catch (e) {\n      const code = String(e?.code || \"\");\n      setError(code.includes(\"resource-exhausted\") ? \"محاولات دخول كثيرة. حاول لاحقاً\" : \"إيميل الإدارة أو الرقم السري غير صحيح\");\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const handleLogin = async () => {\n    const identifier = String(form.phone || \"\").trim();\n    if (identifier.includes(\"@\")) return doAdminEmailLogin();\n    return doLogin();\n  };\n\n`;

  source = source.replace(anchor, block + anchor);
  changed = true;
}

const oldPhoneField = `<label className="form-label req" style={{color:tc}}>📱 رقم الموبايل</label>\n              <input className={\`input\${darkMode?" input-dark":""}\`} type="tel" placeholder="01xxxxxxxxx" value={form.phone} onChange={e=>set("phone",e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>`;
const newPhoneField = `<label className="form-label req" style={{color:tc}}>📱 رقم الموبايل أو 📧 إيميل الإدارة</label>\n              <input className={\`input\${darkMode?" input-dark":""}\`} type="text" inputMode="email" placeholder="01xxxxxxxxx أو إيميل الإدارة" value={form.phone} onChange={e=>set("phone",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>`;
if (!source.includes(newPhoneField)) {
  if (!source.includes(oldPhoneField)) throw new Error("Admin email login patch: login identifier field anchor not found");
  source = source.replace(oldPhoneField, newPhoneField);
  changed = true;
}

const oldPinField = `<input className={\`input\${darkMode?" input-dark":""}\`} type="password" placeholder="أدخل رقمك السري" value={form.pin} onChange={e=>set("pin",e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>`;
const newPinField = `<input className={\`input\${darkMode?" input-dark":""}\`} type="password" placeholder="أدخل رقمك السري" value={form.pin} onChange={e=>set("pin",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>`;
if (!source.includes(newPinField)) {
  if (!source.includes(oldPinField)) throw new Error("Admin email login patch: PIN field anchor not found");
  source = source.replace(oldPinField, newPinField);
  changed = true;
}

const oldButton = `<button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:13}} onClick={doLogin} disabled={loading}>{loading?<Spinner size={17} color={C.navyDeep}/>:"دخول →"}</button>`;
const newButton = `<button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:13}} onClick={handleLogin} disabled={loading}>{loading?<Spinner size={17} color={C.navyDeep}/>:"دخول →"}</button>`;
if (!source.includes(newButton)) {
  if (!source.includes(oldButton)) throw new Error("Admin email login patch: login button anchor not found");
  source = source.replace(oldButton, newButton);
  changed = true;
}

if (changed) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("✅ Admin email login alias enabled");
} else {
  console.log("✓ Admin email login alias already enabled");
}
