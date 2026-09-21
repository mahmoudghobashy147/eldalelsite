const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "src", "App.jsx");
let source = fs.readFileSync(appPath, "utf8");
let changed = false;

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`✓ ${label} already applied`);
    return;
  }
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one source match, found ${count}`);
  }
  source = source.replace(oldText, newText);
  changed = true;
  console.log(`✓ ${label} applied`);
}

// 0) Never ship historical credential values/comments into a production build.
const beforeRedaction = source;
source = source.replace(/^\s*\/\/.*القيمة القديمة.*بقت متسربة ومعروفة.*$/gm, "  // تم حذف أي قيمة اعتماد تاريخية من النسخة المبنية — غيّر أي سر قديم ظهر في Git history.");
if (source !== beforeRedaction) {
  changed = true;
  console.log("✓ historical credential comment redacted from build source");
}

// 0b) Custom-token admin login needs Firebase Auth's secure custom-token API.
replaceOnce(
`import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut as fbSignOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";`,
`import { getAuth, signInWithEmailAndPassword, signInWithCustomToken, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut as fbSignOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";`,
"import signInWithCustomToken"
);

// 0c) If a field is deleted from Firestore, do not keep the old value alive in
// React state by merging the previous config object back in. This matters for
// removing the legacy public adminPin during migration.
replaceOnce(
`      if (snap.exists()) setConfig(p => ({ ...DEFAULT_CONFIG, ...p, ...snap.data() }));`,
`      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...snap.data() });`,
"drop deleted config values from client state"
);

// 1) Editing an existing member profile must never reset engagement counters,
// ratings, reviews, saves, or the original account creation date.
replaceOnce(
`      await setDoc(doc(db, "members", currentUser.uid), {
        views: 0, calls: 0, waMessages: 0, saves: 0, rating: 0, reviews: 0, createdAt: new Date(),
        ...memberData,
      }, { merge: true });`,
`      // تعديل الملف الشخصي لازم يحدّث بيانات الملف فقط. الإحصائيات وتاريخ إنشاء
      // الحساب قيم تراكمية/إدارية وممنوع تصفيرها عند كل تعديل للبروفايل.
      await setDoc(doc(db, "members", currentUser.uid), memberData, { merge: true });`,
"preserve member statistics on profile edit"
);

// 2) Never derive dashboard access from localStorage fields, phone number, or
// email alone. Verify the current Firebase UID and authoritative Firestore flag.
replaceOnce(
`  const isAdmin = user && (
    user.isAdmin ||
    user.phone === cfg.adminPhone ||
    user.phone === (cfg.adminPhone||"").replace(/^0/,"2") ||
    user.phone === "2"+(cfg.adminPhone||"") ||
    user.email === (cfg.adminEmail||"admin@daleel.com")
  );`,
`  const [verifiedAdmin, setVerifiedAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setVerifiedAdmin(false);
    const firebaseUser = auth.currentUser;
    if (!user?.uid || !firebaseUser?.uid || firebaseUser.uid !== user.uid) return () => { cancelled = true; };
    getDoc(doc(db, "members", user.uid))
      .then((snap) => {
        if (!cancelled) setVerifiedAdmin(Boolean(snap.exists() && snap.data()?.isAdmin === true));
      })
      .catch(() => { if (!cancelled) setVerifiedAdmin(false); });
    return () => { cancelled = true; };
  }, [user?.uid]);
  const isAdmin = Boolean(user && verifiedAdmin);
  useEffect(() => {
    if (activeTab === "admin" && !isAdmin) setActiveTab("home");
  }, [activeTab, isAdmin]);`,
"verify admin authorization against Firebase + Firestore"
);

// 3) Defense in depth: never mount AdminScreen without verified admin state.
replaceOnce(
`            {activeTab==="admin"&&<ErrorBoundary><AdminScreen darkMode={darkMode} currentUser={user}/></ErrorBoundary>}`,
`            {activeTab==="admin"&&isAdmin&&<ErrorBoundary><AdminScreen darkMode={darkMode} currentUser={user}/></ErrorBoundary>}`,
"gate AdminScreen mount behind verified admin"
);

