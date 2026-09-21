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
// email alone. Verify the currently authenticated Firebase UID and then read
// the authoritative isAdmin flag from that user's Firestore member document.
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

// 3) Defense in depth: even if activeTab is manipulated manually, never mount
// AdminScreen unless the verified admin check above succeeded.
replaceOnce(
`            {activeTab==="admin"&&<ErrorBoundary><AdminScreen darkMode={darkMode} currentUser={user}/></ErrorBoundary>}`,
`            {activeTab==="admin"&&isAdmin&&<ErrorBoundary><AdminScreen darkMode={darkMode} currentUser={user}/></ErrorBoundary>}`,
"gate AdminScreen mount behind verified admin"
);

// 4) The browser must never be able to create/promote an administrator account.
// Admin authentication may sign into an existing Firebase account, but the
// authoritative member record must already exist with isAdmin === true.
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
        // ممنوع إنشاء حساب أدمن أو ترقية عضو من المتصفح. الحساب لازم يكون
        // موجود ومعلّم isAdmin:true مسبقًا في Firestore.
        const adminMemberSnap = await getDoc(doc(db, "members", cred.user.uid));
        if (!adminMemberSnap.exists() || adminMemberSnap.data()?.isAdmin !== true) {
          await DB.signOut();
          throw new Error("هذا الحساب غير مصرح له بدخول لوحة الإدارة");
        }
        const adminUser = { uid:cred.user.uid, email:adminEmail, phone:cfg.adminPhone||form.phone, displayName:"الأدمن", isAdmin:true };`,
"prevent browser-side admin creation and self-promotion"
);

if (changed) {
  fs.writeFileSync(appPath, source, "utf8");
  console.log("Safe patches written to src/App.jsx");
} else {
  console.log("All safe patches were already present");
}