// 4) Try the new server-side admin login first. Only when the server explicitly
// reports that migration has not happened yet do we fall through to the legacy
// bootstrap path below. A wrong PIN after migration never falls back.
replaceOnce(
`    const cleanPhone = form.phone.replace(/^(\\+2|2)/,"");
    if(cleanPhone === (cfg.adminPhone||"").replace(/^(\\+2|2)/,"") && form.pin === cfg.adminPin) {`,
`    const cleanPhone = form.phone.replace(/^(\\+2|2)/,"");
    const cleanAdminPhone = (cfg.adminPhone||"").replace(/^(\\+2|2)/,"");
    if (cleanPhone === cleanAdminPhone) {
      setLoading(true); setError("");
      try {
        const secureLogin = httpsCallable(functions, "secureAdminLogin");
        const result = await secureLogin({ phone: form.phone, pin: form.pin });
        const customToken = result?.data?.token;
        if (!customToken) throw new Error("لم يتم استلام جلسة دخول آمنة");
        const cred = await signInWithCustomToken(auth, customToken);
        const adminMemberSnap = await getDoc(doc(db, "members", cred.user.uid));
        if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) {
          await DB.signOut();
          throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة");
        }
        const adminUser = { uid:cred.user.uid, email:cred.user.email, phone:cfg.adminPhone||form.phone, displayName:"الأدمن", isAdmin:true };
        localStorage.setItem("daleel_user", JSON.stringify(adminUser));
        setLoading(false);
        onLogin(adminUser);
        return;
      } catch (secureErr) {
        const code = String(secureErr?.code || "");
        const migrationRequired = code.includes("failed-precondition") || String(secureErr?.message || "").includes("admin-auth-migration-required");
        if (!migrationRequired) {
          setError(code.includes("resource-exhausted") ? "محاولات دخول كثيرة. حاول لاحقاً" : "رقم الموبايل أو الرقم السري غير صحيح");
          setLoading(false);
          return;
        }
        // أول تشغيل بعد نشر Functions فقط: نكمل لمسار الترحيل القديم مرة واحدة.
        setLoading(false);
      }
    }
    if(cleanPhone === cleanAdminPhone && form.pin === cfg.adminPin) {`,
"prefer server-side admin custom-token login"
);

// 5) Legacy bootstrap may sign into the already-existing Firebase admin account,
// but it may never create/promote an admin from the browser. After verification,
// migrate the PIN server-side and delete it from public appSettings.
replaceOnce(
`        let cred;
        try {
          cred = await DB.signIn(adminEmail, authPass);
        } catch (signInErr) {
          // أول مرة بس: نعمل حساب Firebase حقيقي للأدمن لو لسه مش موجود
          if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
            cred = await DB.signUp(adminEmail, authPass, { name:"الأدمن", phone: cfg.adminPhone||form.phone, type:"vip" });
          } else { throw signInErr; }
        }
        // نتأكد إن مستند العضو الخاص بالأدمن معلّم isAdmin:true (عشان قاعدة isAdmin() في Firestore تشتغل)
        await setDoc(doc(db,"members",cred.user.uid), { isAdmin:true, name:"الأدمن", phone: cfg.adminPhone||form.phone, type:"vip", status:"approved" }, { merge:true });
        const adminUser = { uid:cred.user.uid, email:adminEmail, phone:cfg.adminPhone||form.phone, displayName:"الأدمن", isAdmin:true };`,
`        const cred = await DB.signIn(adminEmail, authPass);
        const adminMemberSnap = await getDoc(doc(db, "members", cred.user.uid));
        if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) {
          await DB.signOut();
          throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة");
        }
        try {
          const migrateAdminAuth = httpsCallable(functions, "migrateAdminAuth");
          await migrateAdminAuth({ pin: form.pin, phone: cfg.adminPhone||form.phone });
        } catch (migrationErr) {
          console.warn("Admin auth migration did not complete:", migrationErr?.message || migrationErr);
        }
        const adminUser = { uid:cred.user.uid, email:adminEmail, phone:cfg.adminPhone||form.phone, displayName:"الأدمن", isAdmin:true };`,
"prevent client admin promotion and migrate secret server-side"
);

// 6) Never persist the legacy PIN back into the public appSettings document.
replaceOnce(
`      await setDoc(doc(db,"config","appSettings"), appSettings, { merge: true });`,
`      const { adminPin: _legacyAdminPin, ...publicSettings } = appSettings;
      await setDoc(doc(db,"config","appSettings"), publicSettings, { merge: true });`,
"keep admin PIN out of public app settings"
);

if (changed) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("Safe patches written to src/App.jsx");
} else {
  console.log("All safe patches were already present");
}
