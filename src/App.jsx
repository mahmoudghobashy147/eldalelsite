import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut as fbSignOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, increment, arrayUnion, arrayRemove, onSnapshot, runTransaction } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from "firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import {
  SITE_URL, buildMemberPath, buildMemberUrl, parseCurrentPath, navigateTo,
  updateMetaTags, injectSchema, buildLocalBusinessSchema, buildBreadcrumbSchema, slugify,
  trackPageView,
} from "./seo";

// ============================================================
// الدليل الشامل v2.0 — 2026
// Architecture: Firebase + React + AI-powered
// ============================================================

// ============================================================
// FIREBASE CONFIG — استبدل بإعداداتك
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA8Xrrp0N0CnDyI-0yvEYFVnh7HYCmH_PQ",
  authDomain: "eldalel-elshamel.firebaseapp.com",
  projectId: "eldalel-elshamel",
  storageBucket: "eldalel-elshamel.firebasestorage.app",
  messagingSenderId: "355717459859",
  appId: "1:355717459859:web:50ef5d6db4fe5a7425c266",
  measurementId: "G-P9BNJJSHVB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// ============================================================
// PUSH NOTIFICATIONS (المرحلة 1: إشعارات المتصفح/الويب)
// ============================================================
// المفتاح ده لازم تجيبه بنفسك من Firebase Console:
// Project Settings (⚙️) → Cloud Messaging → تاب "Web configuration" →
// "Web Push certificates" → دوس "Generate key pair" → انسخ الـ Key اللي هيظهرلك
// والصقه هنا مكان النص ده. من غيره الإشعارات مش هتشتغل خالص (هيفشل بصمت).
const FCM_VAPID_KEY = "BFv-nBH0HEkAIBwhJ6OaVzld9x1rtyAFiiPpxskeJSPHfeq4MDDCC9UEp1sl_SFAHEyGz5yj5E7IrXO9zvtz3ic";

// بيطلب إذن الإشعارات من المستخدم، ولو وافق بيسجل الـ token بتاعه على مستنده في Firestore
// عشان لما نبعت إشعار من السيرفر نعرف نوصله لجهازه بالظبط. بيفشل بهدوء (من غير ما يبوظ
// حاجة في التطبيق) لو المتصفح مش بيدعم الإشعارات أو المستخدم رفض الإذن.
//
// الدالة دي بقت بتفرّق بين حالتين مختلفتين تمامًا:
// 1) تطبيق الأندرويد المبني بـ Capacitor (APK) — لازم نستخدم الـ FCM الأصلي
//    بتاع النظام (@capacitor/push-notifications) عشان الإشعارات توصل فعليًا لشريط
//    الإشعارات والعلامة على الأيقونة حتى لو التطبيق مقفول. طريقة الويب العادية
//    (Service Worker + VAPID) بتفشل بصمت جوه WebView التطبيق ومش بتوصل للخلفية.
// 2) الموقع العادي على المتصفح (Chrome, Edge...) — بتفضل نفس الطريقة القديمة
//    شغالة زي ما هي بالظبط.
const registerPushToken = async (uid) => {
  if (!uid) return;
  try {
    if (Capacitor.isNativePlatform()) {
      // ─── مسار تطبيق الأندرويد (APK) ───
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== "granted") return;
      await PushNotifications.register();
      PushNotifications.addListener("registration", async (token) => {
        if (token?.value) {
          await updateDoc(doc(db, "members", uid), { fcmTokens: arrayUnion(token.value) }).catch(() => {});
        }
      });
      PushNotifications.addListener("registrationError", (err) => {
        console.log("Native push registration error:", err?.error || err);
      });
    } else {
      // ─── مسار المتصفح العادي (زي ما كان) ───
      if (FCM_VAPID_KEY === "ضع_مفتاح_VAPID_هنا") return; // لسه محطوطش المفتاح
      const supported = await isMessagingSupported().catch(() => false);
      if (!supported || typeof Notification === "undefined") return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const messaging = getMessaging(app);
      const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => null);
      const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: swReg || undefined });
      if (token) {
        await updateDoc(doc(db, "members", uid), { fcmTokens: arrayUnion(token) }).catch(() => {});
      }
    }
  } catch (e) {
    console.log("registerPushToken:", e?.message || e);
  }
};

// الدومين الحقيقي بتاع الموقع — SITE_URL بقى متعرّف مركزيًا في src/seo.js ومستورد من هنا
// (كان قبل كده متكرر هنا بشكل منفصل — لازم يفضل ثابت بدل window.location.origin عند توليد
// روابط المشاركة، لأن جوه تطبيق الأندرويد (Capacitor) الرابط اللي المتصفح شايفه لنفسه
// مش بيبقى الدومين الحقيقي وده كان بيخلي أي مشاركة/نسخ رابط تفشل)

// ============================================================
// APP CONFIG CONTEXT — reactive, loaded from Firestore
// ============================================================
const DEFAULT_CONFIG = {
  whatsapp: "201110001986",
  adminPhone: "01110001986",
  // كان هنا الرقم السري الحقيقي بتاع الأدمن مكتوب صريح في الكود، وده معناه إنه ظاهر لأي حد يفتح الموقع
  // ويشوف كود الـ JS (بنفس الطريقة اللي GitHub لقى بيها الـ Firebase key). سيبناه فاضي عشان النظام
  // "يفشل بأمان" (fail-closed) لحد ما يتحمّل الإعداد الحقيقي من Firestore. **لازم تغيّر الرقم السري
  // فعليًا من لوحة إعدادات الأدمن حالًا**، لأن القيمة القديمة "bebo112233aA@" بقت متسربة ومعروفة.
  adminPin: "",
  adminEmail: "admin@daleel.com",
  appName: "الدليل الشامل",
  appSlogan: "منصة البناء في مصر",
  planPrices: { starter:60, basic:120, premium:250, vip:600, company:1000, elite:1500 },
  // عدد المنشورات المسموح بها لكل باقة — قابل للتعديل من لوحة الأدمن
  postLimits: { starter:0, basic:5, premium:10, vip:20, company:40, elite:80 },
  // عدد الفيديوهات المسموح برفعها لكل باقة — قابل للتعديل من لوحة الأدمن
  videoLimits: { starter:0, basic:0, premium:0, vip:1, company:5, elite:10 },
  facebook: "", instagram: "", website: "",
  welcomeMsg: "", contactEmail: "",
  maintenanceMode: false, autoApprove: false,
};
const ConfigContext = createContext(DEFAULT_CONFIG);
const useConfig = () => useContext(ConfigContext);

// Provider — يحمّل الإعدادات من Firestore ويراقبها بـ onSnapshot
const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  useEffect(() => {
    const unsub = onSnapshot(doc(db,"config","appSettings"), snap => {
      if (snap.exists()) setConfig(p => ({ ...DEFAULT_CONFIG, ...p, ...snap.data() }));
    }, () => {});
    return unsub;
  }, []);
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
};

// ============================================================
// ERROR BOUNDARY
// ============================================================
import React from "react";
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(e) { return { hasError: true, error: e }; }
  componentDidCatch(e, info) { console.error("ErrorBoundary caught:", e, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight:"100vh", background:"#0A1628", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 20px", gap:14 }}>
        <div style={{ fontSize:52 }}>⚠️</div>
        <div style={{ fontFamily:"'Cairo'", fontWeight:800, fontSize:18, color:"white", textAlign:"center" }}>حدث خطأ غير متوقع</div>
        <div style={{ color:"rgba(255,255,255,.5)", fontSize:13, textAlign:"center" }}>حاول إعادة تحميل الصفحة</div>
        <button onClick={()=>{ this.setState({hasError:false,error:null}); }} style={{ background:"linear-gradient(135deg,#C9A84C,#A07830)", border:"none", borderRadius:12, padding:"12px 28px", color:"#0A1628", fontFamily:"'Cairo'", fontWeight:700, fontSize:14, cursor:"pointer" }}>
          🔄 إعادة المحاولة
        </button>
      </div>
    );
  }
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  navyDeep: "#001F3F", navy: "#0A3161", navyLight: "#1A5285",
  gold: "#FFC107", goldLight: "#FFD54F", goldDark: "#FFA000",
  white: "#FFFFFF", offWhite: "#F5F7FA", grayLight: "#E8ECF2", gray: "#8A9BB0",
  cardBg: "#0A3161", success: "#22C55E", warning: "#F59E0B",
  error: "#EF4444", info: "#3B82F6", purple: "#7C3AED", pink: "#EC4899",
};

// قائمة محافظات مصر الـ27 — مستخدمة في نافذة "اطلب صنايعي" السريعة
const EGYPT_GOVERNORATES = [
  "القاهرة","الجيزة","الإسكندرية","الدقهلية","البحيرة","الشرقية","المنوفية","القليوبية",
  "الغربية","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","شمال سيناء","جنوب سيناء",
  "بني سويف","الفيوم","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","الوادي الجديد",
  "مطروح","البحر الأحمر",
];

// ============================================================
// STATIC DATA
// ============================================================
// أيقونات خطية بسيطة (Outline) بديلة للإيموجي في شكل الديسكتوب — نفس روح الموقع المرجعي:
// أيقونات نظيفة بلون واحد (currentColor) بدل الإيموجي الملوّنة، وده بيدّي شكل احترافي أكتر
// وبيضمن كمان إنها تظهر صح على كل الأجهزة (عكس بعض رموز الإيموجي اللي مش مدعومة في كل مكان)
const TradeIcon = ({ id, size=28, color="currentColor", strokeWidth=1.7 }) => {
  const p = { width:size, height:size, viewBox:"0 0 24 24", fill:"none", stroke:color, strokeWidth, strokeLinecap:"round", strokeLinejoin:"round" };
  switch (id) {
    case "plumbing": return <svg {...p}><path d="M14.7 6.3a3 3 0 1 0-4.24 4.24L4 17v3h3l6.46-6.46a3 3 0 0 0 4.24-4.24l-2.1 2.1-1.9-.4-.4-1.9 2.1-2.1z"/></svg>;
    case "electrical": return <svg {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>;
    case "tiling": return <svg {...p}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>;
    case "painting": return <svg {...p}><rect x="3" y="3" width="12" height="6" rx="1.5"/><path d="M7 9v3a1 1 0 0 0 1 1h2v6a1.5 1.5 0 0 0 3 0v-7"/></svg>;
    case "carpentry": return <svg {...p}><path d="m14.5 3.5 6 6-2.3 2.3-6-6zM12.2 5.8 3 15v6h6l9.2-9.2"/></svg>;
    case "engineering": return <svg {...p}><path d="M3 21 12 3l9 18z"/><path d="M8.5 14h7"/></svg>;
    case "contracting": return <svg {...p}><path d="M4 21V9l7-4v16"/><path d="M11 8l9-3v16"/><path d="M4 21h16"/><path d="M8 13h.01M8 17h.01"/></svg>;
    case "company": return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6"/></svg>;
    case "finishing": return <svg {...p}><path d="M12 2v3M5.6 5.6l2.1 2.1M2 12h3M5.6 18.4l2.1-2.1M18.4 5.6l-2.1 2.1M22 12h-3M18.4 18.4l-2.1-2.1"/><circle cx="12" cy="12" r="3.2"/></svg>;
    case "gypsum": return <svg {...p}><path d="M4 21V8l8-5 8 5v13"/><path d="M4 21h16M9 21v-7h6v7"/></svg>;
    case "ac": return <svg {...p}><path d="M12 2v20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1M2 12h20"/></svg>;
    case "supplier": return <svg {...p}><rect x="2" y="8" width="12" height="8" rx="1"/><path d="M14 11h4l4 3v2h-2"/><circle cx="6.5" cy="18.5" r="1.6"/><circle cx="16.5" cy="18.5" r="1.6"/></svg>;
    case "developer": return <svg {...p}><path d="M4 21V6l5-3 5 3v15"/><path d="M14 21V10l6-2v13"/><path d="M2 21h20M7 9h.01M7 13h.01M7 17h.01"/></svg>;
    case "marble": return <svg {...p}><path d="M12 2 3 9l9 13 9-13z"/><path d="M3 9h18M12 2v20"/></svg>;
    case "aluminum": return <svg {...p}><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M12 2v20M8 8h.01M8 16h.01"/></svg>;
    case "steel": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1z"/></svg>;
    case "waterproofing": return <svg {...p}><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z"/></svg>;
    // أيقونات قسم "لماذا الدليل الشامل؟"
    case "trust": return <svg {...p}><path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "members": return <svg {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20a4.5 4.5 0 0 1 8 0"/></svg>;
    case "growth": return <svg {...p}><path d="M3 17 9 11l4 4 8-8"/><path d="M15 6h6v6"/></svg>;
    case "support": return <svg {...p}><path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5z"/><path d="M12 8v5M12 16h.01"/></svg>;
    default: return <svg {...p}><circle cx="12" cy="12" r="9"/></svg>;
  }
};


const SPECIALTIES = [
  { id:"plumbing", icon:"🔧", label:"سباكة" },
  { id:"electrical", icon:"⚡", label:"كهرباء" },
  { id:"tiling", icon:"🔲", label:"بلاط وسيراميك" },
  { id:"painting", icon:"🎨", label:"دهانات" },
  { id:"carpentry", icon:"🔨", label:"نجارة" },
  { id:"engineering", icon:"📐", label:"هندسة" },
  { id:"contracting", icon:"🏢", label:"مقاولات" },
  { id:"finishing", icon:"✨", label:"تشطيبات" },
  { id:"gypsum", icon:"🏛️", label:"جبس وديكور" },
  { id:"ac", icon:"❄️", label:"تكييف" },
  { id:"supplier", icon:"📦", label:"مواد بناء" },
  { id:"developer", icon:"🏙️", label:"تطوير عقاري" },
  { id:"marble", icon:"💎", label:"رخام وجرانيت" },
  { id:"aluminum", icon:"🚪", label:"ألومنيوم" },
  { id:"steel", icon:"⚙️", label:"حديد وصلب" },
  { id:"waterproofing", icon:"💧", label:"عزل مائي" },
];

// أقسام "النوع المهني" — دي بتصنّف الأعضاء حسب نوعهم (صنايعي/فني/مهندس/مقاول/شركة/مورد/مطور)
// بتقرا من نفس حقل "type" المسجّل وقت التسجيل (خطوة "بياناتك المهنية"). مختلفة عن SPECIALTIES
// اللي بتصنّف حسب المهنة (سباكة/كهرباء...)؛ هنا التصنيف حسب طبيعة العضو نفسه
const MEMBER_CATEGORIES = [
  { id:"craftsman", label:"صنايعية", icon:"plumbing" },
  { id:"company", label:"شركات", icon:"company" },
  { id:"supplier", label:"موردين", icon:"supplier" },
];

const GOVERNORATES = [
  "القاهرة","الجيزة","الإسكندرية","الدقهلية","البحر الأحمر","البحيرة",
  "الفيوم","الغربية","الإسماعيلية","المنوفية","المنيا","القليوبية",
  "الوادي الجديد","السويس","أسوان","أسيوط","بني سويف","بورسعيد",
  "دمياط","الشرقية","جنوب سيناء","كفر الشيخ","مطروح","الأقصر",
  "قنا","شمال سيناء","سوهاج",
];

// مراكز/مدن/أحياء كل محافظة — تُستخدم في خانة "المدينة/المركز" بالتسجيل والبحث
const MARAKEZ = {
  "القاهرة": ["مدينة نصر","مصر الجديدة","المعادي","حلوان","الزيتون","عين شمس","شبرا","الزمالك","وسط البلد","الدرب الأحمر","السيدة زينب","المقطم","التجمع الخامس","القاهرة الجديدة","مدينة الشروق","بدر","العبور","المرج","المطرية","الوايلي","روض الفرج","الساحل","الخليفة","الجمالية","باب الشعرية","الأميرية","الزاوية الحمراء","النزهة","المعصرة"],
  "الجيزة": ["مدينة الجيزة","الدقي","العجوزة","المهندسين","إمبابة","بولاق الدكرور","الوراق","أوسيم","كرداسة","أبو النمرس","الحوامدية","البدرشين","الصف","أطفيح","منشأة القناطر","6 أكتوبر","الشيخ زايد","حدائق الأهرام","العياط","الهرم","فيصل"],
  "الإسكندرية": ["المنتزه","شرق","وسط","غرب","الجمرك","العطارين","اللبان","المنشية","باكوس","سيدي جابر","سموحة","ميامي","العصافرة","أبو قير","برج العرب","الدخيلة","العامرية","الملاحة","الرمل","كرموز"],
  "الدقهلية": ["المنصورة","طلخا","ميت غمر","أجا","منية النصر","السنبلاوين","الجمالية","بلقاس","دكرنس","شربين","المنزلة","تمي الأمديد","ميت سلسيل","محلة دمنة","نبروه","بني عبيد","منشأة أبو عمر","الكردي"],
  "البحر الأحمر": ["الغردقة","رأس غارب","سفاجا","القصير","مرسى علم","الشلاتين","حلايب"],
  "البحيرة": ["دمنهور","كفر الدوار","رشيد","إدكو","أبو المطامير","أبو حمص","الدلنجات","المحمودية","الرحمانية","إيتاي البارود","شبراخيت","كوم حمادة","بدر","وادي النطرون","النوبارية الجديدة","حوش عيسى"],
  "الفيوم": ["مدينة الفيوم","إطسا","سنورس","طامية","يوسف الصديق (لهون)","إبشواي","الفيوم الجديدة"],
  "الغربية": ["طنطا","المحلة الكبرى","كفر الزيات","زفتى","السنطة","سمنود","بسيون","قطور"],
  "الإسماعيلية": ["الإسماعيلية","فايد","القنطرة شرق","القنطرة غرب","التل الكبير","أبو صوير","القصاصين الجديدة"],
  "المنوفية": ["شبين الكوم","منوف","أشمون","الباجور","قويسنا","بركة السبع","تلا","الشهداء","سرس الليان","السادات"],
  "المنيا": ["مدينة المنيا","ملوي","بني مزار","مطاي","سمالوط","أبو قرقاص","ديرمواس","مغاغة","العدوة"],
  "القليوبية": ["بنها","شبرا الخيمة","القناطر الخيرية","قليوب","الخانكة","كفر شكر","طوخ","شبين القناطر","الخصوص","العبور"],
  "الوادي الجديد": ["الخارجة","الداخلة","الفرافرة","باريس","بلاط"],
  "السويس": ["السويس","عتاقة","الجناين","فيصل","الأربعين"],
  "أسوان": ["أسوان","إدفو","كوم أمبو","دراو","نصر النوبة","كلابشة","أبو سمبل السياحية","البصيلية","الرديسية"],
  "أسيوط": ["أسيوط","ديروط","منفلوط","القوصية","أبنوب","أبو تيج","ساحل سليم","البداري","صدفا","الغنايم","الفتح الجديدة"],
  "بني سويف": ["بني سويف","الواسطى","ناصر","إهناسيا","ببا","سمسطا","الفشن"],
  "بورسعيد": ["الشرق","الغرب","الضواحي","المناخ","حي العرب","الزهور","الجنوب"],
  "دمياط": ["دمياط","رأس البر","فارسكور","الزرقا","كفر سعد","كفر البطيخ","السرو","الروضة","عزبة البرج","ميت أبو غالب"],
  "الشرقية": ["الزقازيق","بلبيس","منيا القمح","أبو حماد","الإبراهيمية","أبو كبير","فاقوس","الحسينية","ههيا","القرين","القنايات","كفر صقر","مشتول السوق","ديرب نجم","صان الحجر القبلية","أولاد صقر","العاشر من رمضان","الصالحية الجديدة"],
  "جنوب سيناء": ["الطور","شرم الشيخ","دهب","نويبع","طابا","سانت كاترين","أبو رديس","أبو زنيمة","رأس سدر"],
  "كفر الشيخ": ["كفر الشيخ","دسوق","فوه","مطوبس","بلطيم","سيدي سالم","الحامول","بيلا","الرياض","قلين","سيدي غازي"],
  "مطروح": ["مرسى مطروح","الحمام","العلمين","الضبعة","النجيلة","سيدي براني","السلوم","الظهير الغربي","سيوة"],
  "الأقصر": ["الأقصر","إسنا","الزينية","البياضية","القرنة","الطود","أرمنت"],
  "قنا": ["قنا","نجع حمادي","دشنا","قوص","نقادة","فرشوط","أبو تشت","الوقف","قفط"],
  "شمال سيناء": ["العريش","الشيخ زويد","رفح","بئر العبد","الحسنة","نخل"],
  "سوهاج": ["سوهاج","أخميم","جرجا","طهطا","طما","البلينا","المراغة","ساقلته","دار السلام","جهينة","المنشأة","العسيرات"],
};
const getMarakez = (gov) => MARAKEZ[gov] || [];

// بتوحّد صيغ الحروف العربية المتشابهة قبل أي مقارنة نصية في البحث — عشان لو حد كتب "سباكه" بالهاء
// بدل "سباكة" بالتاء المربوطة (غلطة إملائية شائعة جدًا)، أو "إسكندرية"/"اسكندرية" بهمزات مختلفة،
// يفضل البحث لاقيهم صح. من غيرها، أي اختلاف بسيط في الحروف كان بيخلي المطابقة النصية (includes) تفشل بصمت
const normalizeArabic = (s="") => String(s)
  .replace(/[إأآا]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // تشكيل وتطويل
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

// بتشيل "ال" التعريف (ومشتقاتها زي "وال"، "بال"، "فال"، "كال") من أول الكلمة، عشان "مطابخ"
// تتساوى مع "المطابخ" مثلاً
const stripArabicPrefix = (w="") => w.replace(/^(و|ف|ب|ك|ل)?ال/, "") || w;

// مطابقة على مستوى الكلمات لا النص الكامل — عشان التخصصات "المشتقة" اللي مكتوبة بصياغة مختلفة
// أو بترتيب كلمات مختلف عن التصنيف الأساسي (زي حد يدوّر على "تركيب مطابخ" ويلاقي عضو كاتب تخصصه
// "تركيب المطابخ والدواليب") لسه تتلاقي، بدل ما تفشل بسبب فرق حرف "ال" أو ترتيب الكلمات
const arabicTextIncludes = (haystack="", needle="") => {
  const hTokens = normalizeArabic(haystack).split(" ").filter(Boolean).map(stripArabicPrefix);
  const nTokens = normalizeArabic(needle).split(" ").filter(Boolean).map(stripArabicPrefix);
  if (nTokens.length === 0) return true;
  if (hTokens.length === 0) return false;
  return nTokens.every(nt => hTokens.some(ht => ht.includes(nt) || nt.includes(ht)));
};

const PLANS = {
  starter: { label:"مبتدئ",  price:60,  color:"#0EA5E9", maxPhotos:5,   maxPosts:0,  maxVideos:0, searchPriority:4, features:["ظهور في الدليل","5 صور","بيانات أساسية","شارة مبتدئ"] },
  basic:   { label:"أساسي",  price:120, color:C.info,    maxPhotos:15,  maxPosts:5,  maxVideos:0, searchPriority:3, features:["ظهور محسّن","15 صور","نشر حتى 5 منشورات شهريًا","إحصائيات","شارة أساسي"] },
  premium: { label:"مميز",   price:250, color:C.gold,    maxPhotos:40,  maxPosts:10, maxVideos:0, searchPriority:2, features:["أولوية البحث","40 صور","نشر حتى 10 منشورات شهريًا","شارة ✨","إحصائيات تفصيلية"] },
  vip:     { label:"VIP",    price:600, color:C.purple,  maxPhotos:999, maxPosts:20, maxVideos:1, searchPriority:1, features:["أولوية قصوى","صور غير محدودة","نشر حتى 20 منشور شهريًا","فيديو تعريفي واحد","صفحة رئيسية","دعم VIP","QR Code"] },
  company: { label:"شركات 🏢", price:1000, color:"#0D9488", maxPhotos:60,  maxPosts:40, maxVideos:5,  searchPriority:0,  features:["كل مزايا VIP","نشر حتى 40 منشور شهريًا","حتى 5 فيديوهات تعريفية","حتى 60 صورة بمعرض الأعمال","أولوية ظهور فوق أعضاء VIP بالبحث والفيد","ظهور في قسم 'شركاؤنا وشركاء النخبة' بالصفحة الرئيسية","شارة 'شركة موثقة' 🏢","بطاقة عرض وغطاء بروفايل بتصميم فاخر مخصص"] },
  elite:   { label:"شركاء النخبة 👑", price:1500, color:"#92400E", maxPhotos:100, maxPosts:80, maxVideos:10, searchPriority:-1, features:["كل مزايا باقة الشركات","نشر حتى 80 منشور شهريًا","حتى 10 فيديوهات تعريفية","حتى 100 صورة بمعرض الأعمال","أعلى أولوية ظهور في البحث والفيد على الإطلاق","ظهور في أول قسم 'شركاؤنا وشركاء النخبة' بالصفحة الرئيسية","شارة ذهبية 'شريك نخبة' 👑","بطاقة عرض وإطار بروفايل ذهبي مميز"] },
};

// باگ قديم مهم: حقل "type" في بيانات العضو بيتسجل فيه التصنيف المهني بتاعه وقت التسجيل
// (صنايعي/فني/مهندس/مقاول/شركة/مورد/مطور) — مش باقة الاشتراك! باقة الاشتراك الحقيقية متسجلة
// في حقل "plan" منفصل (starter/basic/premium/vip). لكن أماكن كتير في الكود كانت بتقرا "type"
// على إنه الباقة مباشرة، فكانت شارات VIP/مميز والحدود الشهرية للنشر وترتيب الأولوية في البحث
// كلها بتفشل بصمت مع أي عضو حقيقي (لأن type بتاعه هيكون "صنايعي" مثلاً مش "vip"). الدالة دي
// بترجع الباقة الصح دايمًا: تفضّل "plan" الأول، ولو مش موجود (بيانات قديمة) تدّي "type" كـ fallback
const getMemberPlan = (m) => (m?.plan || m?.type || "starter");

// الحدود الفعلية تأتي من إعدادات الأدمن (Firestore) مع رجوع للقيم الافتراضية أعلاه
const getPostLimit = (type, cfg) => {
  const v = cfg?.postLimits?.[type];
  return typeof v === "number" ? v : (PLANS[type]?.maxPosts ?? 0);
};
const getVideoLimit = (type, cfg) => {
  const v = cfg?.videoLimits?.[type];
  return typeof v === "number" ? v : (PLANS[type]?.maxVideos ?? 0);
};
// سعر الباقة الحي — بياخد القيمة اللي غيّرها الأدمن من الإعدادات (Firestore)، ولو مش موجودة
// يرجع للسعر الافتراضي في PLANS. أي مكان بيعرض سعر باقة للمستخدم لازم يستخدم الدالة دي
// بدل ما يقرا PLANS[x].price مباشرة، عشان تغيير السعر من لوحة الأدمن يظهر فورًا في كل الشاشات
const getPlanPrice = (type, cfg) => {
  const v = cfg?.planPrices?.[type];
  return typeof v === "number" ? v : (PLANS[type]?.price ?? 0);
};

// ============================================================
// IMAGE HELPERS — رفع وتحجيم الصور
// ============================================================
// يتحقق هل الملف بصيغة HEIC/HEIF (صيغة كاميرا سامسونج/آيفون الافتراضية) — المتصفح مش بيقدر يعرضها مباشرة
const isHeicFile = (file) => {
  const type = (file?.type || "").toLowerCase();
  const name = (file?.name || "").toLowerCase();
  return type === "image/heic" || type === "image/heif" || /\.(heic|heif)$/.test(name);
};
// يحوّل صور HEIC/HEIF لـ JPEG قابلة للعرض قبل التحجيم — بيحمّل مكتبة heic2any وقت الحاجة بس
const convertHeicIfNeeded = async (file) => {
  if (!isHeicFile(file)) return file;
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch (e) {
    console.error("HEIC conversion error:", e);
    throw new Error("صيغة الصورة (HEIC) غير مدعومة، غيّر إعدادات الكاميرا لـ JPEG من إعدادات الموبايل أو اختار صورة تانية");
  }
};
// يحجم الصورة لتناسب أبعاد محددة (Cover Crop) — مفيد لصور الإعلانات
// عشان الصورة المرفوعة تتناسب بالظبط مع مساحة مكان الإعلان
const resizeImageToFit = async (file, targetW, targetH, quality = 0.86) => {
  const normalizedFile = await convertHeicIfNeeded(file);
  return new Promise((resolve, reject) => {
  try {
    const img = new Image();
    const url = URL.createObjectURL(normalizedFile);
    let settled = false;
    // بعض صور الكاميرا (خصوصاً HEIC) بتفضل "بتحمّل" من غير onload ولا onerror — الـ timeout ده بيمنع التعليق الأبدي
    const decodeTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      reject(new Error("تعذر قراءة الصورة، جرّب صورة تانية"));
    }, 12000);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(decodeTimeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetW; canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(targetW / img.width, targetH / img.height);
        const sw = targetW / scale, sh = targetH / scale;
        const sx = Math.max(0, (img.width - sw) / 2), sy = Math.max(0, (img.height - sh) / 2);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("فشل تحويل الصورة")), "image/jpeg", quality);
      } catch (e) { reject(e); }
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(decodeTimeout);
      URL.revokeObjectURL(url);
      reject(new Error("تعذر تحميل الصورة، جرّب صورة بصيغة JPG أو PNG"));
    };
    img.src = url;
  } catch (e) { reject(e); }
  });
};
// يحجم الصورة بحيث لا يتعدى أكبر بعد فيها القيمة المحددة (بدون قص) — للمنشورات
const resizeImageMax = async (file, maxDim = 1280, quality = 0.84) => {
  const normalizedFile = await convertHeicIfNeeded(file);
  return new Promise((resolve, reject) => {
  try {
    const img = new Image();
    const url = URL.createObjectURL(normalizedFile);
    let settled = false;
    const decodeTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      reject(new Error("تعذر قراءة الصورة، جرّب صورة تانية"));
    }, 12000);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(decodeTimeout);
      try {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale); h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("فشل تحويل الصورة")), "image/jpeg", quality);
      } catch (e) { reject(e); }
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(decodeTimeout);
      URL.revokeObjectURL(url);
      reject(new Error("تعذر تحميل الصورة، جرّب صورة بصيغة JPG أو PNG"));
    };
    img.src = url;
  } catch (e) { reject(e); }
  });
};
// يرفع الملف على Firebase Storage مع مهلة زمنية (25 ثانية) عشان الرفع ميتعلقش لأبد لو النت بطيء أو واقع
// مهلة الرفع بتتناسب مع حجم الملف — 25 ثانية كانت كافية للصور (بعد التحجيم بتبقى أقل من ميجا)
// بس مستحيل تكفي لفيديو حجمه عشرات الميجابايت، فكانت بتفشل بـ "انتهت مهلة الرفع" رغم إن
// النت تمام والملف لسه بيترفع. بنحسب مهلة معقولة على أساس حجم الملف الفعلي (بحد أدنى 25
// ثانية وحد أقصى 3 دقايق) بدل رقم ثابت واحد لكل الحالات
const uploadBlobToStorage = async (blob, path) => {
  const ref = storageRef(storage, path);
  const uploadPromise = (async () => {
    await uploadBytes(ref, blob);
    return getDownloadURL(ref);
  })();
  const sizeMB = (blob?.size || 0) / (1024 * 1024);
  const timeoutMs = Math.min(Math.max(sizeMB * 8000, 25000), 180000); // ~8 ثواني لكل ميجا تقريبًا
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("انتهت مهلة الرفع، تأكد من الاتصال بالإنترنت وحاول تاني (ممكن يكون الملف كبير أو النت بطيء)")), timeoutMs);
  });
  return Promise.race([uploadPromise, timeoutPromise]);
};
// أبعاد كل مكان إعلان — تستخدم لتحجيم الصورة المرفوعة لتناسب المساحة بالظبط
const AD_IMAGE_DIMS = { hero: { w: 1200, h: 500 }, inline: { w: 700, h: 540 }, banner: { w: 1000, h: 320 } };

// مشاركة/نسخ لينك — بمستويات احتياطية عشان الزرار "ميوقفش" لو أي طريقة فشلت بصمت:
// 1) شاشة المشاركة الأصلية لنظام التشغيل (لو متاحة)
// 2) navigator.clipboard.writeText (المتصفحات الحديثة على HTTPS)
// 3) طريقة قديمة (execCommand) بتشتغل حتى في أماكن clipboard API مش متاح فيها
//    (زي بعض WebViews جوه تطبيق الأندرويد Capacitor)
// 4) لو كل حاجة فشلت، نعرض الرابط في نافذة يقدر ينسخه منها يدوي بدل ما الزرار ميعملش حاجة خالص
const copyOrShareLink = async (url, title = "", text = "") => {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch (e) { if (e?.name === "AbortError") return; /* المستخدم لغى المشاركة بنفسه — منكملش على النسخ */ }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      alert("✅ تم نسخ الرابط!");
      return;
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) { alert("✅ تم نسخ الرابط!"); return; }
  } catch (e) {}
  window.prompt("انسخ الرابط ده يدويًا:", url);
};

// بيحدد شكل الواجهة اللي هيظهر: تصميم "التطبيق المضغوط" (شريط تابات تحت + شاشات عمود واحد)
// بيفضل مخصوص بس لما البرنامج شغال جوه تطبيق الأندرويد الحقيقي (Capacitor). أي زيارة من متصفح — سواء
// من موبايل أو تابلت أو كمبيوتر — بتاخد نفس تصميم الموقع (نافبار فوق + شبكات وأقسام)، وده بيتظبط
// تلقائيًا بالحجم المناسب لكل شاشة عن طريق الـ CSS، بدل ما يتحول لتصميم تاني تمامًا لما الشاشة تصغر.
// Capacitor بيحقن window.Capacitor جوه التطبيق بس، فمش موجود خالص لما حد يفتح الموقع من متصفح عادي.
const useIsDesktop = () => {
  const [webLayout] = useState(() => {
    if (typeof window === "undefined") return true;
    const isNativeApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
    return !isNativeApp;
  });
  return webLayout;
};

// تحديد الموقع الجغرافي بمحاولتين: الأولى بدقة عالية (GPS) بمهلة معقولة، ولو فشلت
// بسبب "انتهت المهلة" تحديدًا (مش رفض إذن) بنعيد المحاولة بدقة أقل ومهلة أطول (بيانات
// الشبكة/الواي فاي كافية لتحديد تقريبي، وده بيشتغل غالبًا حتى لو GPS الجهاز ضعيف أو جوه مبنى)
const getMyLocation = (onSuccess, onError) => {
  if (!window.isSecureContext) {
    onError("تحديد الموقع محتاج اتصال آمن (HTTPS) — تأكد إنك فاتح الموقع بالرابط اللي يبدأ https://");
    return;
  }
  if (!navigator.geolocation) {
    onError("المتصفح أو التطبيق ده مش بيدعم تحديد الموقع خالص");
    return;
  }
  const describeError = (err) => {
    if (err.code === 1) return "رفضت إذن الوصول لموقعك. لازم توافق عليه: من إعدادات المتصفح/الموقع (دوس على 🔒 أو ⓘ جنب رابط الموقع) → Permissions → Location → Allow، وجرب تاني";
    if (err.code === 2) return "الجهاز مش قادر يحدد موقعك دلوقتي (خدمة تحديد الموقع في الجهاز نفسه مقفولة، أو إشارة GPS ضعيفة)";
    return "انتهت مهلة تحديد الموقع";
  };
  navigator.geolocation.getCurrentPosition(
    onSuccess,
    (err) => {
      if (err.code === 3) {
        // مهلة انتهت بدقة عالية — نجرب تاني بدقة أقل ومهلة أطول قبل ما نستسلم
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err2) => onError(describeError(err2)),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        );
      } else {
        onError(describeError(err));
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
};

// Mock data (used when Firebase not configured)
const MOCK_MEMBERS = [
  { id:"m1", name:"محمد أحمد السيد", specialty:"سباكة وصرف صحي", gov:"القاهرة", city:"المعادي", type:"vip", rating:4.9, reviews:127, views:3420, calls:89, waMessages:234, saves:56, avatar:"م", phone:"01001234567", badge:"⭐", bio:"خبرة 15 سنة في السباكة والتشطيبات الراقية والفنادق.", works:4, lat:29.96, lng:31.25, verified:true, facebook:"", instagram:"mo_plumbing", website:"", joinDate:"2024-01-15" },
  { id:"m2", name:"شركة النيل للمقاولات", specialty:"مقاولات بناء", gov:"الجيزة", city:"الدقي", type:"vip", rating:4.8, reviews:89, views:5200, calls:210, waMessages:445, saves:123, avatar:"ن", phone:"01112345678", badge:"🏆", bio:"شركة رائدة في المقاولات والبناء منذ 20 عاماً.", works:8, lat:30.04, lng:31.20, verified:true, facebook:"nile-contracting", instagram:"", website:"nile-contracting.com", joinDate:"2023-06-01" },
  { id:"m3", name:"كريم عبد الله", specialty:"دهانات وديكور", gov:"الإسكندرية", city:"المنتزه", type:"premium", rating:4.7, reviews:64, views:1890, calls:45, waMessages:112, saves:34, avatar:"ك", phone:"01223456789", badge:"✨", bio:"فنان دهانات محترف، متخصص في الجداريات والديكور الفني.", works:3, lat:31.24, lng:29.95, verified:true, facebook:"", instagram:"karim_decor", website:"", joinDate:"2024-03-20" },
  { id:"m4", name:"م. هنا محمود", specialty:"هندسة معمارية", gov:"القاهرة", city:"مدينة نصر", type:"premium", rating:4.9, reviews:203, views:8100, calls:320, waMessages:678, saves:201, avatar:"ه", phone:"01334567890", badge:"📐", bio:"مهندسة معمارية، ماجستير جامعة القاهرة، متخصصة في التصميم الداخلي.", works:6, lat:30.07, lng:31.33, verified:true, facebook:"", instagram:"hana_arch", website:"hana-design.com", joinDate:"2023-09-10" },
  { id:"m5", name:"أحمد فتحي", specialty:"كهرباء ولوحات", gov:"المنصورة", city:"المنصورة", type:"basic", rating:4.5, reviews:38, views:920, calls:28, waMessages:67, saves:12, avatar:"أ", phone:"01445678901", badge:null, bio:"كهربائي معتمد، متخصص في الأنظمة الكهربائية والتوزيع.", works:2, lat:31.04, lng:31.38, verified:false, facebook:"", instagram:"", website:"", joinDate:"2024-07-01" },
  { id:"m6", name:"مؤسسة الإعمار للتوريدات", specialty:"توريد مواد البناء", gov:"الجيزة", city:"6 أكتوبر", type:"vip", rating:4.6, reviews:156, views:6700, calls:445, waMessages:890, saves:167, avatar:"ع", phone:"01556789012", badge:"🏅", bio:"أكبر موردي مواد البناء في مصر بخبرة 25 سنة، توصيل لكل المحافظات.", works:0, lat:29.97, lng:31.02, verified:true, facebook:"elaemar", instagram:"elaemar_supplies", website:"elaemar.com", joinDate:"2023-01-01" },
];

const MOCK_JOBS = [
  { id:"j1", title:"مهندس موقع", company:"شركة النيل للمقاولات", location:"القاهرة - التجمع الخامس", salary:"8,000 - 12,000 ج", type:"دوام كامل", postedAt:Date.now()-2*86400000, applicants:14, urgent:true, desc:"مهندس موقع خبرة 3 سنوات+، مشاريع سكنية.", skills:["AutoCAD","إدارة مواقع","تخطيط"] },
  { id:"j2", title:"فني كهرباء", company:"مؤسسة الإعمار", location:"الجيزة - المهندسين", salary:"5,000 - 7,000 ج", type:"دوام كامل", postedAt:Date.now()-3*86400000, applicants:22, urgent:false, desc:"فني كهرباء لتركيب وصيانة الأنظمة الكهربائية.", skills:["كهرباء","تركيب"] },
  { id:"j3", title:"مصمم ديكور داخلي", company:"ستايلز للتصميم", location:"الإسكندرية", salary:"تفاوضي", type:"فريلانسر", postedAt:Date.now()-7*86400000, applicants:8, urgent:false, desc:"مصمم ذو خبرة لمشاريع سكنية وتجارية.", skills:["3D Max","تصميم","AutoCAD"] },
];

const MOCK_POSTS = [
  { id:"p1", authorId:"m1", author:"محمد أحمد السيد", avatar:"م", specialty:"سباكة", time:Date.now()-2*3600000, content:"تم الانتهاء من مشروع سباكة فيلا في القاهرة الجديدة 🔧 العمل شمل تركيب أطباق الصرف الصحي الكاملة وتوصيل المياه.", likes:34, comments:8, shares:5, type:"vip" },
  { id:"p2", authorId:"m2", author:"شركة النيل للمقاولات", avatar:"ن", specialty:"مقاولات", time:Date.now()-4*3600000, content:"🏢 عرض خاص: خصم 15% على التشطيب الكامل لوحدات سكنية خلال يوليو! تواصل معنا الآن.", likes:67, comments:23, shares:18, type:"vip" },
  { id:"p3", authorId:"m4", author:"م. هنا محمود", avatar:"ه", specialty:"هندسة", time:Date.now()-24*3600000, content:"نصيحة معمارية: ارتفاع الأسقف يؤثر على الإضاءة الطبيعية. السقف العالي يحتاج نوافذ أكبر لتحقيق التوازن. 📐", likes:112, comments:31, shares:44, type:"premium" },
];

// ============================================================
// FIREBASE SERVICE LAYER
// ============================================================
const POSTS_PAGE_SIZE = 20;

const DB = {
  async getMembers(filters = {}) {
    try {
      // بنفلتر status=approved من Firestore نفسه (مش بعد ما نجيب البيانات) عشان:
      // - ما نضيّعش سلوتات الـ limit في أعضاء pending/rejected
      // - نقلل عدد المستندات المقروءة فعليًا (أسرع + أرخص) كل ما عدد الأعضاء يكبر
      // ملحوظة: أول مرة هتشتغل هذه الفلاتر مع بعض، Firebase ممكن يطلب منك تعمل composite index
      // (هيظهر لينك جاهز في الـ Console error تدوس عليه وهو بيتعمل لوحده خلال دقيقة)
      let constraints = [where("status","==","approved")];
      if (filters.gov) constraints.push(where("gov","==",filters.gov));
      // فلتر "النوع المهني" (شركة/مورد/صنايعي/مهندس...) — بيقرا من حقل type لأنه فعليًا ده اللي
      // بيتسجل فيه وقت التسجيل (قايمة ثابتة، فمطابقة Firestore المباشرة مضمونة تشتغل صح)
      if (filters.category) constraints.push(where("type","==",filters.category));
      // رفعنا الحد لـ 1000 عشان التطبيق يستحمل التوسع من غير ما يضيع أعضاء حقيقيين
      // من قايمة البحث (كانت العتبة القديمة 100 بتقطع الأعضاء بمجرد ما العدد الكلي يكبر)
      constraints.push(limit(1000));
      const snap = await getDocs(query(collection(db,"members"), ...constraints));
      let results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      // باگ كان هنا: فلتر باقة الاشتراك (VIP/مميز/أساسي/مبتدئ) كان بيتعمل مباشرة على Firestore
      // بحقل "type"، لكن حقل type فعليًا بيحتوي على النوع المهني (صنايعي/شركة...) مش الباقة!
      // فكان أي فلترة بـ VIP أو مميز بترجع صفر نتائج دايمًا. الباقة الحقيقية بترجع من getMemberPlan
      // (بتفضّل حقل plan، ولو مش موجود بترجع لـ type كـ fallback للبيانات القديمة)
      if (filters.type) {
        results = results.filter(m => getMemberPlan(m) === filters.type);
      }
      if (filters.query) {
        // مطابقة على مستوى الكلمات بدل النص الكامل — عشان تخصصات مشتقة أو بصياغة مختلفة زي
        // "تركيب مطابخ" تلاقي عضو كاتب تخصصه "تركيب المطابخ والدواليب" مثلاً
        results = results.filter(m =>
          arabicTextIncludes(m.name, filters.query) || arabicTextIncludes(m.specialty, filters.query)
        );
      }
      // باگ كان هنا: فلتر التخصص (specialty) كان بيتبعت من شاشة البحث لكن مكنش بيتستخدم خالص هنا،
      // فكانت النتيجة بترجع كل الأعضاء بغض النظر عن الصنعة اللي المستخدم دورّ عليها.
      // التخصص عند التسجيل حقل نص حر (العضو بيكتبه بنفسه)، مش قايمة ثابتة، وممكن يكون بصياغة
      // مختلفة تمامًا أو تخصص "مشتق" مش موجود في قايمة الأقسام الأساسية، فبنستخدم مطابقة الكلمات
      // (arabicTextIncludes) اللي بتتجاهل فروق "ال" التعريف وترتيب الكلمات بدل المطابقة الحرفية
      if (filters.specialty) {
        results = results.filter(m => !!(m.specialty||"").trim() && arabicTextIncludes(m.specialty, filters.specialty));
      }
      // عدد المتابعين بيتقرأ من الحقل المخزّن على العضو نفسه (followersCount) بدل ما نعمل قراءة إضافية لكل عضو
      // ده أهم فرق بيخلي البحث سريع حتى مع مئات الأعضاء
      for (let m of results) m.followers = m.followersCount || 0;
      if (filters.sort === "rating") results.sort((a,b) => (b.rating||0) - (a.rating||0));
      else if (filters.sort === "views") results.sort((a,b) => (b.views||0) - (a.views||0));
      else results.sort((a,b) => (PLANS[getMemberPlan(a)]?.searchPriority??4) - (PLANS[getMemberPlan(b)]?.searchPriority??4));
      return results;
    } catch(e) {
      console.error("getMembers error:", e);
      return [];
    }
  },
  async getReviews(memberId) {
    try {
      const snap = await getDocs(query(collection(db,`members/${memberId}/reviews`), orderBy("time","desc"), limit(20)));
      if (!snap.empty) return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } catch {}
    return [];
  },
  async trackStat(memberId, stat) {
    try {
      await updateDoc(doc(db,"members",memberId), { [stat]: increment(1) });
    } catch(e) { console.log("trackStat error:", e); }
  },
  async getMemberStats(memberId) {
    try {
      const snap = await getDoc(doc(db,"members",memberId));
      if (snap.exists()) return snap.data();
    } catch {}
    return null;
  },
  async toggleAvailability(memberId, available) {
    try {
      await updateDoc(doc(db,"members",memberId), { available });
    } catch(e) { console.log("toggleAvailability error:", e); }
  },
  async addReview(memberId, review) {
    try {
      await addDoc(collection(db,`members/${memberId}/reviews`), { ...review, time: new Date() });
      // كان بيزود عدد المراجعات بس من غير ما يعيد حساب معدل النجوم خالص — فتقييم كل الأعضاء
      // كان فعليًا مجمد. بنستخدم transaction عشان لو اتنين قيّموا في نفس اللحظة الحساب يفضل مضبوط
      await runTransaction(db, async (tx) => {
        const ref = doc(db,"members",memberId);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const oldCount = data.reviews || 0;
        const oldRating = data.rating || 0;
        const newCount = oldCount + 1;
        const newRating = ((oldRating * oldCount) + (Number(review.rating)||0)) / newCount;
        tx.update(ref, { reviews: newCount, rating: Math.round(newRating*10)/10 });
      });
    } catch(e) { console.error("addReview error:", e); }
  },
  async getPosts(cursor = null) {
    try {
      const constraints = [orderBy("time","desc")];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(POSTS_PAGE_SIZE));
      const snap = await getDocs(query(collection(db,"posts"), ...constraints));
      const posts = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length-1] : null;
      // لو رجع أقل من حجم الصفحة، يبقى مفيش صفحات تانية بعدها
      const hasMore = snap.docs.length === POSTS_PAGE_SIZE;
      return { posts, lastDoc, hasMore };
    } catch(e) {
      console.error("getPosts error:", e);
      return { posts:[], lastDoc:null, hasMore:false };
    }
  },
  // منشورات عضو معيّن — تُستخدم في صفحته الشخصية وللتحقق من حد النشر المسموح
  async getUserPosts(authorId) {
    try {
      // ملاحظة: تعمّدنا عدم استخدام orderBy مع where على حقل مختلف هنا لأن ذلك
      // يتطلب composite index في Firestore؛ لو الإندكس مش موجود الاستعلام يفشل
      // بصمت (catch) وترجع مصفوفة فاضية دايمًا، فيبان إن عدد المنشورات مش بينقص
      // أبدًا. بنرتب النتيجة يدويًا بعد الجلب بدل الاعتماد على orderBy في الاستعلام.
      const snap = await getDocs(query(collection(db,"posts"), where("authorId","==",authorId), limit(50)));
      const posts = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      posts.sort((a,b) => (b.time?.toMillis?.() ?? new Date(b.time).getTime() ?? 0) - (a.time?.toMillis?.() ?? new Date(a.time).getTime() ?? 0));
      return posts;
    } catch(e) {
      console.error("getUserPosts error:", e);
      return [];
    }
  },
  async getUserPostsCount(authorId) {
    try {
      const snap = await getDocs(query(collection(db,"posts"), where("authorId","==",authorId)));
      return snap.size;
    } catch(e) {
      console.error("getUserPostsCount error:", e);
      return 0;
    }
  },
  async likePost(postId, userId) {
    try {
      const ref = doc(db,"posts",postId);
      const snap = await getDoc(ref);
      const liked = (snap.data()?.likedBy||[]).includes(userId);
      await updateDoc(ref, liked ? { likedBy: arrayRemove(userId), likes: (snap.data()?.likes||1)-1 } : { likedBy: arrayUnion(userId), likes: (snap.data()?.likes||0)+1 });
    } catch {}
  },
  async deletePost(postId) {
    try {
      await deleteDoc(doc(db,"posts",postId));
    } catch(e) {
      console.error("deletePost error:", e);
      throw new Error("فشل حذف المنشور");
    }
  },
  // ═══════════════════════════════════════════════════════════
  // COMMENTS SYSTEM
  // ═══════════════════════════════════════════════════════════
  async getComments(postId) {
    try {
      const snap = await getDocs(query(collection(db,`posts/${postId}/comments`), orderBy("time","desc")));
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } catch(e) {
      console.error("getComments error:", e);
      return [];
    }
  },
  async addComment(postId, userId, author, avatar, content) {
    try {
      const docRef = await addDoc(collection(db,`posts/${postId}/comments`), {
        authorId: userId,
        author,
        avatar,
        content,
        likes: 0,
        likedBy: [],
        time: new Date(),
        createdAt: new Date()
      });
      // Update post comment count
      const postRef = doc(db,"posts",postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        await updateDoc(postRef, { comments: (postSnap.data()?.comments || 0) + 1 });
      }
      return { id: docRef.id, authorId: userId, author, avatar, content, likes: 0, likedBy: [], time: new Date() };
    } catch(e) {
      console.error("addComment error:", e);
      throw new Error("فشل إضافة التعليق");
    }
  },
  async deleteComment(postId, commentId) {
    try {
      await deleteDoc(doc(db,`posts/${postId}/comments/${commentId}`));
      // Update post comment count
      const postRef = doc(db,"posts",postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        await updateDoc(postRef, { comments: Math.max(0, (postSnap.data()?.comments || 1) - 1) });
      }
    } catch(e) {
      console.error("deleteComment error:", e);
      throw new Error("فشل حذف التعليق");
    }
  },
  async likeComment(postId, commentId, userId) {
    try {
      const ref = doc(db,`posts/${postId}/comments/${commentId}`);
      const snap = await getDoc(ref);
      const liked = (snap.data()?.likedBy||[]).includes(userId);
      await updateDoc(ref, liked ? { likedBy: arrayRemove(userId), likes: Math.max(0,(snap.data()?.likes||1)-1) } : { likedBy: arrayUnion(userId), likes: (snap.data()?.likes||0)+1 });
    } catch(e) { console.error("likeComment error:", e); }
  },
  // ═══════════════════════════════════════════════════════════
  // DIRECT MESSAGES SYSTEM
  // ═══════════════════════════════════════════════════════════
  async getMessages(userId1, userId2) {
    try {
      const chatId = [userId1, userId2].sort().join("_");
      const snap = await getDocs(query(collection(db,`chats/${chatId}/messages`), orderBy("time","asc"), limit(50)));
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } catch(e) {
      console.error("getMessages error:", e);
      return [];
    }
  },
  async sendMessage(userId1, userId2, senderName, message) {
    try {
      const chatId = [userId1, userId2].sort().join("_");
      const docRef = await addDoc(collection(db,`chats/${chatId}/messages`), {
        senderId: userId1,
        senderName,
        message,
        time: new Date(),
        read: false
      });
      // Update chat metadata
      await setDoc(doc(db,"chats",chatId), {
        users: [userId1, userId2],
        lastMessage: message,
        lastTime: new Date(),
        updatedAt: new Date()
      }, { merge: true });
      // إشعار للطرف التاني — كان ناقص خالص قبل كده، يعني محدش كان بياخد إشعار برسالة جداده
      await addDoc(collection(db,"notifications"), {
        recipientId: userId2,
        title: senderName,
        body: message.length>60 ? message.slice(0,60)+"…" : message,
        icon: "💬", color: "#3B82F6",
        time: new Date(), read: false,
      }).catch(()=>{});
      return { id: docRef.id, senderId: userId1, senderName, message, time: new Date(), read: false };
    } catch(e) {
      console.error("sendMessage error:", e);
      throw new Error("فشل إرسال الرسالة");
    }
  },
  async getChats(userId) {
    try {
      // نفس نمط مشكلة الإشعارات والمنشورات: array-contains + orderBy على حقل
      // مختلف محتاج composite index في Firestore، ولو مش متعمل الاستعلام يفشل
      // بصمت وترجع المحادثات فاضية دايمًا. بنشيل orderBy من الاستعلام ونرتب
      // النتيجة يدويًا بعد الجلب.
      const snap = await getDocs(query(collection(db,"chats"), where("users","array-contains",userId)));
      let chats = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      chats.sort((a,b) => (b.lastTime?.toMillis?.() ?? new Date(b.lastTime).getTime() ?? 0) - (a.lastTime?.toMillis?.() ?? new Date(a.lastTime).getTime() ?? 0));
      // باگ كان هنا: المحادثة كانت بتتخزن بـ users:[uid1,uid2] بس من غير أسماء، فكانت شاشة
      // الرسائل بتعرض كلمة "محادثة" ثابتة بدل اسم الطرف التاني، والمستخدم مكانش عارف بيكلم مين.
      // بنجيب بيانات الطرف التاني (اسمه وصورته) من members عشان تتعرض صح في القايمة والمحادثة
      chats = await Promise.all(chats.map(async (c) => {
        const otherId = (c.users||[]).find(u => u !== userId);
        if (!otherId) return c;
        try {
          const mSnap = await getDoc(doc(db,"members",otherId));
          if (mSnap.exists()) {
            const m = mSnap.data();
            return { ...c, otherUserId: otherId, otherUserName: m.name||"عضو", otherUserAvatar: m.avatarUrl||null, otherUserPlan: getMemberPlan(m) };
          }
        } catch {}
        return { ...c, otherUserId: otherId, otherUserName: "عضو" };
      }));
      return chats;
    } catch(e) {
      console.error("getChats error:", e);
      return [];
    }
  },
  async getJobs() {
    try {
      const snap = await getDocs(query(collection(db,"jobs"), orderBy("postedAt","desc")));
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } catch(e) {
      console.error("getJobs error:", e);
      return [];
    }
  },
  async postJob(data) {
    try {
      const ref = await addDoc(collection(db,"jobs"), {
        title: data.title,
        company: data.company,
        location: data.location,
        salary: data.salary || "تفاوضي",
        type: data.type || "دوام كامل",
        desc: data.desc || "",
        skills: data.skills || [],
        urgent: !!data.urgent,
        postedBy: data.postedBy || null,
        applicants: 0,
        postedAt: new Date(),
      });
      return ref.id;
    } catch(e) {
      console.error("postJob error:", e);
      throw new Error("فشل نشر الوظيفة");
    }
  },
  // "اطلب صنايعي" — طلب سريع بنص حر بيكتبه المستخدم بنفسه (مش بحث بفلاتر جاهزة)
  // بيتخزن في مجموعة منفصلة "serviceRequests" عشان يفضل موجود للمتابعة لاحقًا
  // (مثلاً من لوحة الإدارة)، وده منفصل تمامًا عن مجموعة "jobs" (وظائف توظيف)
  async postServiceRequest(data) {
    try {
      const ref = await addDoc(collection(db,"serviceRequests"), {
        text: data.text,
        gov: data.gov || "",
        city: data.city || "",
        userId: data.userId || null,
        userName: data.userName || "",
        phone: data.phone || "",
        status: "open",
        createdAt: new Date(),
      });
      return ref.id;
    } catch(e) {
      console.error("postServiceRequest error:", e);
      throw new Error("فشل إرسال الطلب");
    }
  },
  // بندوّر على الصنايعية اللي تخصصهم مذكور جوه نص الطلب (وفي نفس المحافظة لو
  // متحددة)، ونبعتلهم إشعار فوري جوه التطبيق (بدال واتساب أوتوماتيك اللي محتاج
  // API رسمي مدفوع مش متاح على الباقة المجانية). مفيش Cloud Functions هنا (Spark
  // plan)، فده بيتنفذ من جهاز المستخدم نفسه لحظة إرسال الطلب مباشرة.
  async notifyMatchingCraftsmen(request) {
    try {
      let constraints = [where("status","==","approved")];
      if (request.gov) constraints.push(where("gov","==",request.gov));
      constraints.push(limit(500));
      const snap = await getDocs(query(collection(db,"members"), ...constraints));
      const allMembers = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const matched = allMembers.filter(m => !!(m.specialty||"").trim() && arabicTextIncludes(request.text, m.specialty));
      // بنحدد أقصى عدد إشعارات نبعتها عشان ميحصلش سبام لو النص عام جدًا وطابق ناس كتير
      const toNotify = matched.slice(0, 25);
      await Promise.all(toNotify.map(m =>
        addDoc(collection(db,"notifications"), {
          recipientId: m.id,
          title: "🛠️ طلب جديد يناسب تخصصك",
          body: request.text.length > 70 ? request.text.slice(0,70)+"…" : request.text,
          icon: "🛠️", color: C.gold,
          time: new Date(), read: false,
        }).catch(()=>{})
      ));
      return toNotify.length;
    } catch(e) {
      console.error("notifyMatchingCraftsmen error:", e);
      return 0;
    }
  },
  async getServiceRequests() {
    try {
      const snap = await getDocs(query(collection(db,"serviceRequests"), orderBy("createdAt","desc"), limit(200)));
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } catch(e) {
      console.error("getServiceRequests error:", e);
      return [];
    }
  },
  async applyJob(jobId, userId, data) {
    try {
      await addDoc(collection(db,"jobApplications"), { jobId, userId, ...data, status:"pending", appliedAt: new Date() });
      // بنزوّد عداد المتقدمين على الوظيفة نفسها — كان بيفضل 0 للأبد قبل كده
      await updateDoc(doc(db,"jobs",jobId), { applicants: increment(1) }).catch(()=>{});
    } catch(e) { throw new Error("فشل إرسال الطلب"); }
  },
  // كل المتقدمين على وظيفة معيّنة — يستخدمها صاحب الوظيفة أو الأدمن بس
  async getJobApplications(jobId) {
    try {
      const snap = await getDocs(query(collection(db,"jobApplications"), where("jobId","==",jobId)));
      const apps = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      apps.sort((a,b) => (b.appliedAt?.toMillis?.() ?? new Date(b.appliedAt).getTime() ?? 0) - (a.appliedAt?.toMillis?.() ?? new Date(a.appliedAt).getTime() ?? 0));
      return apps;
    } catch(e) {
      console.error("getJobApplications error:", e);
      return [];
    }
  },
  async signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  async signUp(email, password, data) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: data.name });
    await setDoc(doc(db,"members",cred.user.uid), { ...data, uid:cred.user.uid, createdAt:new Date(), views:0, calls:0, waMessages:0, saves:0, rating:0, reviews:0, type:"starter" });
    return cred;
  },
  async resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  },
  // عداد زيارات الموقع العام — بيبدأ من 10000 كقاعدة، وبيزيد 1 مع كل زيارة جديدة فعليًا.
  // لو المستند مش موجود لسه (أول مرة يتشغل الكود ده في حياة الموقع)، بننشئه بالقيمة
  // الأساسية 10000 + الزيارة الحالية. بعد كده أي زيارة بس بتزوّد increment(1) عادي
  async trackSiteVisit() {
    try {
      const ref = doc(db, "config", "stats");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { totalVisits: 10001 });
      } else {
        await updateDoc(ref, { totalVisits: increment(1) });
      }
    } catch(e) { console.log("trackSiteVisit error:", e); }
  },
  async getSiteVisits() {
    try {
      const snap = await getDoc(doc(db, "config", "stats"));
      return snap.exists() ? (snap.data().totalVisits || 10000) : 10000;
    } catch(e) { return 10000; }
  },
  // تغيير كلمة السر للعضو المسجل دخول بنفسه — لازم يدخل كلمة السر القديمة الأول
  // (Firebase بيرفض updatePassword مباشرة من غير "recent login" لأسباب أمان)
  async changeOwnPassword(currentPin, newPin) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("لازم تكون مسجل دخول");
    const cred = EmailAuthProvider.credential(user.email, currentPin);
    await reauthenticateWithCredential(user, cred); // هترمي auth/wrong-password لو القديمة غلط
    await updatePassword(user, newPin);
  },
  async signOut() {
    try { await fbSignOut(auth); } catch {}
  },
  // ملاحظة: الإشعارات بيبعتها الأدمن بحقل "target" فقط (all / vip / premium / ...)
  // باگ خطير كان هنا: الكود القديم كان بيجيب أول 50 إشعار بس من كل الإشعارات في
  // التطبيق كله (من غير أي فلترة)، وبعدين يدوّر جوّاهم على إشعارات المستخدم ده.
  // يعني لو عدد الإشعارات الكلي في النظام زاد عن 50 (وارد جدًا مع نمو عدد الأعضاء)،
  // إشعارات أي مستخدم ممكن تكون "مدفونة" برّه أول 50 مستند وميظهرش له أي إشعار
  // خالص رغم إن عنده إشعارات فعلية — وده بالظبط سبب إن الإشعارات "مش شغالة بجد".
  // دلوقتي بنجيب إشعارات المستخدم الشخصية (recipientId == uid بتاعه) وإشعارات
  // الأدمن العامة (recipientId == null) كل واحدة في استعلام مستقل ومضمون
  async getNotifications(userId, memberType) {
    try {
      if (!userId) return [];
      const [personalSnap, broadcastSnap] = await Promise.all([
        getDocs(query(collection(db,"notifications"), where("recipientId","==",userId), limit(50))),
        getDocs(query(collection(db,"notifications"), where("recipientId","==",null), limit(50))),
      ]);
      let all = [...personalSnap.docs, ...broadcastSnap.docs].map(d => ({ id:d.id, ...d.data() }));
      // إشعارات شخصية (recipientId) + إشعارات عامة من الأدمن (target)
      const filtered = all.filter(n => 
        n.recipientId === userId || // إشعار شخصي موجه ليك
        (!n.target || n.target === "all" || n.target === memberType) // إشعار عام من الأدمن
      );
      filtered.sort((a,b) => (b.time?.toMillis?.() ?? new Date(b.time).getTime() ?? 0) - (a.time?.toMillis?.() ?? new Date(a.time).getTime() ?? 0));
      return filtered.slice(0, 20);
    } catch(e) {
      console.error("getNotifications error:", e);
      return [];
    }
  },
  // "read" بوليان واحد على المستند مناسب للإشعار الشخصي (بتاع مستخدم واحد بس)، لكن مش مناسب
  // للإشعار العام (broadcast) لأنه مستند واحد مشترك بين أعضاء كتير — لو حددناه "مقروء" لواحد
  // هيبان "مقروء" لكل الباقيين. فبنستخدم readBy (array) للعام، و read (boolean) للشخصي بس
  isNotifRead(n, userId) {
    return n.recipientId ? !!n.read : (n.readBy||[]).includes(userId);
  },
  async markNotificationRead(notif, userId) {
    try {
      if (notif.recipientId) {
        await updateDoc(doc(db,"notifications",notif.id), { read: true });
      } else {
        await updateDoc(doc(db,"notifications",notif.id), { readBy: arrayUnion(userId) });
      }
    } catch(e) { console.log("markNotificationRead error:", e); }
  },
  // ملحوظة مهمة: الدالة دي بقت "حساب" بس، مش بتعمل قراءة جديدة من Firestore —
  // بتاخد قايمة الأعضاء والمدفوعات اللي اتقرت مرة واحدة فوق في AdminScreen وتحسب منها.
  // ده اللي وفّر قراءة كاملة تانية لمجموعة "members" (كانت بتتقرا مرتين كل ما تفتح لوحة الأدمن).
  getAdminStats(members = [], payments = []) {
    try {
      const monthNamesAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: monthNamesAr[d.getMonth()] });
      }
      const toDate = v => v?.toDate?.() || (v ? new Date(v) : null);
      const successPayments = payments.filter(p => p.status === "success");
      const failedPayments = payments.filter(p => p.status && p.status !== "success");
      const chartData = months.map(({ key, month }) => ({
        month,
        revenue: successPayments.reduce((sum, p) => {
          const d = toDate(p.date || p.time);
          if (!d) return sum;
          return `${d.getFullYear()}-${d.getMonth()}` === key ? sum + (Number(p.amount) || 0) : sum;
        }, 0),
      }));
      return {
        totalMembers: members.length,
        eliteMembers: members.filter(m=>getMemberPlan(m)==="elite").length,
        companyMembers: members.filter(m=>getMemberPlan(m)==="company").length,
        vipMembers: members.filter(m=>getMemberPlan(m)==="vip").length,
        premiumMembers: members.filter(m=>getMemberPlan(m)==="premium").length,
        basicMembers: members.filter(m=>getMemberPlan(m)==="basic").length,
        freeMembers: members.filter(m=>getMemberPlan(m)==="starter").length,
        totalJobs: 0, todayVisits: 0,
        monthRevenue: chartData[chartData.length - 1]?.revenue || 0,
        totalRevenue: successPayments.reduce((s,p)=>s+(Number(p.amount)||0),0),
        successCount: successPayments.length,
        failedCount: failedPayments.length,
        activeAds: 0, pendingComplaints: 0,
        chartData,
      };
    } catch {
      return { totalMembers:0, eliteMembers:0, companyMembers:0, vipMembers:0, premiumMembers:0, basicMembers:0, freeMembers:0, totalJobs:0, todayVisits:0, monthRevenue:0, totalRevenue:0, successCount:0, failedCount:0, activeAds:0, pendingComplaints:0, chartData:[] };
    }
  },
  async createPayment(data) {
    return { id:"PAY_"+Date.now(), status:"pending", ...data };
  },
  // محفوظات (Bookmarks) — العميل يحفظ الصنايعيين اللي عجبوه
  async saveMember(userId, memberId) {
    try {
      await setDoc(doc(db,`members/${userId}/saved`,memberId), { memberId, savedAt: new Date() });
      await updateDoc(doc(db,"members",memberId), { saves: increment(1) });
    } catch(e) { console.log("saveMember error:", e); }
  },
  async removeSavedMember(userId, memberId) {
    try {
      await deleteDoc(doc(db,`members/${userId}/saved`,memberId));
      await updateDoc(doc(db,"members",memberId), { saves: increment(-1) });
    } catch(e) { console.log("removeSavedMember error:", e); }
  },
  async getSavedMembers(userId) {
    try {
      const snap = await getDocs(collection(db,`members/${userId}/saved`));
      const savedIds = snap.docs.map(d => d.id);
      if (savedIds.length === 0) return [];
      // جيب بيانات كل عضو محفوظ
      const members = [];
      for (const id of savedIds) {
        const mSnap = await getDoc(doc(db,"members",id));
        if (mSnap.exists()) members.push({id: mSnap.id, ...mSnap.data()});
      }
      return members;
    } catch(e) { console.log("getSavedMembers error:", e); return []; }
  },
  // المتابعون (Followers)
  async followMember(followerId, followingId, followerName) {
    try {
      await setDoc(doc(db,`members/${followingId}/followers`,followerId), { followerId, followedAt: new Date() });
      // نحدّث عداد المتابعين المخزّن على العضو نفسه (denormalized) بدل عدّهم من الصفر كل مرة
      await updateDoc(doc(db,"members",followingId), { followersCount: increment(1) }).catch(()=>{});
      // أرسل إشعار شخصي للشخص اللي اتتابع — باسم اللي تابعه فعليًا، مش "شخص" عام
      await addDoc(collection(db,"notifications"), {
        recipientId: followingId,
        time: new Date(),
        icon: "👥",
        color: "#3B82F6",
        title: "متابعة جديدة",
        body: followerName ? `${followerName} بدأ يتابعك!` : `شخص جديد بيتابعك!`,
        type: "follow",
        followerId,
        followingId,
      });
    } catch(e) { console.log("followMember error:", e); }
  },
  async unfollowMember(followerId, followingId) {
    try {
      await deleteDoc(doc(db,`members/${followingId}/followers`,followerId));
      await updateDoc(doc(db,"members",followingId), { followersCount: increment(-1) }).catch(()=>{});
    } catch(e) { console.log("unfollowMember error:", e); }
  },
  async getFollowers(memberId) {
    try {
      const mSnap = await getDoc(doc(db,"members",memberId));
      if (mSnap.exists() && typeof mSnap.data().followersCount === "number") return Math.max(0, mSnap.data().followersCount);
      // fallback للحسابات القديمة اللي لسه معندهاش followersCount محسوب
      const snap = await getDocs(collection(db,`members/${memberId}/followers`));
      return snap.docs.length;
    } catch(e) { return 0; }
  },
  async getIsFollowing(followerId, followingId) {
    try {
      const snap = await getDoc(doc(db,`members/${followingId}/followers`,followerId));
      return snap.exists();
    } catch(e) { return false; }
  },
  // تتبع دخول البروفايل (يرسل إشعار شخصي)
  async trackProfileView(viewerId, profileOwnerId, viewerName) {
    try {
      // فقط لو مش نفس الشخص
      if (viewerId === profileOwnerId) return;
      await DB.trackStat(profileOwnerId, "views");
      // أرسل إشعار شخصي إن شخص دخل البروفايل بتاعه — باسم الزائر الحقيقي لو معروف
      await addDoc(collection(db,"notifications"), {
        recipientId: profileOwnerId,
        time: new Date(),
        icon: "👁",
        color: "#10B981",
        title: "زيارة جديدة",
        body: viewerName ? `${viewerName} دخل بروفايلك` : `شخص دخل بروفايلك`,
        type: "profileView",
        viewerId,
        profileOwnerId,
      });
    } catch(e) { console.log("trackProfileView error:", e); }
  },
  // حذف وظيفة (الأدمن فقط)
  async deleteJob(jobId) {
    try {
      await deleteDoc(doc(db,"jobs",jobId));
    } catch(e) {
      console.error("deleteJob error:", e);
      throw e;
    }
  },
  // إضافة رقم CV للوظيفة
  async updateJobCVNumber(jobId, cvNumber) {
    try {
      await updateDoc(doc(db,"jobs",jobId), { cvNumber });
    } catch(e) { console.log("updateJobCVNumber error:", e); }
  },
};

// ============================================================
// CUSTOM HOOKS
// ============================================================
function useDebounce(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const h = setTimeout(() => setV(value), delay); return () => clearTimeout(h); }, [value, delay]);
  return v;
}

function useIntersection(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold:0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return visible;
}

// ============================================================
// GLOBAL STYLES
// ============================================================
const GlobalStyles = () => {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Tajawal:wght@300;400;500;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      :root{--navy:#0D1F3C;--navy-deep:#0A1628;--navy-light:#1A3157;--gold:#C9A84C;--gold-light:#E8C56A;--gold-dark:#A07830;--white:#fff;--off-white:#F5F7FA;--gray-light:#E8ECF2;--gray:#8A9BB0;--card-bg:#112240;--success:#22C55E;--error:#EF4444;--warning:#F59E0B;--info:#3B82F6;--purple:#7C3AED}
      html{scroll-behavior:smooth}body{font-family:'Tajawal','Cairo',sans-serif;background:var(--off-white);color:var(--navy);direction:rtl;line-height:1.6;overflow-x:hidden}
      ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--gold);border-radius:2px}
      @keyframes fadeInUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
      @keyframes slideRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
      @keyframes premiumPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.7}}
      @keyframes premiumGlow{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.6)}50%{box-shadow:0 0 0 8px rgba(201,168,76,0)}}
      @keyframes premiumFlash{0%,100%{opacity:1}50%{opacity:.5}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
      @keyframes splashFade{0%{opacity:1}78%{opacity:1}100%{opacity:0;pointer-events:none}}
      @keyframes logoReveal{0%{opacity:0;transform:scale(.65)}70%{transform:scale(1.07)}100%{opacity:1;transform:scale(1)}}
      @keyframes goldGlow{0%,100%{box-shadow:0 0 8px rgba(201,168,76,.3)}50%{box-shadow:0 0 22px rgba(201,168,76,.65)}}
      @keyframes expand{to{width:100%}}

      .skeleton{background:linear-gradient(90deg,#e8ecf2 25%,#f5f7fa 50%,#e8ecf2 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px}
      .skeleton-dark{background:linear-gradient(90deg,#1a3157 25%,#1e3d6b 50%,#1a3157 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px}

      .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 20px;border-radius:10px;font-family:'Cairo',sans-serif;font-size:13.5px;font-weight:600;cursor:pointer;transition:all .22s;border:none;white-space:nowrap;position:relative;overflow:hidden}
      .btn::after{content:'';position:absolute;inset:0;background:white;opacity:0;transition:opacity .15s}
      .btn:active::after{opacity:.12}
      .btn-primary{background:linear-gradient(135deg,var(--gold),var(--gold-dark));color:var(--navy-deep)}
      .btn-primary:hover{transform:translateY(-2px);box-shadow:0 7px 18px rgba(201,168,76,.38);filter:brightness(1.04)}
      .btn-navy{background:var(--navy);color:var(--gold);border:1px solid var(--gold)}
      .btn-navy:hover{background:var(--navy-light);transform:translateY(-2px)}
      .btn-outline{background:transparent;color:var(--gold);border:1.5px solid var(--gold)}
      .btn-outline:hover{background:rgba(201,168,76,.1);transform:translateY(-2px)}
      .btn-ghost{background:transparent;color:var(--gray);border:none}
      .btn-ghost:hover{color:var(--gold)}
      .btn-danger{background:linear-gradient(135deg,#EF4444,#DC2626);color:white}
      .btn-sm{padding:7px 13px;font-size:12px;border-radius:8px}
      .btn-lg{padding:13px 28px;font-size:15px;border-radius:12px}
      .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}

      .input{width:100%;padding:11px 15px;border-radius:10px;font-family:'Tajawal',sans-serif;font-size:13.5px;outline:none;transition:all .2s;direction:rtl;background:var(--off-white);border:1.5px solid var(--gray-light);color:var(--navy)}
      .input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(201,168,76,.11);background:white}
      .input-dark{background:rgba(255,255,255,.06);border-color:rgba(201,168,76,.2);color:white}
      .input-dark:focus{border-color:var(--gold);background:rgba(255,255,255,.09)}
      .input-dark::placeholder{color:rgba(255,255,255,.32)}
      .select{width:100%;padding:11px 15px;border-radius:10px;font-family:'Tajawal',sans-serif;font-size:13.5px;outline:none;background:var(--off-white);border:1.5px solid var(--gray-light);color:var(--navy);cursor:pointer;direction:rtl;transition:all .2s;appearance:none}
      .select:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(201,168,76,.11)}
      .select-dark{background:rgba(255,255,255,.06);border-color:rgba(201,168,76,.2);color:white}
      textarea.input{resize:vertical;min-height:85px}

      .badge{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:700}
      .badge-elite{background:linear-gradient(135deg,#1F2937,#92400E);color:#FBBF24}
      .badge-company{background:linear-gradient(135deg,#0D9488,#0F766E);color:white}
      .badge-vip{background:linear-gradient(135deg,#7C3AED,#4F46E5);color:white}
      .badge-premium{background:linear-gradient(135deg,var(--gold),var(--gold-dark));color:var(--navy-deep)}
      .badge-basic{background:linear-gradient(135deg,#3B82F6,#2563EB);color:white}
      .badge-starter{background:linear-gradient(135deg,#0EA5E9,#0284C7);color:white}
      .badge-free{background:rgba(138,155,176,.2);color:#4A5568}
      .badge-success{background:rgba(34,197,94,.15);color:#16A34A}
      .badge-danger{background:rgba(239,68,68,.14);color:#DC2626}

      .chip{display:inline-flex;align-items:center;padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;background:rgba(201,168,76,.09);color:var(--gold);border:1px solid rgba(201,168,76,.22);cursor:pointer;transition:all .18s;white-space:nowrap}
      .chip.active,.chip:hover{background:var(--gold);color:var(--navy-deep)}
      .chip-gray{background:rgba(138,155,176,.1);color:#4A5568;border-color:rgba(138,155,176,.18)}
      .chip-gray:hover{background:#4A5568;color:white}

      .tab-bar{position:fixed;bottom:0;left:0;right:0;z-index:1000;background:var(--navy-deep);border-top:1px solid rgba(201,168,76,.18);display:flex;justify-content:space-around;align-items:center;padding:7px 0 max(7px,env(safe-area-inset-bottom));backdrop-filter:blur(20px)}
      .tab-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px;cursor:pointer;transition:all .18s;color:var(--gray);font-size:9px;font-weight:600;border-radius:9px;min-width:46px;position:relative}
      .tab-item.active{color:var(--gold)}
      .tab-icon{font-size:19px;line-height:1;transition:transform .18s}
      .tab-item.active .tab-icon{transform:scale(1.18)}

      .modal-overlay{position:fixed;inset:0;background:rgba(10,22,40,.82);z-index:2000;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(3px);animation:fadeIn .18s ease}
      .modal-sheet{background:white;border-radius:22px 22px 0 0;width:100%;max-width:550px;max-height:92vh;overflow-y:auto;animation:slideUp .32s ease;padding-bottom:env(safe-area-inset-bottom,20px)}
      .modal-handle{width:38px;height:3.5px;background:var(--gray-light);border-radius:2px;margin:10px auto 0}

      .hero-gradient{background:linear-gradient(145deg,#0A1628 0%,#0D1F3C 40%,#1A3157 70%,#0A1628 100%);position:relative;overflow:hidden}
      .hero-gradient::before{content:'';position:absolute;top:-50%;right:-30%;width:550px;height:550px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,.07) 0%,transparent 70%);pointer-events:none}

      .section{padding:18px 15px}
      .section-title{font-family:'Cairo',sans-serif;font-weight:800;font-size:19px}
      .gold-line{width:42px;height:3px;background:linear-gradient(90deg,var(--gold),var(--gold-light));border-radius:2px;margin:5px 0 14px}
      .divider{height:1px;background:var(--gray-light);margin:12px 0}
      .avatar{border-radius:50%;background:linear-gradient(135deg,var(--navy-light),var(--gold-dark));display:flex;align-items:center;justify-content:center;font-weight:800;color:white;flex-shrink:0;border:2px solid var(--gold)}
      .search-bar{display:flex;align-items:center;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(13,31,60,.1);border:1.5px solid rgba(201,168,76,.18)}
      .search-bar input{flex:1;padding:12px 15px;border:none;background:transparent;font-size:13.5px;color:var(--navy);font-family:'Tajawal',sans-serif;direction:rtl;outline:none}
      .search-bar button{background:linear-gradient(135deg,var(--gold),var(--gold-dark));border:none;padding:12px 16px;cursor:pointer;font-size:17px;flex-shrink:0}
      .scroll-x{display:flex;gap:9px;overflow-x:auto;padding-bottom:5px;scrollbar-width:none}
      .scroll-x::-webkit-scrollbar{display:none}
      .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
      .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .form-group{margin-bottom:13px}
      .form-label{display:block;font-size:12.5px;font-weight:700;margin-bottom:5px}
      .form-label.req::after{content:' *';color:var(--error)}
      .stat-card{text-align:center;padding:14px 8px;background:rgba(255,255,255,.08);border-radius:13px;border:1px solid rgba(201,168,76,.13)}
      .stat-number{font-family:'Cairo',sans-serif;font-size:22px;font-weight:900;background:linear-gradient(135deg,var(--gold),var(--gold-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      .progress-bar{height:5px;background:var(--gray-light);border-radius:3px;overflow:hidden}
      .progress-fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-light));border-radius:3px;transition:width .55s ease}
      .toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:var(--navy);color:white;padding:10px 20px;border-radius:12px;z-index:9999;font-size:13px;font-weight:600;border-right:3px solid var(--gold);box-shadow:0 8px 28px rgba(0,0,0,.28);animation:slideRight .38s ease;display:flex;align-items:center;gap:7px;max-width:92vw}
      .online-dot{width:8px;height:8px;border-radius:50%;background:var(--success);border:2px solid white;animation:pulse 2s infinite}
      .notif-badge{position:absolute;top:0;right:4px;background:var(--error);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;font-size:7.5px;font-weight:800;color:white;border:1.5px solid var(--navy-deep)}
      .toggle{width:44px;height:24px;background:var(--gray-light);border-radius:12px;position:relative;cursor:pointer;transition:background .28s;flex-shrink:0}
      .toggle.on{background:var(--gold)}
      .toggle::after{content:'';position:absolute;top:3px;right:3px;width:18px;height:18px;background:white;border-radius:50%;transition:transform .28s;box-shadow:0 1px 4px rgba(0,0,0,.18)}
      .toggle.on::after{transform:translateX(-20px)}
      .ai-bubble{background:linear-gradient(135deg,#1e3a5f,#0d1f3c);border-radius:15px 15px 15px 3px;padding:11px 15px;border:1px solid rgba(201,168,76,.18);max-width:85%;color:white;font-size:13px;line-height:1.72;animation:fadeInUp .38s ease}
      .user-bubble{background:linear-gradient(135deg,var(--gold),var(--gold-dark));border-radius:15px 15px 3px 15px;padding:10px 14px;max-width:80%;margin-right:auto;color:var(--navy-deep);font-weight:600;font-size:13px;animation:fadeInUp .28s ease}
      .story-ring{border:2.5px solid var(--gold);border-radius:50%;padding:2px;animation:goldGlow 2.2s ease-in-out infinite}
      @media(max-width:380px){.section{padding:15px 11px}.grid-2{gap:8px}.grid-3{grid-template-columns:1fr 1fr}}

      /* ============================================================ */
      /* 🖥️ WEB LAYOUT — نفس تصميم "الموقع" ده اللي بيتفعّل مع أي زيارة من متصفح (موبايل أو كمبيوتر)   */
      /* القواعد دي أساسية (شغالة دايمًا)، وتحتها استعلامات @media بتظبط عدد الأعمدة حسب مساحة الشاشة  */
      /* ============================================================ */
      body{overflow-x:hidden}
      .desktop-topbar{background:var(--navy-deep);color:rgba(255,255,255,.65);font-size:11px;padding:6px 0;border-bottom:1px solid rgba(201,168,76,.12)}
      .desktop-topbar-inner{max-width:1240px;margin:0 auto;padding:0 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
      .desktop-nav{background:white;position:sticky;top:0;z-index:1200;box-shadow:0 2px 14px rgba(13,31,60,.06)}
      .desktop-nav-inner{max-width:1240px;margin:0 auto;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .desktop-nav-links{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center}
      .desktop-nav-link{font-family:'Cairo',sans-serif;font-weight:700;font-size:12.5px;color:var(--navy);cursor:pointer;padding:5px 2px;border-bottom:2.5px solid transparent;transition:all .18s;white-space:nowrap}
      .desktop-nav-link:hover{color:var(--gold-dark)}
      .desktop-nav-link.active{color:var(--gold-dark);border-bottom-color:var(--gold)}
      .desktop-container{max-width:1240px;margin:0 auto;padding:0 14px}
      .desktop-hero-adbg{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:32px 14px 18px;min-height:260px;transition:background-image .6s ease, background .6s ease}
      .desktop-hero-adbg-content{max-width:1240px;margin:0 auto;width:100%;position:relative;z-index:2}
      .desktop-hero-stats-strip{max-width:1240px;margin:16px auto 0;width:100%;position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:8px 20px;border-top:1px solid rgba(255,255,255,.18);padding-top:12px}
      .hero-ad-badge{position:absolute;top:12px;left:12px;background:rgba(0,0,0,.4);backdrop-filter:blur(6px);color:#fff;font-size:10px;font-weight:700;padding:4px 11px;border-radius:14px;z-index:3}
      .desktop-hero-dots{position:relative;z-index:2;display:flex;justify-content:center;gap:5px;margin-top:14px}
      .desktop-hero-title{font-size:24px}
      @media(min-width:640px){
        .desktop-hero-title{font-size:30px}
      }
      @media(min-width:900px){
        .desktop-hero-title{font-size:38px}
      }
      .desktop-categories-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
      .desktop-whyus-grid{display:grid;grid-template-columns:1fr;gap:14px}
      .desktop-ads-grid{display:grid;grid-template-columns:1fr;gap:10px}
      .desktop-4col{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
      .desktop-3col{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
      .desktop-2col-feed{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}
      .desktop-search-grid{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}
      .desktop-messages-grid{display:grid;grid-template-columns:1fr;gap:16px;align-items:stretch}
      .desktop-chat-list-panel{max-height:52vh}
      .desktop-chat-window-panel{height:60vh}
      .desktop-scroll-wrap{display:flex!important;flex-wrap:wrap!important;overflow:visible!important}
      .desktop-scroll-wrap>*{flex:0 0 auto}
      .tab-bar{display:none}
      .desktop-hide{display:none!important}
      @media(max-width:559px){ .desktop-hide-narrow{display:none!important} }

      /* تابلت صغير فأعلى (≥560px): عمودين للأقسام بمساحة أوسع، وأعمدة الأعضاء 3 */
      @media(min-width:560px){
        .desktop-categories-grid{grid-template-columns:repeat(3,1fr)}
        .desktop-4col,.desktop-3col{grid-template-columns:repeat(3,1fr)!important}
        .desktop-whyus-grid{grid-template-columns:repeat(2,1fr)}
        .desktop-ads-grid{grid-template-columns:1fr 1fr}
      }
      /* تابلت كبير (≥760px): البحث والهيدر بيتوسعوا أكتر */
      @media(min-width:760px){
        .desktop-topbar-inner{padding:0 24px}
        .desktop-nav-inner{padding:12px 24px}
        .desktop-container{padding:0 24px}
        .desktop-hero-adbg{padding:46px 24px 26px;min-height:320px}
        .desktop-search-grid{grid-template-columns:220px 1fr}
        .desktop-messages-grid{grid-template-columns:260px 1fr}
      }
      /* شاشات الكمبيوتر (≥960px): الشكل الكامل زي الموقع المرجعي */
      @media(min-width:960px){
        .desktop-topbar-inner{padding:0 28px}
        .desktop-topbar{font-size:12.5px;padding:7px 0}
        .desktop-nav-inner{padding:14px 28px}
        .desktop-nav-links{gap:26px}
        .desktop-nav-link{font-size:14px}
        .desktop-container{padding:0 28px}
        .desktop-hero-adbg{padding:64px 28px 34px;min-height:400px}
        .desktop-categories-grid{grid-template-columns:repeat(8,1fr);gap:16px}
        .desktop-whyus-grid{grid-template-columns:repeat(4,1fr);gap:22px}
        .desktop-ads-grid{grid-template-columns:2fr 1fr 1fr;gap:14px}
        .desktop-4col{grid-template-columns:repeat(4,1fr)!important;gap:16px!important}
        .desktop-3col{grid-template-columns:repeat(3,1fr)!important;gap:16px!important}
        .desktop-2col-feed{grid-template-columns:2.1fr 1fr;gap:26px}
        .desktop-search-grid{grid-template-columns:290px 1fr;gap:26px}
        .desktop-messages-grid{grid-template-columns:340px 1fr;gap:26px}
        .desktop-chat-list-panel{max-height:640px}
        .desktop-chat-window-panel{height:640px}
      }
      @media(min-width:960px) and (max-width:1180px){
        .desktop-categories-grid{grid-template-columns:repeat(4,1fr)}
        .desktop-whyus-grid{grid-template-columns:repeat(2,1fr)}
      }
      /* شاشات ضيقة جدًا (موبايل مقاس صغير) */
      @media(max-width:420px){
        .desktop-categories-grid{grid-template-columns:repeat(2,1fr)}
        .desktop-nav-link{font-size:11.5px}
        .desktop-nav-links{gap:10px}
      }
      /* تحت 760px: روابط النافبار بتاخد سطر كامل تحت اللوجو والأزرار بدل ما تتوه في نفس السطر */
      @media(max-width:759px){
        .desktop-nav-inner{justify-content:space-between}
        .desktop-nav-links{order:3;flex-basis:100%;justify-content:center;padding-top:9px;margin-top:2px;border-top:1px solid #F0F0F0}
      }
    `;
    document.head.appendChild(s);
    return () => { if(document.head.contains(s)) document.head.removeChild(s); };
  }, []);
  return null;
};

// ============================================================
// 🖥️ DESKTOP NAV BAR — نافبار كمبيوتر (شريط علوي + قايمة روابط) بديل شريط التابات السفلي بتاع الموبايل
// ============================================================
const DesktopNavBar = ({ tabs, activeTab, onNavigate, user, onLogout, onShowAuth, onShowPayment, darkMode, onToggleDark }) => {
  const cfg = useConfig();
  // زرار الإشعارات مكانش موجود خالص على الويب قبل كده — كان موجود بس جوه هيدر تطبيق
  // الموبايل الأصلي (Capacitor)، فعلى المتصفح (اللي هو التصميم الافتراضي دلوقتي) مفيش
  // أي طريقة توصل بيها لشاشة الإشعارات خالص. بنجيبها هنا في النافبار عشان تبقى متاحة دايمًا
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!user?.uid) { setUnreadCount(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db,"members",user.uid));
        const plan = snap.exists() ? getMemberPlan(snap.data()) : "starter";
        const n = await DB.getNotifications(user.uid, plan);
        if (!cancelled) setUnreadCount(n.filter(x=>!DB.isNotifRead(x, user.uid)).length);
      } catch { if (!cancelled) setUnreadCount(0); }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);
  return (
    <>
      <div className="desktop-topbar">
        <div className="desktop-topbar-inner">
          <div style={{display:"flex",gap:22,alignItems:"center"}}>
            <span className="desktop-hide-narrow">📞 {cfg.adminPhone || "01110001986"}</span>
            <span>✉️ {cfg.contactEmail || cfg.adminEmail}</span>
          </div>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <span onClick={onToggleDark} style={{cursor:"pointer"}}>{darkMode?"☀️ وضع النهار":"🌙 الوضع الداكن"}</span>
            {!user && <span onClick={onShowAuth} style={{cursor:"pointer",color:C.gold,fontWeight:700}}>تسجيل دخول / إنشاء حساب</span>}
          </div>
        </div>
      </div>
      <div className="desktop-nav">
        <div className="desktop-nav-inner">
          <div style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}} onClick={()=>onNavigate("home")}>
            <img src={LOGO_URL} alt="الدليل الشامل" style={{width:40,height:40,borderRadius:10,objectFit:"cover",flexShrink:0}} />
            <div>
              <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:16,color:C.navy,lineHeight:1.1}}>{cfg.appName||"الدليل الشامل"}</div>
              <div className="desktop-hide-narrow" style={{fontSize:10,color:C.gray}}>{cfg.appSlogan||"منصة البناء في مصر"}</div>
            </div>
          </div>
          <div className="desktop-nav-links">
            {tabs.map(t => (
              <div key={t.id} className={`desktop-nav-link ${activeTab===t.id?"active":""}`} onClick={()=>onNavigate(t.id)}>{t.label}</div>
            ))}
            <div onClick={()=>onNavigate("search")} title="بحث" style={{width:32,height:32,borderRadius:"50%",background:activeTab==="search"?C.gold:"rgba(201,168,76,.12)",color:activeTab==="search"?C.navyDeep:C.navy,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,flexShrink:0,transition:"all .18s"}}>🔍</div>
            {user && (
              <div onClick={()=>onNavigate("notifications")} title="الإشعارات" style={{position:"relative",width:32,height:32,borderRadius:"50%",background:activeTab==="notifications"?C.gold:"rgba(201,168,76,.12)",color:activeTab==="notifications"?C.navyDeep:C.navy,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,flexShrink:0,transition:"all .18s"}}>
                🔔
                {unreadCount>0 && <div style={{position:"absolute",top:-3,left:-3,background:"#EF4444",color:"white",fontSize:9,fontWeight:800,minWidth:15,height:15,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:"1.5px solid white"}}>{unreadCount>9?"9+":unreadCount}</div>}
              </div>
            )}
          </div>
          <div className="desktop-nav-actions" style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            {user ? (
              <>
                <button className="btn btn-outline btn-sm desktop-hide-narrow" onClick={()=>onShowPayment()}>💳 الاشتراك</button>
                <button className="btn btn-primary btn-sm" onClick={()=>onNavigate("profile")}>+ أضف نشاطك</button>
                <button className="btn btn-ghost btn-sm" onClick={onLogout}>خروج</button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={onShowAuth}>+ أضف نشاطك</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};


const Spinner = ({ size=20, color=C.gold }) => (
  <div style={{ width:size, height:size, border:`2.5px solid ${color}33`, borderTopColor:color, borderRadius:"50%", animation:"spin .7s linear infinite", flexShrink:0 }} />
);

const Toast = ({ message, type="success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, []);
  const icons = { success:"✅", error:"❌", info:"ℹ️", warning:"⚠️" };
  return <div className="toast">{icons[type]} {message}</div>;
};

const StarRating = ({ rating=0, size=14, interactive=false, onRate }) => (
  <div style={{ display:"flex", gap:2 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} onClick={() => interactive && onRate?.(i)}
        style={{ fontSize:size, color: i<=Math.round(rating)?C.gold:C.grayLight, cursor:interactive?"pointer":"default", transition:"transform .12s" }}
        onMouseEnter={e => { if(interactive) e.target.style.transform="scale(1.3)"; }}
        onMouseLeave={e => { if(interactive) e.target.style.transform="scale(1)"; }}>★</span>
    ))}
  </div>
);

// ============================================================
// COMMENTS MODAL
// ============================================================
const CommentsModal = ({ postId, darkMode, currentUser, onClose }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;

  useEffect(() => {
    const loadComments = async () => {
      const data = await DB.getComments(postId);
      setComments(data);
      setLoading(false);
    };
    loadComments();
    const unsub = onSnapshot(
      collection(db, `posts/${postId}/comments`),
      snap => {
        const updatedComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setComments(updatedComments.sort((a, b) => (b.time?.toMillis?.() || 0) - (a.time?.toMillis?.() || 0)));
      },
      () => {}
    );
    return unsub;
  }, [postId]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    try {
      await DB.addComment(postId, currentUser.uid, currentUser.displayName || "مستخدم", currentUser.displayName?.[0] || "م", newComment);
      setNewComment("");
    } catch(e) { alert("❌ " + e.message); }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("حذف هذا التعليق؟")) return;
    try {
      await DB.deleteComment(postId, commentId);
      setComments(p => p.filter(c => c.id !== commentId));
    } catch(e) { alert("❌ " + e.message); }
  };

  const handleLikeComment = (commentId) => {
    if (!currentUser) return;
    DB.likeComment(postId, commentId, currentUser.uid);
  };

  const tAgo = t => { const d=(Date.now()-(typeof t==="number"?t:t?.toMillis?.()||Date.now()))/1000; if(d<60)return"الآن";if(d<3600)return`${Math.floor(d/60)} د`;if(d<86400)return`${Math.floor(d/3600)} س`;return`${Math.floor(d/86400)} يوم`; };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ padding: "14px 16px 20px", maxHeight: "80vh", overflowY: "auto" }}>
          <h3 style={{ fontFamily: "'Cairo'", fontWeight: 800, fontSize: 16, color: tc, marginBottom: 12 }}>💬 التعليقات ({comments.length})</h3>

          {/* Add Comment Input */}
          {currentUser && (
            <div style={{ background: darkMode ? C.navyDeep : C.offWhite, borderRadius: 11, padding: "11px 13px", marginBottom: 13, display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Av text={currentUser.displayName || "م"} size={32} type="starter" />
              <div style={{ flex: 1 }}>
                <textarea placeholder="أضف تعليقاً..." value={newComment} onChange={e => setNewComment(e.target.value)}
                  style={{ width: "100%", minHeight: 36, padding: "8px 10px", border: `1px solid ${darkMode ? "rgba(201,168,76,.2)" : C.grayLight}`, borderRadius: 8, background: bg, color: tc, fontFamily: "'Cairo'", fontSize: 13, resize: "none", outline: "none" }}
                />
                <button onClick={handleAddComment} disabled={!newComment.trim()} style={{ marginTop: 6, padding: "6px 12px", background: C.gold, color: C.navy, border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: newComment.trim() ? 1 : 0.5 }}>
                  📤 أرسل
                </button>
              </div>
            </div>
          )}

          {/* Comments List */}
          {loading ? <div style={{ textAlign: "center", padding: "20px", color: sub }}>جاري التحميل...</div> :
          comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 15px", color: sub, fontSize: 13 }}>لا توجد تعليقات بعد 💭</div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} style={{ background: darkMode ? C.navyDeep : C.offWhite, borderRadius: 10, padding: 11, marginBottom: 9 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                  <Av text={comment.avatar || comment.author?.[0] || "م"} size={32} type="starter" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: tc }}>{comment.author}</div>
                    <div style={{ fontSize: 10.5, color: sub }}>{tAgo(comment.time)}</div>
                  </div>
                  {currentUser?.uid === comment.authorId && (
                    <button onClick={() => handleDeleteComment(comment.id)} style={{ background: "rgba(239,68,68,.15)", border: "none", borderRadius: 6, padding: "4px 7px", color: "#EF4444", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🗑️</button>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: darkMode ? "rgba(255,255,255,.8)" : "#334155", lineHeight: 1.6, marginBottom: 7 }}>{comment.content}</p>
                <button onClick={() => handleLikeComment(comment.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: (comment.likedBy||[]).includes(currentUser?.uid) ? C.error : sub, fontWeight: 600 }}>
                  ❤️ {comment.likes || 0}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Av = ({ text="?", size=48, type="basic", src=null }) => {
  const bg = { vip:`linear-gradient(135deg,${C.purple},#4F46E5)`, premium:`linear-gradient(135deg,${C.gold},${C.goldDark})`, basic:`linear-gradient(135deg,${C.info},#2563EB)`, free:`linear-gradient(135deg,${C.gray},#4A5568)` };
  return (
    <div className="avatar" style={{ width:size, height:size, fontSize:size*.36, background:bg[type]||bg.basic, overflow:"hidden", flexShrink:0 }}>
      {src ? <img src={src} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : text?.[0]?.toUpperCase()}
    </div>
  );
};

const SkeletonCard = ({ dark }) => (
  <div style={{ background:dark?C.cardBg:"white", borderRadius:16, padding:15, border:`1px solid ${dark?"rgba(201,168,76,.08)":C.grayLight}` }}>
    <div style={{ display:"flex",gap:10,marginBottom:12 }}>
      <div className={dark?"skeleton-dark":"skeleton"} style={{ width:50,height:50,borderRadius:"50%" }} />
      <div style={{ flex:1 }}>
        <div className={dark?"skeleton-dark":"skeleton"} style={{ height:13,width:"68%",marginBottom:7 }} />
        <div className={dark?"skeleton-dark":"skeleton"} style={{ height:11,width:"48%" }} />
      </div>
    </div>
    <div className={dark?"skeleton-dark":"skeleton"} style={{ height:10,width:"100%",marginBottom:5 }} />
    <div className={dark?"skeleton-dark":"skeleton"} style={{ height:10,width:"75%" }} />
  </div>
);

const QRDisplay = ({ value, size=140 }) => {
  const cells = useMemo(() => {
    let h = 5381;
    for(let i=0;i<value.length;i++) h=((h<<5)+h)^value.charCodeAt(i);
    return Array.from({length:441},(_,i) => ((h>>(i%32))&1)||(i%3===0)||(i<63&&i%21<9&&(i<7||i%21<7))?1:0);
  }, [value]);
  const c = size/21;
  return (
    <div style={{ background:"white",padding:8,borderRadius:10,display:"inline-block",boxShadow:"0 2px 12px rgba(0,0,0,.1)" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {cells.map((v,i) => v ? <rect key={i} x={(i%21)*c} y={Math.floor(i/21)*c} width={c} height={c} fill={C.navyDeep} /> : null)}
        <rect x={size/2-14} y={size/2-14} width={28} height={28} rx={5} fill={C.gold} />
        <text x={size/2} y={size/2+5} textAnchor="middle" fontSize={11} fontWeight="bold" fill={C.navyDeep}>د</text>
      </svg>
    </div>
  );
};

// ============================================================
// SPLASH SCREEN
// ============================================================
// ============================================================
// LOGO URL — replace with your hosted image URL in production
// ============================================================
const LOGO_URL = "data:image/jpeg;base64,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";

// ============================================================
// LEGAL — الشروط والأحكام وسياسة الخصوصية
// ============================================================
const LEGAL_TERMS = `
1. طبيعة الخدمة
"الدليل الشامل" منصة رقمية بتربط أصحاب الحرف والمهن والمقاولين بالعملاء في مصر. المنصة وسيط عرض وتواصل فقط، ومش طرف في أي اتفاق أو تعاقد أو عملية دفع بين العضو والعميل.

2. العضوية والاشتراك
- التسجيل متاح لأي حرفي/فني/مقاول/شركة بشرط تقديم بيانات صحيحة.
- كل حساب بيمر بمراجعة الإدارة قبل التفعيل والظهور في نتائج البحث.
- رسوم الاشتراك سنوية حسب الباقة المختارة، وقت الدفع بتُحسب من تاريخ التفعيل أو التجديد.
- رسوم الاشتراك غير قابلة للاسترداد بعد التفعيل، إلا في حالات الخطأ الفني المثبت من الإدارة.
- الإدارة لها الحق في تعليق أو إلغاء أي حساب يخالف الشروط دي أو يقدّم بيانات مضلّلة أو يسيء استخدام المنصة.

3. مسؤولية المحتوى
- كل عضو مسؤول بالكامل عن صحة بياناته وصوره ومنشوراته والتقييمات اللي بيكتبها.
- ممنوع نشر محتوى مسيء أو مخالف للقانون المصري أو منتحل لهوية شخص/شركة تانية.
- المنصة بتحتفظ بحقها في حذف أي محتوى مخالف من غير إشعار مسبق.

4. حدود المسؤولية
المنصة مش مسؤولة عن جودة الخدمة اللي بيقدمها أي عضو، ولا عن أي نزاع مالي أو تعاقدي بين العضو والعميل. أي اتفاق على السعر أو الخدمة بيتم مباشرة بين الطرفين وخارج نطاق مسؤولية المنصة.

5. التعديلات
الإدارة ممكن تعدّل الشروط دي في أي وقت، والاستمرار في استخدام المنصة بعد التعديل يعتبر موافقة على الشروط الجديدة.

6. التواصل
لأي استفسار أو شكوى، تواصل مع الإدارة عن طريق رقم الواتساب المتاح في التطبيق.
`.trim();

const LEGAL_PRIVACY = `
1. البيانات اللي بنجمعها
الاسم، رقم الموبايل، التخصص، المحافظة/المنطقة، الصور اللي بترفعها، وموقعك الجغرافي (بس لو انت حددته بنفسك من صفحة البروفايل، وده اختياري بالكامل).

2. استخدام البيانات
بنستخدم بياناتك عشان: نعرض بروفايلك للعملاء، نتواصل معاك بخصوص حسابك واشتراكك، ونحسّن نتائج البحث والترتيب.

3. مشاركة البيانات
مبنبيعش ولا بنأجّر بياناتك لأي طرف تالت. بياناتك (الاسم، التخصص، رقم التواصل) بتظهر بشكل عام لأي زائر للموقع لأن ده أساس فكرة الدليل، وده بموافقتك وقت التسجيل. مش بنشارك بياناتك مع جهات إعلانية خارجية.

4. تخزين البيانات
بياناتك متخزنة على خوادم Google Firebase بمعايير أمان قياسية في الصناعة.

5. حقوقك
تقدر في أي وقت تطلب تعديل بياناتك أو حذف حسابك بالكامل من خلال التواصل مع الإدارة عبر الواتساب.

6. الأطفال
الخدمة موجّهة للبالغين (18 سنة فأكثر) العاملين في مجال البناء والتشطيبات.

7. التعديلات
ممكن نحدّث سياسة الخصوصية دي من وقت للتاني، وأي تحديث هيكون معلن في نفس الصفحة دي.
`.trim();

const LegalModal = ({ isOpen, onClose, darkMode }) => {
  const [tab, setTab] = useState("terms");
  if (!isOpen) return null;
  const bg = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.5)" : C.gray;
  const content = tab === "terms" ? LEGAL_TERMS : LEGAL_PRIVACY;
  return (
    <div className="modal-overlay" onClick={onClose} style={{zIndex:5000}}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()} style={{background:bg,maxHeight:"85vh"}}>
        <div className="modal-handle"/>
        <div style={{padding:"12px 18px 6px",display:"flex",gap:8}}>
          <button onClick={()=>setTab("terms")} className={`chip ${tab==="terms"?"active":""}`}>الشروط والأحكام</button>
          <button onClick={()=>setTab("privacy")} className={`chip ${tab==="privacy"?"active":""}`}>سياسة الخصوصية</button>
        </div>
        <div style={{padding:"10px 18px 24px",maxHeight:"65vh",overflowY:"auto",whiteSpace:"pre-line",fontSize:12.5,lineHeight:1.9,color:sub}}>
          {content}
        </div>
        <div style={{padding:"0 18px 18px"}}>
          <button className="btn btn-primary" style={{width:"100%"}} onClick={onClose}>تمام، فهمت</button>
        </div>
      </div>
    </div>
  );
};

const SplashScreen = ({ onDone }) => {
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 2500);
    const t2 = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#0A1628",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      opacity: fade ? 0 : 1,
      transition: "opacity 0.5s ease",
    }}>
      <img
        src={LOGO_URL}
        alt="الدليل الشامل"
        style={{
          width: "85%", maxWidth: 340,
          objectFit: "contain",
          filter: "drop-shadow(0 0 40px rgba(201,168,76,.4))",
          animation: "fadeInUp .6s ease both",
        }}
      />
    </div>
  );
};


// ============================================================
// AUTH SCREEN
// ============================================================
const AuthScreen = ({ onLogin, darkMode, onClose, initialMode="login" }) => {
  const cfg = useConfig();
  const [mode, setMode] = useState(initialMode); // login | register
  const [regStep, setRegStep] = useState(1); // 1=account 2=profile 3=plan 4=payment
  const [showLegal, setShowLegal] = useState(false);
  const [form, setForm] = useState({
    name:"", phone:"", pin:"", confirmPin:"",
    type:"", specialty:"", gov:"", city:"", experience:"", bio:"",
    plan:"starter"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdUser, setCreatedUser] = useState(null);
  const [customCity, setCustomCity] = useState(false);
  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.48)" : C.gray;
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const OWNER_WA = cfg.whatsapp;

  const phoneToEmail = (phone) => `${phone.replace(/\s/g,"")}@daleel.app`;
  // Firebase Auth بيرفض أي باسورد أقل من 6 حروف، لكن الرقم السري (PIN) بتاعنا ممكن يكون 4 أرقام بس
  // فبنحوّله هنا لباسورد طويل بما فيه الكفاية بطريقة ثابتة (نفس PIN هيدّي نفس الباسورد دايماً)
  const pinToPassword = (pin) => pin + "Daleel" + pin;
  // باسورد تقني ثابت لحساب الأدمن في Firebase Auth — مستقل تماماً عن الرقم السري (PIN) الظاهر للأدمن.
  // ده مهم جداً: لو ربطنا باسورد Firebase بالـ PIN، أي تغيير للـ PIN من لوحة الإعدادات كان هيكسر تسجيل
  // دخول الأدمن فوراً (لأن حساب Firebase القديم فاضل بباسورد مبني على الـ PIN القديم). الرقم السري
  // الحقيقي اللي بيتحقق منه ("cfg.adminPin") لسه هو نفسه اللي بيتغير من الإعدادات عادي.
  const adminAuthPassword = (phone) => `Daleel_Admin_Secure_${(phone||"").replace(/\D/g,"")}_2025!!`;

  const doLogin = async () => {
    // Admin login — يتحقق من cfg (reactive من Firestore)
    const cleanPhone = form.phone.replace(/^(\+2|2)/,"");
    if(cleanPhone === (cfg.adminPhone||"").replace(/^(\+2|2)/,"") && form.pin === cfg.adminPin) {
      setLoading(true); setError("");
      try {
        // لازم الأدمن يعمل تسجيل دخول حقيقي عند Firebase (مش بس محلي) عشان قواعد الأمان تتعرف عليه وتسمحله بالتعديل
        const adminEmail = phoneToEmail(cfg.adminPhone || form.phone);
        const authPass = adminAuthPassword(cfg.adminPhone || form.phone);
        let cred;
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
        const adminUser = { uid:cred.user.uid, email:adminEmail, phone:cfg.adminPhone||form.phone, displayName:"الأدمن", isAdmin:true };
        localStorage.setItem("daleel_user", JSON.stringify(adminUser));
        setLoading(false);
        onLogin(adminUser);
      } catch(e) {
        setLoading(false);
        if (e.code === "auth/email-already-in-use") {
          setError("⚠️ حساب الأدمن في Firebase متعارض مع الرقم القديم — احذف اليوزر ده من Firebase Console → Authentication → Users (الإيميل: " + phoneToEmail(cfg.adminPhone||form.phone) + ") وحاول تسجل الدخول تاني");
        } else if (e.code === "auth/network-request-failed") {
          setError("تعذر الاتصال بـ Firebase — تأكد إن الموبايل متصل بالنت فعلاً وجرّب تاني");
        } else {
          setError(`تعذر تسجيل دخول الأدمن (${e.code||"بدون كود"}): ${e.message||e}`);
        }
      }
      return;
    }

    if(!form.phone||!form.pin) return setError("أدخل رقم الموبايل والرقم السري");
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
      else setError(`حدث خطأ (${e.code||"بدون كود"}): ${e.message||e}`);
    }
    setLoading(false);
  };

  // Step 1: Create Firebase account
  const doCreateAccount = async () => {
    if(!form.name||!form.phone||!form.pin) return setError("أكمل جميع الحقول");
    if(form.phone.length < 10) return setError("رقم الموبايل غير صحيح");
    if(form.pin.length < 6) return setError("الرقم السري 6 أرقام على الأقل");
    if(form.pin !== form.confirmPin) return setError("الرقم السري مش متطابق");
    setLoading(true); setError("");
    try {
      const email = phoneToEmail(form.phone);
      const cred = await DB.signUp(email, form.pin, { name:form.name, phone:form.phone, type:"starter" });
      const u = { uid:cred.user.uid, email:cred.user.email, phone:form.phone, displayName:form.name };
      setCreatedUser(u);
      setRegStep(2);
    } catch(e) {
      if(e.code==="auth/email-already-in-use") setError("رقم الموبايل مسجل مسبقاً، سجّل دخولك");
      else if(e.code==="auth/network-request-failed") setError("تعذر الاتصال بـ Firebase — تأكد إن الموبايل متصل بالنت فعلاً وجرّب تاني");
      else setError(`حدث خطأ (${e.code||"بدون كود"}): ${e.message||e}`);
    }
    setLoading(false);
  };

  // Step 2: Save profile data
  const doSaveProfile = async () => {
    if(!form.type||!form.specialty||!form.gov) return setError("أكمل البيانات المطلوبة");
    setLoading(true); setError("");
    try {
      const u = createdUser;
      await setDoc(doc(db,"members",u.uid), {
        id: u.uid, uid: u.uid,
        name: form.name, phone: form.phone,
        type: form.type, specialty: form.specialty,
        gov: form.gov, city: form.city||"", experience: form.experience||"", bio: form.bio||"",
        plan: form.plan||"starter",
        status: "pending",
        available: false,
        views:0, calls:0, waMessages:0, saves:0, rating:0, reviews:0,
        createdAt: new Date(), updatedAt: new Date(),
      }, { merge: true });
      setRegStep(3);
    } catch(e) { setError(`خطأ في الحفظ (${e.code||"بدون كود"}): ${e.message||e}`); }
    setLoading(false);
  };

  // Step 3: Choose plan
  const doChoosePlan = async () => {
    try {
      await updateDoc(doc(db,"members",createdUser.uid), { plan: form.plan });
    } catch {}
    // All plans need admin approval
    localStorage.setItem("daleel_user", JSON.stringify(createdUser));
    setRegStep(5); // waiting screen
  };

  // Step 4: Payment via WhatsApp
  const doPayment = (method) => {
    const p = PLANS[form.plan];
    const price = getPlanPrice(form.plan, cfg);
    const msg = `مرحباً، أريد الاشتراك في باقة ${p.label} بسعر ${price} جنيه سنويًا عن طريق ${method} - الاسم: ${form.name} - الهاتف: ${form.phone}`;
    window.open(`https://wa.me/${OWNER_WA}?text=${encodeURIComponent(msg)}`);
    // Show waiting screen after payment
    localStorage.setItem("daleel_user", JSON.stringify(createdUser));
    setRegStep(5);
  };

  const doRegister = doCreateAccount; // alias for old code

  const types = [["craftsman","🔧","صنايعي"],["technician","⚡","فني"],["engineer","📐","مهندس"],["contractor","🏢","مقاول"],["company","🏢","شركة"],["supplier","📦","مورد"],["developer","🏙️","مطور"]];
  const steps = mode==="register" ? ["الحساب","الملف","الباقة","الدفع","انتهى"] : [];

  return (
    <div style={{ background:bg, height:"100vh", display:"flex", flexDirection:"column", overflowY:"auto" }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(145deg,${C.navyDeep},${C.navy})`, padding:"50px 22px 20px", textAlign:"center", flexShrink:0 }}>
        <div style={{ fontSize:44, marginBottom:8 }}>🏢</div>
        <h1 style={{ fontFamily:"'Cairo'",fontWeight:900,fontSize:22,color:"white",marginBottom:3 }}>
          الدليل <span style={{ background:`linear-gradient(135deg,${C.gold},${C.goldLight})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>الشامل</span>
        </h1>
        {mode==="register" && (
          <div style={{marginTop:12}}>
            <div style={{display:"flex",gap:0,maxWidth:300,margin:"0 auto"}}>
              {steps.map((s,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                  <div style={{height:3,background:regStep>i+1?C.gold:regStep===i+1?C.gold:"rgba(255,255,255,.2)",borderRadius:2,transition:"all .3s"}}/>
                  <div style={{fontSize:9,color:regStep>=i+1?C.gold:"rgba(255,255,255,.3)",textAlign:"center"}}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:"18px 16px 100px", maxWidth:420, width:"100%", margin:"0 auto" }}>
        <div style={{ background:card, borderRadius:20, padding:"20px 16px", boxShadow:"0 4px 28px rgba(13,31,60,.09)" }}>
          {error && <div style={{ background:"rgba(239,68,68,.09)",border:"1px solid rgba(239,68,68,.28)",borderRadius:9,padding:"9px 13px",color:C.error,fontSize:12.5,marginBottom:12 }}>⚠️ {error}</div>}

          {/* ── LOGIN ── */}
          {mode==="login" && <>
            <h2 style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:18,color:tc,marginBottom:16 }}>تسجيل الدخول</h2>
            <div className="form-group">
              <label className="form-label req" style={{color:tc}}>📱 رقم الموبايل</label>
              <input className={`input${darkMode?" input-dark":""}`} type="tel" placeholder="01xxxxxxxxx" value={form.phone} onChange={e=>set("phone",e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            <div className="form-group">
              <label className="form-label req" style={{color:tc}}>🔑 الرقم السري</label>
              <input className={`input${darkMode?" input-dark":""}`} type="password" placeholder="أدخل رقمك السري" value={form.pin} onChange={e=>set("pin",e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            <button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:13}} onClick={doLogin} disabled={loading}>{loading?<Spinner size={17} color={C.navyDeep}/>:"دخول →"}</button>
            <div style={{textAlign:"center",color:sub,fontSize:12.5}}>ليس لديك حساب؟ <span style={{color:C.gold,cursor:"pointer",fontWeight:700}} onClick={()=>{setMode("register");setRegStep(1);setError("");}}>سجّل الآن</span></div>
          </>}

          {/* ── REGISTER STEP 1: Account ── */}
          {mode==="register" && regStep===1 && <>
            <h2 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:14}}>إنشاء حساب جديد</h2>
            {[["name","👤 الاسم الكامل","text","أدخل اسمك"],["phone","📱 رقم الموبايل","tel","01xxxxxxxxx"],["pin","🔑 الرقم السري","password","4 أرقام على الأقل"],["confirmPin","🔑 تأكيد الرقم السري","password","أعد إدخال الرقم السري"]].map(([k,l,t,ph])=>(
              <div key={k} className="form-group">
                <label className="form-label req" style={{color:tc}}>{l}</label>
                <input className={`input${darkMode?" input-dark":""}`} type={t} placeholder={ph} value={form[k]} onChange={e=>set(k,e.target.value)}/>
              </div>
            ))}
            <button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:10}} onClick={doCreateAccount} disabled={loading}>{loading?<Spinner size={17} color={C.navyDeep}/>:"التالي ←"}</button>
            <p style={{textAlign:"center",color:sub,fontSize:11,marginBottom:6}}>
              بالتسجيل، انت موافق على <span style={{color:C.gold,cursor:"pointer",fontWeight:700}} onClick={()=>setShowLegal(true)}>الشروط والأحكام وسياسة الخصوصية</span>
            </p>
            <div style={{textAlign:"center",color:sub,fontSize:12.5}}>لديك حساب؟ <span style={{color:C.gold,cursor:"pointer",fontWeight:700}} onClick={()=>{setMode("login");setError("");}}>سجّل دخولك</span></div>
          </>}

          {/* ── REGISTER STEP 2: Profile ── */}
          {mode==="register" && regStep===2 && <>
            <h2 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:14}}>بياناتك المهنية</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:13}}>
              {types.map(([id,icon,label])=>(
                <div key={id} onClick={()=>set("type",id)} style={{background:form.type===id?`rgba(201,168,76,.15)`:darkMode?"rgba(255,255,255,.04)":"#F8F9FA",borderRadius:11,padding:"12px 8px",textAlign:"center",cursor:"pointer",border:`2px solid ${form.type===id?C.gold:"transparent"}`,transition:"all .2s"}}>
                  <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:tc}}>{label}</div>
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label req" style={{color:tc}}>التخصص</label>
              <input className={`input${darkMode?" input-dark":""}`} placeholder="مثال: سباكة وصرف صحي" value={form.specialty} onChange={e=>set("specialty",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label req" style={{color:tc}}>المحافظة</label>
              <select className={`select${darkMode?" select-dark":""}`} value={form.gov} onChange={e=>{set("gov",e.target.value);set("city","");setCustomCity(false);}}>
                <option value="">اختر المحافظة</option>
                {GOVERNORATES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{color:tc}}>المدينة / المركز</label>
              {!customCity && (
                <select className={`select${darkMode?" select-dark":""}`} value={form.city} onChange={e=>{ if(e.target.value==="أخرى"){ setCustomCity(true); set("city",""); } else { set("city",e.target.value); } }} disabled={!form.gov}>
                  <option value="">{form.gov?"اختر المدينة / المركز":"اختر المحافظة أولاً"}</option>
                  {getMarakez(form.gov).map(c=><option key={c} value={c}>{c}</option>)}
                  {form.gov&&<option value="أخرى">أخرى</option>}
                </select>
              )}
              {customCity&&(
                <div style={{display:"flex",gap:7}}>
                  <input className={`input${darkMode?" input-dark":""}`} placeholder="اكتب اسم المدينة/المركز" value={form.city} onChange={e=>set("city",e.target.value)} autoFocus/>
                  <button type="button" className="btn btn-outline" style={{flexShrink:0,padding:"0 12px"}} onClick={()=>{setCustomCity(false);set("city","");}}>رجوع</button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" style={{color:tc}}>سنوات الخبرة</label>
              <input className={`input${darkMode?" input-dark":""}`} type="number" min="0" placeholder="مثال: 5" value={form.experience} onChange={e=>set("experience",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label" style={{color:tc}}>نبذة تعريفية</label>
              <textarea className={`input${darkMode?" input-dark":""}`} placeholder="اكتب نبذة عن خبرتك..." value={form.bio} onChange={e=>set("bio",e.target.value)} rows={2}/>
            </div>
            <div style={{display:"flex",gap:9}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>setRegStep(1)}>→ السابق</button>
              <button className="btn btn-primary" style={{flex:2}} onClick={doSaveProfile} disabled={loading}>{loading?<Spinner size={15} color={C.navyDeep}/>:"التالي ←"}</button>
            </div>
          </>}

          {/* ── REGISTER STEP 3: Plan ── */}
          {mode==="register" && regStep===3 && <>
            <h2 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:14}}>اختر باقتك</h2>
            {Object.entries(PLANS).map(([key,pl])=>(
              <div key={key} onClick={()=>set("plan",key)} style={{background:form.plan===key&&key==="vip"?"linear-gradient(145deg,#1a0a3c,#2d1b69)":card,borderRadius:13,padding:13,marginBottom:8,cursor:"pointer",border:`2px solid ${form.plan===key?pl.color:darkMode?"rgba(201,168,76,.1)":C.grayLight}`,transition:"all .2s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <span className={`badge badge-${key}`}>{pl.label}</span>
                    {form.plan===key&&<span style={{color:pl.color}}>✓</span>}
                    {key==="starter"&&<span style={{fontSize:10,color:C.success,fontWeight:700}}>مجاني</span>}
                  </div>
                  <span style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:15,color:pl.color}}>{getPlanPrice(key,cfg)===0?"مجاني":getPlanPrice(key,cfg)+" ج/سنة"}</span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {pl.features.slice(0,3).map(f=><div key={f} style={{fontSize:10.5,color:form.plan===key&&key==="vip"?"rgba(255,255,255,.65)":sub,display:"flex",gap:4}}><span style={{color:pl.color}}>✓</span>{f}</div>)}
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:9,marginTop:5}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>setRegStep(2)}>→ السابق</button>
              <button className="btn btn-primary" style={{flex:2}} onClick={doChoosePlan}>{form.plan==="starter"?"تفعيل مجاني 🎉":"التالي للدفع ←"}</button>
            </div>
          </>}

          {/* ── REGISTER STEP 4: Payment ── */}
          {mode==="register" && regStep===4 && <>
            <h2 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:6}}>إتمام الدفع</h2>
            <div style={{background:"rgba(201,168,76,.07)",border:`1px solid rgba(201,168,76,.2)`,borderRadius:11,padding:13,marginBottom:14,textAlign:"center"}}>
              <div style={{color:sub,fontSize:12,marginBottom:3}}>باقة {PLANS[form.plan]?.label}</div>
              <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:22,color:C.gold}}>{getPlanPrice(form.plan,cfg)} جنيه/سنة</div>
            </div>
            <p style={{color:sub,fontSize:12.5,marginBottom:13,textAlign:"center"}}>اختر طريقة الدفع وسيتم تحويلك للواتساب لإتمام العملية</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:13}}>
              {[["فودافون كاش 📱"],["InstaPay 💳"],["فوري 🏪"],["بطاقة بنكية 💰"]].map(([m])=>(
                <button key={m} className="btn btn-outline" style={{padding:"12px 8px",fontSize:12.5,fontWeight:700}} onClick={()=>doPayment(m)}>{m}</button>
              ))}
            </div>
            <button className="btn btn-ghost" style={{width:"100%",fontSize:12,color:sub}} onClick={()=>setRegStep(3)}>→ العودة</button>
          </>}

          {/* Step 5 - Waiting for approval */}
          {mode==="register" && regStep===5 && <>
            <div style={{ textAlign:"center", padding:"30px 0" }}>
              <div style={{ fontSize:64, marginBottom:12 }}>⏳</div>
              <h2 style={{ fontFamily:"'Cairo'",fontWeight:900,fontSize:21,color:tc,marginBottom:8 }}>
                برجاء الانتظار
              </h2>
              <p style={{ color:sub,fontSize:13.5,lineHeight:1.9,marginBottom:20 }}>
                شكراً لتسجيلك في <strong>الدليل الشامل</strong>!<br/>
                سيتم تفعيل حسابك وظهورك في نتائج البحث<br/>
                فور سداد رسوم الاشتراك وتأكيد الإدارة.
              </p>
              <div style={{ background:`rgba(201,168,76,.08)`,border:`1px solid rgba(201,168,76,.2)`,borderRadius:13,padding:14,marginBottom:18,textAlign:"right" }}>
                <div style={{ fontFamily:"'Cairo'",fontWeight:700,color:tc,marginBottom:7,fontSize:13 }}>📋 بيانات التسجيل:</div>
                <div style={{ fontSize:12.5,color:sub,lineHeight:2 }}>
                  <div>👤 {form.name}</div>
                  <div>📱 {form.phone}</div>
                  {form.specialty && <div>🔧 {form.specialty}</div>}
                </div>
              </div>
              <button className="btn btn-primary btn-lg" style={{ width:"100%",marginBottom:9 }}
                onClick={()=>window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent("مرحباً، سجلت في الدليل الشامل باسم " + form.name + " ورقم " + form.phone + " وأريد سداد رسوم الاشتراك لتفعيل حسابي")}`)}>
                💬 تواصل مع الإدارة للدفع والتفعيل
              </button>
              <button className="btn btn-ghost btn-lg" style={{ width:"100%" }}
                onClick={()=>{ localStorage.setItem("daleel_user", JSON.stringify(createdUser)); onLogin(createdUser); }}>
                الدخول كزائر (تصفح فقط حتى التفعيل) ←
              </button>
            </div>
          </>}

        </div>
      </div>
      <LegalModal isOpen={showLegal} onClose={()=>setShowLegal(false)} darkMode={darkMode}/>
    </div>
  );
};

// ============================================================
// MEMBER CARD
// ============================================================
const MemberCard = ({ member, onClick, dark }) => {
  const ref = useRef(null);
  const visible = useIntersection(ref);
  const plan = getMemberPlan(member);
  const planInfo = PLANS[plan] || PLANS.starter;
  const planC = planInfo.color;
  // الباقات اللي بتستحق تأثير التوهج والحدود الذهبية/الملونة (كل باقة أعلى من أساسي)
  const glowing = ["premium","vip","company","elite"].includes(plan);

  return (
    <div ref={ref} onClick={()=>onClick(member)} style={{
      background:dark?C.cardBg:"white", borderRadius:16, overflow:"hidden",
      border:`1px solid ${glowing?`${planC}33`:dark?"rgba(201,168,76,.1)":C.grayLight}`,
      boxShadow: glowing?`0 4px 18px ${planC}1a`:"0 2px 12px rgba(13,31,60,.06)",
      cursor:"pointer", opacity:visible?1:0, transform:visible?"translateY(0)":"translateY(14px)",
      transition:"all .38s ease",
      animation: glowing ? "premiumGlow 3s ease-in-out infinite" : "none"
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow=glowing?`0 10px 28px ${planC}3a`:"0 10px 28px rgba(13,31,60,.14)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=glowing?`0 4px 18px ${planC}1a`:"0 2px 12px rgba(13,31,60,.06)";}}
    >
      {glowing && <div style={{height:2.5,background:`linear-gradient(90deg,${planC},${planC}cc,${planC})`,animation:"premiumFlash 1.8s ease-in-out infinite"}}/>}
      <div style={{padding:13}}>
        <div style={{display:"flex",gap:9,marginBottom:9}}>
          <Av text={member.name} size={48} type={plan} src={member.avatarUrl} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Cairo'",fontWeight:700,fontSize:13.5,color:dark?"white":C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {member.badge&&<span>{member.badge} </span>}{member.name}{member.verified&&<span title="موثق"> ✅</span>}
            </div>
            <div style={{fontSize:11,color:C.gray,marginBottom:4}}>🔧 {member.specialty}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <span className={`badge badge-${plan}`} style={{fontSize:9.5}}>{planInfo.label}</span>
              <span style={{fontSize:10.5,color:C.gray}}>📍 {member.gov}</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:4,alignItems:"center"}}><StarRating rating={member.rating} size={12}/><span style={{fontSize:11.5,fontWeight:700,color:C.gold}}>{member.rating}</span><span style={{fontSize:10.5,color:C.gray}}>({member.reviews})</span></div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <span style={{fontSize:10.5,color:C.gray}}>👁 {(member.views||0)>999?`${((member.views||0)/1000).toFixed(1)}ك`:member.views||0}</span>
            {member.followers > 0 && <span style={{fontSize:10.5,color:C.gold,fontWeight:700}}>👥 {member.followers}</span>}
          </div>
        </div>
      </div>
      <div style={{display:"flex",borderTop:`1px solid ${dark?"rgba(255,255,255,.05)":"#F5F5F5"}`}}>
        <button className="btn btn-primary btn-sm" style={{flex:1,borderRadius:"0 0 16px 0",padding:"8px 0",fontSize:11.5}}
          onClick={e=>{e.stopPropagation();DB.trackStat(member.id,"waMessages");window.open(`https://wa.me/2${member.phone}?text=${encodeURIComponent("مرحباً " + member.name + "، وجدتك في الدليل الشامل وأريد الاستفسار عن خدماتك")}`);}}>💬 واتساب</button>
        <button className="btn btn-navy btn-sm" style={{flex:1,borderRadius:"0 0 0 16px",padding:"8px 0",fontSize:11.5,borderTop:"none",borderRight:`1px solid ${dark?"rgba(255,255,255,.05)":"#F0F0F0"}`}}
          onClick={e=>{e.stopPropagation();DB.trackStat(member.id,"calls");window.open(`tel:${member.phone}`);}}>📞 اتصال</button>
      </div>
    </div>
  );
};

// بطاقة "شركاؤنا وشركاء النخبة" — تصميم أفخم ومختلف تمامًا عن كارت الأعضاء العادي (PartnerCard)
// مخصصة لباقتي company و elite بس، عشان تدي إحساس واضح إن دول مستوى تاني خالص
const PartnerCard = ({ member, onClick, dark }) => {
  const ref = useRef(null);
  const visible = useIntersection(ref);
  const plan = getMemberPlan(member);
  const planInfo = PLANS[plan] || PLANS.company;
  const planC = planInfo.color;
  const isElite = plan === "elite";

  return (
    <div ref={ref} onClick={()=>onClick(member)} style={{
      position:"relative",
      background: isElite
        ? `linear-gradient(155deg,${dark?"#1a1206":"#FFFBEB"},${dark?C.cardBg:"white"})`
        : (dark?C.cardBg:"white"),
      borderRadius:18, overflow:"hidden", cursor:"pointer",
      border:`1.5px solid ${planC}55`,
      boxShadow:`0 6px 22px ${planC}26`,
      opacity:visible?1:0, transform:visible?"translateY(0)":"translateY(14px)",
      transition:"all .38s ease",
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow=`0 14px 32px ${planC}45`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=`0 6px 22px ${planC}26`;}}
    >
      <div style={{height:3,background:`linear-gradient(90deg,${planC},${isElite?"#FBBF24":planC}cc,${planC})`,animation:"premiumFlash 1.8s ease-in-out infinite"}}/>
      {/* شارة المستوى أعلى الكارت */}
      <div style={{position:"absolute",top:10,left:10,background:planC,color:"white",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:20,display:"flex",alignItems:"center",gap:3,boxShadow:`0 2px 8px ${planC}55`}}>
        {isElite ? "👑 شريك نخبة" : "🏢 شركة موثقة"}
      </div>
      <div style={{padding:"30px 14px 13px"}}>
        <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
          <div style={{position:"relative"}}>
            <Av text={member.name} size={56} type={plan} src={member.avatarUrl} />
            <div style={{position:"absolute",inset:-3,borderRadius:"50%",border:`2px solid ${planC}`,animation:"premiumPulse 2s ease-in-out infinite"}}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:14.5,color:dark?"white":C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {member.name}{member.verified&&<span title="موثق"> ✅</span>}
            </div>
            <div style={{fontSize:11.5,color:C.gray,marginBottom:4}}>🔧 {member.specialty}</div>
            <span style={{fontSize:10.5,color:C.gray}}>📍 {member.gov}</span>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:4,alignItems:"center"}}><StarRating rating={member.rating} size={12}/><span style={{fontSize:11.5,fontWeight:700,color:planC}}>{member.rating}</span><span style={{fontSize:10.5,color:C.gray}}>({member.reviews})</span></div>
          {member.followers > 0 && <span style={{fontSize:10.5,color:planC,fontWeight:700}}>👥 {member.followers}</span>}
        </div>
      </div>
      <div style={{display:"flex",borderTop:`1px solid ${dark?"rgba(255,255,255,.06)":"#F5F5F5"}`}}>
        <button className="btn btn-sm" style={{flex:1,borderRadius:"0 0 18px 0",padding:"9px 0",fontSize:11.5,background:planC,color:"white",border:"none",fontWeight:700}}
          onClick={e=>{e.stopPropagation();DB.trackStat(member.id,"waMessages");window.open(`https://wa.me/2${member.phone}?text=${encodeURIComponent("مرحباً " + member.name + "، وجدتك في الدليل الشامل وأريد الاستفسار عن خدماتك")}`);}}>💬 واتساب</button>
        <button className="btn btn-navy btn-sm" style={{flex:1,borderRadius:"0 0 0 18px",padding:"9px 0",fontSize:11.5,borderTop:"none",borderRight:`1px solid ${dark?"rgba(255,255,255,.06)":"#F0F0F0"}`}}
          onClick={e=>{e.stopPropagation();DB.trackStat(member.id,"calls");window.open(`tel:${member.phone}`);}}>📞 اتصال</button>
      </div>
    </div>
  );
};

// ============================================================
// HOME SCREEN
// ============================================================
// ============================================================
// MOCK ADS DATA
// ============================================================
const MOCK_ADS = [
  { id:"a1", type:"hero", title:"مؤسسة الإعمار للتوريدات", desc:"أفضل مواد البناء • أسعار الجملة • توصيل لجميع المحافظات", emoji:"🏢", phone:"01110001986", color1:C.navy, color2:C.navyLight, badge:"إعلان مميز" },
  { id:"a2", type:"card", title:"شركة النيل للمقاولات", desc:"خصم 15% على التشطيب الكامل طوال يوليو", emoji:"🏢", phone:"01110001986", color1:"#1a0a3c", color2:"#2d1b69", badge:"عرض خاص" },
  { id:"a3", type:"banner", title:"مواد البناء جملة وقطاعي", desc:"طوب • رمل • زلط • أسمنت • حديد بأسعار لا تُنافس", emoji:"📦", phone:"01110001986", color1:"#0f2027", color2:"#203a43", badge:"توصيل مجاني" },
];

// ============================================================
// ADD POST MODAL
// ============================================================
const AddPostModal = ({ user, onClose, onPost, darkMode }) => {
  const cfg = useConfig();
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [memberInfo, setMemberInfo] = useState(null);
  const [postCount, setPostCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const card = darkMode ? C.navy : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;

  // كان بيقرا member.type (التصنيف المهني زي "صنايعي") على إنه الباقة، فكانت حدود النشر
  // والفيديو بتتحسب غلط لكل عضو. getMemberPlan بترجع الباقة الحقيقية (plan) بشكل صحيح
  const memberType = getMemberPlan(memberInfo);
  const postLimit = getPostLimit(memberType, cfg);
  const videoLimit = getVideoLimit(memberType, cfg);
  const remainingPosts = Math.max(0, postLimit - postCount);
  const canPost = remainingPosts > 0;
  const canAddVideo = videoLimit > 0 && videoCount < videoLimit;

  useEffect(() => {
    if (!user?.uid) { setLoadingLimits(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "members", user.uid));
        const m = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setMemberInfo(m);
        const userPosts = await DB.getUserPosts(user.uid);
        // حد المنشورات شهري وبيتصفّر تلقائي أول كل شهر ميلادي — بنعدّ بس منشورات الشهر الحالي،
        // مش كل المنشورات اللي اتعملت من الأول (اللي كان ثابت العضو يوصل له مرة واحدة ويقف للأبد)
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        const postsThisMonth = userPosts.filter(p => {
          const t = p.time?.toMillis?.() ?? (p.time?.seconds ? p.time.seconds*1000 : new Date(p.time).getTime());
          return t >= startOfMonth;
        });
        setPostCount(postsThisMonth.length);
        // الفيديو التعريفي مختلف عن المنشورات — مسموح مرة واحدة إجمالاً حسب الباقة، مش شهري
        setVideoCount(userPosts.filter(p => p.video).length);
      } catch (e) { console.error(e); }
      setLoadingLimits(false);
    })();
  }, [user?.uid]);

  const previewsRef = useRef(previews);
  const videoPreviewRef = useRef(videoPreview);
  previewsRef.current = previews;
  videoPreviewRef.current = videoPreview;

  const handleImages = (e) => {
    previews.forEach(u => URL.revokeObjectURL(u)); // نحرر معاينات الصور القديمة قبل ما نستبدلها
    const files = Array.from(e.target.files).slice(0, 4);
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const MAX_VIDEO_MB = 80;
  const handleVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canAddVideo) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`⚠️ حجم الفيديو كبير أوي (${(file.size/1024/1024).toFixed(0)} ميجا). الحد الأقصى ${MAX_VIDEO_MB} ميجا — جرب تصغّر حجمه أو تختار مقطع أقصر.`);
      if (videoRef.current) videoRef.current.value = "";
      return;
    }
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };
  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideo(null); setVideoPreview(null); if (videoRef.current) videoRef.current.value = "";
  };

  // تنظيف كل معاينات الصور/الفيديو لو المودال اتقفل من غير نشر — بنستخدم refs عشان نمسك آخر قيمة وقت الإغلاق
  useEffect(() => () => {
    previewsRef.current.forEach(u => URL.revokeObjectURL(u));
    if (videoPreviewRef.current) URL.revokeObjectURL(videoPreviewRef.current);
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() || !canPost) return;
    setSubmitting(true);
    try {
      // رفع الصور بعد تحجيمها لتقليل الحجم وتسريع التحميل
      const imageUrls = [];
      if (images.length) {
        setUploadMsg("📸 جاري رفع الصور...");
        for (let i = 0; i < images.length; i++) {
          const blob = await resizeImageMax(images[i], 1280, 0.84);
          const url = await uploadBlobToStorage(blob, `postImages/${user?.uid || "anon"}/${Date.now()}_${i}.jpg`);
          imageUrls.push(url);
        }
      }
      let videoUrl = "";
      if (video && canAddVideo) {
        setUploadMsg("🎬 جاري رفع الفيديو...");
        videoUrl = await uploadBlobToStorage(video, `postVideos/${user?.uid || "anon"}/${Date.now()}_${video.name || "video"}`);
      }
      setUploadMsg("");
      const postData = {
        authorId: user?.uid || "me",
        author: memberInfo?.name || user?.displayName || "مستخدم",
        avatar: (memberInfo?.name || user?.displayName || "م")[0],
        specialty: memberInfo?.specialty || "عضو",
        time: new Date(),
        content: text,
        likes: 0, comments: 0, shares: 0,
        type: memberType,
        images: imageUrls,
        video: videoUrl || null,
      };
      const ref = await addDoc(collection(db,"posts"), postData);
      onPost({ id: ref.id, ...postData, time: Date.now() });
      setPostCount(p => p + 1);
      setSubmitting(false);
      setUploadMsg("");
      onClose(); // يقفل بس لما النشر ينجح فعلاً
    } catch(e) {
      console.error(e);
      alert("❌ حدث خطأ أثناء النشر: " + e.message);
      setSubmitting(false);
      setUploadMsg("");
      // مانقفلش المودال هنا — عشان المستخدم يقدر يعيد المحاولة من غير ما يفقد النص والصور
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" style={{ background: card }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ padding: "14px 18px 28px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "'Cairo'", fontWeight: 800, fontSize: 17, color: tc }}>📝 منشور جديد</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: sub }}>✕</button>
          </div>

          {/* User Info */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <Av text={memberInfo?.name || user?.displayName || "م"} size={42} type={memberType} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: tc }}>{memberInfo?.name || user?.displayName || "مستخدم"}</div>
              <div style={{ fontSize: 11, color: sub }}>🌍 عام • يظهر للجميع</div>
            </div>
          </div>

          {loadingLimits ? (
            <div style={{ textAlign:"center", padding:"24px 0" }}><Spinner size={18} color={C.gold}/></div>
          ) : !canPost ? (
            <div style={{ textAlign:"center", padding:"22px 14px", background: darkMode?"rgba(239,68,68,.08)":"rgba(239,68,68,.06)", border:`1px solid ${C.error}33`, borderRadius:13, marginBottom: 8 }}>
              <div style={{ fontSize: 38, marginBottom: 8 }}>🚫</div>
              <div style={{ color: tc, fontWeight: 700, fontSize: 14, marginBottom: 5 }}>
                {postLimit === 0 ? "ميزة النشر غير متاحة في باقتك الحالية" : "وصلت للحد الأقصى من المنشورات لهذا الشهر"}
              </div>
              <div style={{ color: sub, fontSize: 12, marginBottom: 12 }}>
                {postLimit === 0 ? "قم بترقية اشتراكك لتتمكن من نشر منشوراتك وأعمالك." : `باقتك (${PLANS[memberType]?.label || memberType}) تسمح بـ ${postLimit} منشور شهريًا. حد النشر بيتجدد أول كل شهر، أو قم بالترقية لنشر المزيد.`}
              </div>
              <button className="btn btn-primary btn-sm" onClick={onClose}>⭐ ترقية الاشتراك</button>
            </div>
          ) : (
            <>
              {/* Remaining posts indicator */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background: darkMode?"rgba(201,168,76,.07)":"rgba(201,168,76,.08)", border:`1px solid rgba(201,168,76,.2)`, borderRadius: 9, padding:"6px 11px", marginBottom: 10, fontSize: 11 }}>
                <span style={{ color: C.gold, fontWeight: 700 }}>متبقي لك {remainingPosts} من {postLimit} منشور هذا الشهر</span>
                <span style={{ color: sub }}>{PLANS[memberType]?.label || memberType}</span>
              </div>

              {/* Text Input */}
              <textarea
                className={`input${darkMode ? " input-dark" : ""}`}
                placeholder="شارك خبرتك، عمل جديد، عرض أو نصيحة..."
                value={text}
                onChange={e => setText(e.target.value)}
                rows={5}
                autoFocus
                style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 10 }}
              />

              {/* Image Previews */}
              {previews.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: previews.length === 1 ? "1fr" : "1fr 1fr", gap: 4, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                  {previews.map((src, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={src} alt="" style={{ width: "100%", aspectRatio: previews.length === 1 ? "16/9" : "1", objectFit: "cover" }} />
                      <button onClick={() => { setPreviews(p => p.filter((_,j)=>j!==i)); setImages(p => p.filter((_,j)=>j!==i)); }}
                        style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,.6)", border: "none", borderRadius: "50%", width: 22, height: 22, color: "white", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Video Preview */}
              {videoPreview && (
                <div style={{ position:"relative", marginBottom: 10, borderRadius: 10, overflow:"hidden" }}>
                  <video src={videoPreview} controls style={{ width:"100%", maxHeight: 220, background:"#000" }} />
                  <button onClick={removeVideo} style={{ position: "absolute", top: 7, left: 7, background: "rgba(0,0,0,.65)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "white", cursor: "pointer", fontSize: 13 }}>✕</button>
                </div>
              )}

              {/* Actions Row */}
              <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
                <button onClick={() => fileRef.current?.click()} style={{ background: "rgba(201,168,76,.1)", border: "1px solid rgba(201,168,76,.2)", borderRadius: 9, padding: "7px 13px", cursor: "pointer", color: C.gold, fontSize: 12.5, fontFamily: "'Tajawal'", fontWeight: 600 }}>
                  📸 صورة
                </button>
                <input type="file" ref={fileRef} accept="image/*" multiple style={{ display: "none" }} onChange={handleImages} />
                {videoLimit > 0 && (
                  <button onClick={() => canAddVideo && !video ? videoRef.current?.click() : null} disabled={!canAddVideo || !!video}
                    title={!canAddVideo ? `باقتك تسمح بحد أقصى ${videoLimit} فيديو` : ""}
                    style={{ background: "rgba(124,58,237,.1)", border: "1px solid rgba(124,58,237,.2)", borderRadius: 9, padding: "7px 13px", cursor: (!canAddVideo || video) ? "not-allowed" : "pointer", opacity: (!canAddVideo || video) ? .5 : 1, color: C.purple, fontSize: 12.5, fontFamily: "'Tajawal'", fontWeight: 600 }}>
                    🎬 فيديو {videoLimit > 0 && `(${videoCount}/${videoLimit})`}
                  </button>
                )}
                <input type="file" ref={videoRef} accept="video/*" style={{ display: "none" }} onChange={handleVideo} />
                <button onClick={() => setText(t => t + (t && !t.endsWith(" ") ? " " : "") + "📍 الموقع: ")} style={{ background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.2)", borderRadius: 9, padding: "7px 13px", cursor: "pointer", color: C.info, fontSize: 12.5, fontFamily: "'Tajawal'", fontWeight: 600 }}>
                  📍 الموقع
                </button>
                <button onClick={() => setText(t => t + (t && !t.endsWith(" ") ? " " : "") + "💰 السعر: ")} style={{ background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 9, padding: "7px 13px", cursor: "pointer", color: C.success, fontSize: 12.5, fontFamily: "'Tajawal'", fontWeight: 600 }}>
                  💰 عرض سعر
                </button>
              </div>

              {/* Character count */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: sub }}>{text.length}/500 حرف</span>
                {text.length > 0 && <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2.5px solid ${text.length > 400 ? C.error : C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: text.length > 400 ? C.error : C.gold }}>{500 - text.length}</div>}
              </div>

              <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={handleSubmit} disabled={!text.trim() || submitting || text.length > 500}>
                {submitting ? <><Spinner size={16} color={C.navyDeep} /> {uploadMsg || "جاري النشر..."}</> : "نشر المنشور 🚀"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SAVED MEMBERS SCREEN (المحفوظات)
// ============================================================
const SavedScreen = ({ onMemberClick, darkMode, currentUser, onRequireAuth, refreshTrigger }) => {
  const isDesktop = useIsDesktop();
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;

  const loadSaved = async () => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const members = await DB.getSavedMembers(currentUser.uid);
    setSaved(members);
    setLoading(false);
  };

  useEffect(() => {
    loadSaved();
  }, [currentUser?.uid, refreshTrigger]);

  if (!currentUser) return onRequireAuth?.();

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:bg}}><div style={{fontSize:30}}>⏳</div></div>;

  return (
    <div style={{background:bg,minHeight:"100vh",paddingBottom:80,padding:isDesktop?"14px 0":"14px 16px"}}>
      <div className={isDesktop?"desktop-container":undefined}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:18,color:tc}}>❤️ المحفوظة</h2>
          <div style={{color:sub,fontSize:12}}>{saved.length} عضو محفوظ</div>
        </div>
        <button onClick={loadSaved} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.gold}}>🔄</button>
      </div>

      {saved.length === 0 ? (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:11}}>
          <div style={{fontSize:50}}>💔</div>
          <div style={{color:tc,fontWeight:700,fontSize:14}}>لا توجد أعضاء محفوظة</div>
          <div style={{color:sub,fontSize:12,textAlign:"center"}}>ابدأ بحفظ الصنايعيين اللي عجبتك!</div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr",gap:9}}>
          {saved.map(member => (
            <div
              key={member.id}
              onClick={() => onMemberClick?.(member)}
              style={{
                background: card,
                borderRadius: 13,
                padding: 12,
                display: "flex",
                gap: 10,
                cursor: "pointer",
                border: `1px solid ${darkMode ? "rgba(201,168,76,.1)" : C.grayLight}`,
                transition: "all .2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <Av text={member.name} size={50} type={getMemberPlan(member)} src={member.avatarUrl} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                  <div style={{fontWeight:700,fontSize:14,color:tc}}>{member.name}</div>
                  {{elite:"👑",company:"🏢",vip:"⭐",premium:"✨"}[getMemberPlan(member)] && <span style={{fontSize:14}}>{{elite:"👑",company:"🏢",vip:"⭐",premium:"✨"}[getMemberPlan(member)]}</span>}
                </div>
                <div style={{color:sub,fontSize:11.5}}>🔧 {member.specialty}</div>
                <div style={{color:sub,fontSize:11,marginTop:3,display:"flex",gap:7}}>
                  <span>📍 {member.gov} - {member.city}</span>
                  {member.followers > 0 && <span style={{color:C.gold,fontWeight:700}}>👥 {member.followers}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

// ============================================================
// AD 3D CARD — إعلان بشكل بطاقة ثلاثية الأبعاد
// بتتمايل مع حركة الماوس (desktop) + لمعة زجاجية بتتحرك مع زاوية الميل + ظل
// متعدد الطبقات يدي إحساس إن البطاقة طافية فوق الصفحة، وضغطة بسيطة عند اللمس
// ============================================================
const Ad3DCard = ({ ad, variant="hero", darkMode, style }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);
  const cardRef = useRef(null);

  const handleMove = (e) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const maxTilt = variant === "hero" ? 5 : 7;
    setTilt({ x: (py - 0.5) * -2 * maxTilt, y: (px - 0.5) * 2 * maxTilt });
  };
  const resetTilt = () => setTilt({ x: 0, y: 0 });

  const sizes = {
    hero:   { minHeight:130, padY:"20px 18px 16px", titleSize:18,   descSize:12.5, emojiSize:110, radius:18 },
    small:  { minHeight:120, padY:"14px 13px",       titleSize:13,   descSize:10.5, emojiSize:65,  radius:14 },
    inline: { minHeight:125, padY:"16px 14px",       titleSize:14,   descSize:11.5, emojiSize:65,  radius:14 },
  };
  const s = sizes[variant] || sizes.hero;
  const shadowDepth = 10 + Math.abs(tilt.x) + Math.abs(tilt.y);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={resetTilt}
      onMouseDown={()=>setPressed(true)}
      onMouseUp={()=>setPressed(false)}
      onTouchStart={()=>setPressed(true)}
      onTouchEnd={()=>setPressed(false)}
      onClick={() => window.open(`tel:${ad.phone||"201110001986"}`)}
      style={{
        position:"relative", borderRadius:s.radius, overflow:"hidden", cursor:"pointer",
        minHeight:s.minHeight,
        transform:`perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${pressed?0.97:1})`,
        transition: pressed ? "transform .12s ease, box-shadow .12s ease" : "transform .4s cubic-bezier(.22,1,.36,1), box-shadow .4s ease",
        boxShadow: darkMode
          ? `0 ${shadowDepth}px ${shadowDepth*2.6}px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)`
          : `0 ${shadowDepth}px ${shadowDepth*2.6}px rgba(10,22,40,.22), 0 2px 6px rgba(10,22,40,.12), inset 0 1px 0 rgba(255,255,255,.4)`,
        ...style,
      }}
    >
      {/* أي صورة إعلان بتتظبط تلقائيًا مهما كان مقاسها: خلفية مكبّرة ومموّهة تملى الكارت،
          والصورة الحقيقية كاملة من غير قص فوقها في النص */}
      {ad.imageUrl && (
        <>
          <div style={{ position:"absolute", inset:0, backgroundImage:`url(${ad.imageUrl})`, backgroundSize:"cover", backgroundPosition:"center", filter:"blur(14px) brightness(.6)", transform:"scale(1.15)", zIndex:0 }}/>
          <div style={{ position:"absolute", inset:0, backgroundImage:`url(${ad.imageUrl})`, backgroundSize:"contain", backgroundRepeat:"no-repeat", backgroundPosition:"center", zIndex:0 }}/>
        </>
      )}
      <div style={{
        background: !ad.imageUrl ? `linear-gradient(135deg,${ad.color1||C.navy},${ad.color2||C.navyLight})` : `linear-gradient(0deg, rgba(0,0,0,.75) 0%, rgba(0,0,0,.4) 55%, rgba(0,0,0,.2) 100%)`,
        padding:s.padY, position:"relative", zIndex:1, minHeight:s.minHeight,
        display:"flex", flexDirection:"column", justifyContent:"space-between",
      }}>
        {/* لمعة زجاجية بتتحرك مع زاوية الميل — هي اللي بتدي إحساس السطح المصقول/الزجاجي */}
        <div style={{
          position:"absolute", inset:0, zIndex:2, pointerEvents:"none",
          background:`linear-gradient(${115+tilt.y*3}deg, rgba(255,255,255,${.15+Math.abs(tilt.x)/110}) 0%, transparent 40%, transparent 62%, rgba(255,255,255,.04) 100%)`,
        }}/>
        {!ad.imageUrl && <div style={{ position:"absolute", top:-10, left:-10, fontSize:s.emojiSize, opacity:.08, transform:"rotate(-15deg)" }}>{ad.emoji||"🏢"}</div>}
        <div style={{ position:"relative", zIndex:3 }}>
          <span style={{ background:"rgba(201,168,76,.28)", color:C.gold, fontSize:variant==="hero"?9.5:variant==="inline"?9:8.5, fontWeight:700, padding:variant==="hero"?"2px 9px":"2px 8px", borderRadius:20, display:"inline-block", marginBottom:variant==="hero"?7:5, border:`1px solid rgba(201,168,76,.4)` }}>📢 {ad.badge||"إعلان"}</span>
          <div style={{ color:"white", fontFamily:"'Cairo'", fontSize:s.titleSize, fontWeight:variant==="hero"?900:800, marginBottom:variant==="hero"?4:3, lineHeight:1.3, textShadow:"0 2px 8px rgba(0,0,0,.55)" }}>{ad.title}</div>
          <div style={{ color:"rgba(255,255,255,.85)", fontSize:s.descSize, lineHeight:1.5, marginBottom:variant==="hero"?14:7, textShadow:"0 1px 4px rgba(0,0,0,.5)" }}>
            {variant==="hero" ? (ad.desc||"تواصل معنا للإعلان") : (ad.desc||"").split("•")[0]}
          </div>
        </div>
        <div style={{ position:"relative", zIndex:3 }}>
          {variant==="hero" ? (
            <button className="btn btn-primary btn-sm" style={{boxShadow:"0 4px 14px rgba(201,168,76,.4)"}} onClick={(e)=>{e.stopPropagation(); window.open(`tel:${ad.phone||"201110001986"}`)}}>تواصل الآن 📞</button>
          ) : (
            <div style={{ background:"rgba(201,168,76,.28)", border:`1px solid rgba(201,168,76,.45)`, borderRadius:8, padding:"5px 9px", display:"inline-flex", alignItems:"center", gap:4, color:C.gold, fontSize:variant==="inline"?10.5:10, fontWeight:700 }}>
              📞 {variant==="inline" ? (ad.phone||"اتصل") : "اتصل"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// بانر "احجز مساحتك الإعلانية" — بقى Component منفصل عشان نقدر نعرضه في أماكن مختلفة
// من الصفحة الرئيسية (مكانه بيتغير عشوائيًا كل تحميل بدل ما يفضل ثابت في نفس المكان)
const PromoBanner = ({ cfg }) => (
  <div className="section" style={{ paddingTop: 0 }}>
    <div style={{ background: `linear-gradient(135deg,#1a0a3c,#2d1b69)`, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.purple}33`, display: "flex", gap: 13, alignItems: "center", animation:"fadeIn .35s ease" }}>
      <div style={{ width: 52, height: 52, borderRadius: 13, background: "rgba(201,168,76,.15)", border: `1px solid rgba(201,168,76,.25)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>✨</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.gold, fontSize: 9.5, fontWeight: 700, marginBottom: 2 }}>📢 إعلان داخل الصفحة</div>
        <div style={{ color: "white", fontFamily: "'Cairo'", fontWeight: 800, fontSize: 13.5, marginBottom: 2 }}>احجز مساحتك الإعلانية</div>
        <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11 }}>وصول لآلاف المهنيين يومياً</div>
      </div>
      <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={()=>window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent("مرحباً، أريد حجز مساحة إعلانية في الدليل الشامل")}`)} >احجز الآن</button>
    </div>
  </div>
);

// ============================================================
// HOME SCREEN — with Ads System + Post Creation
// ============================================================
const HomeScreen = ({ onNavigate, onMemberClick, darkMode, user, onRequireAuth }) => {
  const cfg = useConfig();
  const isDesktop = useIsDesktop();
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postsCursor, setPostsCursor] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [realStats, setRealStats] = useState([["0+","عضو مسجل"],["16+","تخصص"],["4.8★","تقييم"],["...","زيارة"]]);
  const [homeAds, setHomeAds] = useState(MOCK_ADS);
  const [heroAdIdx, setHeroAdIdx] = useState(0); // إعلان الهيرو بيتغير مش ثابت على أول عنصر
  const [promoSlot, setPromoSlot] = useState(0); // مكان بانر "احجز مساحتك" بيتغير مكانه كل تحميل
  const [showAddPost, setShowAddPost] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.48)" : C.gray;
  const tAgo = t => { const d=(Date.now()-(typeof t==="number"?t:t?.toMillis?.()||Date.now()))/1000; if(d<60)return"الآن";if(d<3600)return`${Math.floor(d/60)} د`;if(d<86400)return`${Math.floor(d/3600)} س`;return`${Math.floor(d/86400)} يوم`; };

  const loadData = () => {
    setLoading(true);
    DB.getMembers().then(m => {
      setMembers(m);
      setLoading(false);
      setRealStats(p => [[`${m.length}+`,"عضو مسجل"],["16+","تخصص"],["4.8★","تقييم"], p[3]]);
    }).catch(()=>setLoading(false));
    DB.getPosts().then(({ posts, lastDoc, hasMore }) => {
      setPosts(posts);
      setPostsCursor(lastDoc);
      setHasMorePosts(hasMore);
    }).catch(()=>{});
    DB.getSiteVisits().then(v => setRealStats(p => [p[0],p[1],p[2],[v.toLocaleString(),"زيارة"]])).catch(()=>{});
  };

  // تحميل الدفعة التالية من المنشورات (تحميل المزيد) — بيبدأ من آخر منشور اتجاب في الدفعة اللي قبلها
  const loadMorePosts = () => {
    if (loadingMorePosts || !hasMorePosts || !postsCursor) return;
    setLoadingMorePosts(true);
    DB.getPosts(postsCursor).then(({ posts: more, lastDoc, hasMore }) => {
      setPosts(p => [...p, ...more]);
      setPostsCursor(lastDoc);
      setHasMorePosts(hasMore);
      setLoadingMorePosts(false);
    }).catch(() => setLoadingMorePosts(false));
  };

  // onSnapshot للإعلانات — تتحدث فوراً لما الأدمن يضيف أو يغير
  useEffect(() => {
    loadData();
    // كل تحميل للصفحة، بانر "احجز مساحتك" يظهر في مكان مختلف (0 = بعد الأقسام، 1 = بعد الأعضاء المميزين، 2 = جوه الفيد)
    setPromoSlot(Math.floor(Math.random()*3));
    const unsub = onSnapshot(
      query(collection(db,"ads"), where("status","==","active")),
      snap => { if (!snap.empty) setHomeAds(snap.docs.map(d=>({id:d.id,...d.data()}))); },
      () => {}
    );
    return unsub;
  }, []);

  // الإعلان الكبير (Hero) بيدور تلقائيًا بين كل الإعلانات المتاحة كل شوية، بدل ما يفضل ثابت على نفس الإعلان
  useEffect(() => {
    if (homeAds.length <= 1) { setHeroAdIdx(0); return; }
    setHeroAdIdx(i => i % homeAds.length);
    const t = setInterval(() => setHeroAdIdx(i => (i + 1) % homeAds.length), 6000);
    return () => clearInterval(t);
  }, [homeAds.length]);

  // عدد الإشعارات الحقيقي بدل الرقم الثابت
  useEffect(() => {
    if (!user?.uid) { setUnreadNotifCount(0); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db,"members",user.uid));
        const memberType = snap.exists() ? getMemberPlan(snap.data()) : "starter";
        const n = await DB.getNotifications(user.uid, memberType);
        setUnreadNotifCount(n.filter(x=>!DB.isNotifRead(x, user.uid)).length);
      } catch { setUnreadNotifCount(0); }
    })();
  }, [user?.uid]);

  const toggleLike = (post) => {
    if (!user) return onRequireAuth();
    const uid = user.uid;
    const alreadyLiked = (post.likedBy||[]).includes(uid);
    // تحديث تفاؤلي فوري على المنشور نفسه (مش على متغير منفصل) عشان الحالة تفضل صح حتى بعد Refresh،
    // لأن أي تحديث جديد للمنشورات هيجيب likedBy الحقيقي من Firestore أصلاً
    setPosts(p => p.map(x => x.id===post.id ? {
      ...x,
      likedBy: alreadyLiked ? (x.likedBy||[]).filter(id=>id!==uid) : [...(x.likedBy||[]), uid],
      likes: alreadyLiked ? Math.max(0,(x.likes||1)-1) : (x.likes||0)+1,
    } : x));
    DB.likePost(post.id, uid);
  };

  const handleAddPost = () => {
    if (!user) return onRequireAuth();
    setShowAddPost(true);
  };

  const handleNewPost = (post) => {
    setPosts(p => [post, ...p]);
  };

  const planBadgeColor = { vip: C.purple, premium: C.gold, basic: C.info, starter: "#0EA5E9" };

  // بوست واحد من عضو VIP/مميز (لو موجود ونشر في آخر 3 أيام) بيتصدّر الفيد كـ "منشور مُروَّج"،
  // ده حافز حقيقي للأعضاء إنهم يرقّوا اشتراكهم — من غير ما نبوظ ترتيب باقي المنشورات
  const displayPosts = useMemo(() => {
    const THREE_DAYS = 3*86400000;
    const now = Date.now();
    const boostIdx = posts.findIndex(p => ["elite","company","vip","premium"].includes(getMemberPlan(p)) && (now - (typeof p.time==="number"?p.time:p.time?.toMillis?.()||0)) < THREE_DAYS);
    if (boostIdx <= 0) return posts.map(p => ({...p, boosted:false}));
    const boosted = { ...posts[boostIdx], boosted:true };
    return [boosted, ...posts.slice(0,boostIdx), ...posts.slice(boostIdx+1)];
  }, [posts]);

  const [refreshing, setRefreshing] = useState(false);
  const [touchY0, setTouchY0] = useState(null);
  const [pullD, setPullD] = useState(0);
  const onTS = e => setTouchY0(e.touches[0].clientY);
  const onTM = e => { if(!touchY0||window.scrollY>0) return; const d=e.touches[0].clientY-touchY0; if(d>0) setPullD(Math.min(d,65)); };
  const onTE = async () => { if(pullD>50){setRefreshing(true);await loadData();setRefreshing(false);} setPullD(0);setTouchY0(null); };

  const adsBlock = homeAds.length > 0 ? (
      <div className={isDesktop?"desktop-container":"section"} style={{ paddingBottom: 0, paddingTop: isDesktop?36:undefined }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: isDesktop?15:11 }}>
          <div><div className="section-title" style={{ color: tc, fontSize:isDesktop?22:19 }}>📢 مساحات إعلانية</div><div className="gold-line" /></div>
          {homeAds.length>1 && <span style={{color:sub,fontSize:11.5}}>يتغيّر تلقائيًا</span>}
        </div>
        {isDesktop ? (
          <div className="desktop-ads-grid">
            <div style={{position:"relative"}}>
              <Ad3DCard key={homeAds[heroAdIdx]?.id} ad={homeAds[heroAdIdx]} variant="hero" darkMode={darkMode} style={{animation:"fadeIn .4s ease",minHeight:220}}/>
              {homeAds.length > 1 && (
                <div style={{ display:"flex", justifyContent:"center", gap:5, marginTop:9 }}>
                  {homeAds.map((ad,i)=>(
                    <div key={ad.id} onClick={()=>setHeroAdIdx(i)} style={{ width: i===heroAdIdx?16:6, height:6, borderRadius:3, background: i===heroAdIdx?C.gold:(darkMode?"rgba(255,255,255,.2)":"#D8DEE6"), cursor:"pointer", transition:"all .25s" }}/>
                  ))}
                </div>
              )}
            </div>
            {[1,2].map(off => homeAds[(heroAdIdx+off)%homeAds.length]).map(ad => (
              <Ad3DCard key={ad.id} ad={ad} variant="small" darkMode={darkMode} style={{minHeight:220}}/>
            ))}
          </div>
        ) : (
        <>
        {/* الإعلان الكبير — بيتغير كل 6 ثواني لو فيه أكتر من إعلان */}
        <div style={{ marginBottom:10, position:"relative" }}>
          <Ad3DCard key={homeAds[heroAdIdx]?.id} ad={homeAds[heroAdIdx]} variant="hero" darkMode={darkMode} style={{animation:"fadeIn .4s ease"}}/>
          {homeAds.length > 1 && (
            <div style={{ display:"flex", justifyContent:"center", gap:5, marginTop:7 }}>
              {homeAds.map((ad,i)=>(
                <div key={ad.id} onClick={()=>setHeroAdIdx(i)} style={{ width: i===heroAdIdx?16:6, height:6, borderRadius:3, background: i===heroAdIdx?C.gold:(darkMode?"rgba(255,255,255,.2)":"#D8DEE6"), cursor:"pointer", transition:"all .25s" }}/>
              ))}
            </div>
          )}
        </div>
        {/* الإعلانين الصغيرين — بيتبدلوا حسب دورة الهيرو عشان ميفضلوش نفس الترتيب دايمًا */}
        {homeAds.length > 1 && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
            {[1,2].map(off => homeAds[(heroAdIdx+off)%homeAds.length]).map(ad => (
              <Ad3DCard key={ad.id} ad={ad} variant="small" darkMode={darkMode}/>
            ))}
          </div>
        )}
        </>
        )}
      </div>
  ) : null;

  return (
    <div style={{ background: bg, minHeight: "100vh", paddingBottom: 80 }} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      {(refreshing||pullD>20)&&<div style={{textAlign:"center",padding:"8px",color:C.gold,fontSize:12,fontFamily:"'Cairo'"}}>{refreshing?<><Spinner size={13} color={C.gold}/> جاري التحديث...</>:"↓ اسحب للتحديث"}</div>}

      {/* ═══════════════════════════════════════════════ */}
      {/* 🖥️ DESKTOP HERO — الإعلان الكبير المتغيّر بقى خلفية الهيرو بالكامل، وعليه اسم الموقع
          والوصف، وتحت في هامش صغير إحصائيات حقيقية (عضو/تخصص/تقييم/زيارة) */}
      {/* ═══════════════════════════════════════════════ */}
      {isDesktop && (()=>{
        const currentAd = homeAds[heroAdIdx] || homeAds[0];
        // اسم الموقع بييجي كامل من إعدادات الأدمن ("الدليل الشامل")، فبنلوّن آخر كلمة بس بالذهبي
        // بدل ما نلزّق كلمة "الشامل" تانية زيادة على الاسم الكامل (كان بيطلع "الدليل الشامل الشامل")
        const nameParts = (cfg.appName||"الدليل الشامل").trim().split(/\s+/);
        const lastWord = nameParts.length > 1 ? nameParts.pop() : "";
        const restName = nameParts.join(" ") || (cfg.appName||"الدليل الشامل");
        return (
          <div className="desktop-hero-adbg" style={!currentAd?.imageUrl ? {background:`linear-gradient(135deg, ${currentAd?.color1||C.navy}, ${currentAd?.color2||C.navyLight})`} : undefined} key={currentAd?.id||"hero-ad"}>
            {currentAd?.imageUrl && (
              <>
                {/* طبقة خلفية مكبّرة ومموّهة من نفس الصورة — بتملى المساحة كلها مهما كان مقاس الصورة الأصلي */}
                <div style={{ position:"absolute", inset:0, backgroundImage:`url(${currentAd.imageUrl})`, backgroundSize:"cover", backgroundPosition:"center", filter:"blur(22px) brightness(.55)", transform:"scale(1.15)", zIndex:0 }}/>
                {/* الصورة الحقيقية كاملة من غير أي قص — بتتظبط لوحدها مهما كانت نسبة أبعادها */}
                <div style={{ position:"absolute", inset:0, backgroundImage:`url(${currentAd.imageUrl})`, backgroundSize:"contain", backgroundRepeat:"no-repeat", backgroundPosition:"center", zIndex:1 }}/>
                <div style={{ position:"absolute", inset:0, background:`linear-gradient(0deg, ${C.navyDeep}E6 5%, ${C.navyDeep}88 55%, ${C.navyDeep}44 100%)`, zIndex:2 }}/>
              </>
            )}
            {currentAd?.badge && <div className="hero-ad-badge">📢 {currentAd.badge}</div>}
            <div className="desktop-hero-adbg-content">
              <div style={{ color: "rgba(255,255,255,.85)", fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>🏢 منصة البناء في مصر</div>
              <h1 className="desktop-hero-title" style={{ fontFamily: "'Cairo'", fontWeight: 900, color: "white", lineHeight: 1.25 }}>
                {restName}{lastWord && <> <span style={{ background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{lastWord}</span></>}
              </h1>
            </div>
            {/* هامش صغير تحت الإعلان فيه الإحصائيات الحقيقية */}
            <div className="desktop-hero-stats-strip">
              {realStats.map(([n,l])=>(
                <div key={l}><div className="stat-number" style={{fontSize:17}}>{n}</div><div style={{color:"rgba(255,255,255,.62)",fontSize:9.5,marginTop:1}}>{l}</div></div>
              ))}
            </div>
            {homeAds.length > 1 && (
              <div className="desktop-hero-dots">
                {homeAds.map((ad,i)=>(
                  <div key={ad.id} onClick={()=>setHeroAdIdx(i)} style={{ width: i===heroAdIdx?16:6, height:6, borderRadius:3, background: i===heroAdIdx?C.gold:"rgba(255,255,255,.35)", cursor:"pointer", transition:"all .25s" }}/>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* الإعلانات الصغيرة تحت إعلان الهيرو الكبير مباشرة — بقت أكبر وأوضح، وبتتظبط تلقائي مع أي صورة */}
      {isDesktop && homeAds.length > 1 && (
        <div className="desktop-container" style={{paddingTop:18}}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[1,2].map(off => homeAds[(heroAdIdx+off)%homeAds.length]).map(ad => (
              <Ad3DCard key={ad.id} ad={ad} variant="small" darkMode={darkMode} style={{minHeight:160}}/>
            ))}
          </div>
        </div>
      )}

      {/* أقسام الدليل — بقت في مكان واحد بأيقونة واحدة بدل شبكة كبيرة، وبتوديك على شاشة البحث تتصفح فيها كل الأقسام */}
      {isDesktop && (
        <div className="desktop-container" style={{padding:"32px 28px 0"}}>
          <div onClick={()=>onNavigate("search")} style={{background:card,borderRadius:20,padding:"24px 22px",display:"flex",alignItems:"center",gap:18,cursor:"pointer",border:`1px solid ${darkMode?"rgba(201,168,76,.12)":C.grayLight}`,transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.boxShadow="0 14px 30px rgba(13,31,60,.1)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=darkMode?"rgba(201,168,76,.12)":C.grayLight;e.currentTarget.style.boxShadow="none";}}>
            <div style={{width:60,height:60,borderRadius:16,background:`linear-gradient(135deg,${C.gold},${C.goldDark})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:C.navyDeep}}>
              <TradeIcon id="tiling" size={28} strokeWidth={1.8}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:17,color:tc,marginBottom:4}}>أقسام الدليل</div>
              <div style={{fontSize:12,color:sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{SPECIALTIES.slice(0,5).map(s=>s.label).join(" • ")} و{SPECIALTIES.length-5} أقسام تانية</div>
            </div>
            <div style={{fontSize:22,color:C.gold,flexShrink:0}}>◀</div>
          </div>
        </div>
      )}

      {/* تصفح حسب النوع — شركات، موردين، صنايعية...إلخ. كل أيقونة بتوديك لشاشة البحث مفلترة على النوع ده بالظبط */}
      {isDesktop && (
        <div className="desktop-container" style={{padding:"18px 28px 0"}}>
          <div style={{fontSize:12.5,fontWeight:700,color:sub,marginBottom:10}}>تصفح حسب النوع</div>
          <div className="desktop-categories-grid">
            {MEMBER_CATEGORIES.map(cat=>(
              <div key={cat.id} onClick={()=>onNavigate("search",{category:cat.id})} style={{background:card,borderRadius:16,padding:"20px 8px",textAlign:"center",cursor:"pointer",border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.boxShadow="0 10px 22px rgba(13,31,60,.09)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=darkMode?"rgba(201,168,76,.1)":C.grayLight;e.currentTarget.style.boxShadow="none";}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:8,color:C.gold}}><TradeIcon id={cat.icon} size={24} strokeWidth={1.7}/></div>
                <div style={{fontSize:11.5,fontWeight:800,color:tc}}>{cat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Hero */}
      {!isDesktop && (
      <div className="hero-gradient" style={{ padding: "48px 16px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ color: "rgba(201,168,76,.78)", fontSize: 11.5, fontWeight: 600, marginBottom: 3 }}>🏢 منصة البناء في مصر</div>
            <h1 style={{ fontFamily: "'Cairo'", fontSize: 25, fontWeight: 900, color: "white", lineHeight: 1.25 }}>
              الدليل <span style={{ background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>الشامل</span>
            </h1>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <button onClick={()=>loadData()} style={{background:"rgba(255,255,255,.09)",border:"1px solid rgba(201,168,76,.2)",borderRadius:10,padding:"8px 10px",cursor:"pointer",color:C.gold,fontSize:15}} title="تحديث">🔄</button>
            {user && (
              <button onClick={() => onNavigate("notifications")} style={{ background: "rgba(255,255,255,.09)", border: `1px solid rgba(201,168,76,.2)`, borderRadius: 10, padding: "8px 10px", cursor: "pointer", color: "white", fontSize: 17, position: "relative" }}>
                🔔{unreadNotifCount>0&&<div className="notif-badge">{unreadNotifCount>9?"9+":unreadNotifCount}</div>}
              </button>
            )}
          </div>
        </div>
        <div className="search-bar" style={{ marginBottom: 12 }} onClick={() => onNavigate("search")}>
          <button>🔍</button>
          <input placeholder="ابحث عن صنايعي، مهندس، مقاول..." readOnly style={{ cursor: "pointer" }} />
        </div>
        {/* فلترة سريعة بالتخصص — وصول فوري للأقسام الأكتر طلبًا من غير الدخول على شاشة البحث */}
        <div className="scroll-x" style={{ marginBottom: 16, gap: 7 }}>
          {SPECIALTIES.slice(0, 8).map(s => (
            <div key={s.id} onClick={() => onNavigate("search", { specialty: s.label })}
              style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(255,255,255,.08)", border:"1px solid rgba(201,168,76,.22)", borderRadius:20, padding:"6px 12px", flexShrink:0, cursor:"pointer", transition:"all .18s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,168,76,.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.08)";}}>
              <span style={{fontSize:13}}>{s.icon}</span>
              <span style={{color:"white",fontSize:11.5,fontWeight:600,whiteSpace:"nowrap"}}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
          {realStats.map(([n, l]) => (
            <div key={l} className="stat-card">
              <div className="stat-number" style={{ fontSize: 16 }}>{n}</div>
              <div style={{ color: "rgba(255,255,255,.45)", fontSize: 9.5, marginTop: 1 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* 🔥 إعلانات متغيرة — على الموبايل بتظهر هنا بدري بعد الهيرو، وعلى الديسكتوب بعد قسم "ليه تختارنا" (زي التصميم المرجعي) */}
      {/* ═══════════════════════════════════════════════ */}
      {!isDesktop && adsBlock}

      {promoSlot === 0 && <PromoBanner cfg={cfg} />}

      {/* Specialties — على الديسكتوب بقى فيه شبكة أقسام كاملة فوق، فمش محتاجين نكررها هنا */}
      {!isDesktop && (
      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <div><div className="section-title" style={{ color: tc }}>الأقسام</div><div className="gold-line" /></div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate("search")}>الكل</button>
        </div>
        <div className="scroll-x">
          {SPECIALTIES.map(s => (
            <div key={s.id} onClick={() => onNavigate("search", { specialty: s.label })}
              style={{ background: card, borderRadius: 13, padding: "13px 14px", textAlign: "center", cursor: "pointer", border: `1px solid ${darkMode ? "rgba(201,168,76,.1)" : C.grayLight}`, flexShrink: 0, transition: "all .2s", minWidth: 72 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? "rgba(201,168,76,.1)" : C.grayLight; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ fontSize: 24, marginBottom: 5 }}>{s.icon}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: tc }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* لماذا الدليل الشامل — شكل مبسط وصغير (شريط واحد) بدل الكروت الكبيرة، عشان يبقى مناسب للموبايل */}
      {isDesktop && (
        <div className="desktop-container" style={{padding:"16px 14px"}}>
          <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"10px 22px",padding:"12px 16px",background:darkMode?"rgba(255,255,255,.03)":"#F8FAFC",borderRadius:14,border:`1px solid ${darkMode?"rgba(201,168,76,.08)":C.grayLight}`}}>
            {[["trust","موثوقية"],["members","أعضاء حقيقيين"],["growth","تقييمات صادقة"],["support","دعم مستمر"]].map(([iconId,label])=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:"rgba(201,168,76,.14)",display:"flex",alignItems:"center",justifyContent:"center",color:C.gold,flexShrink:0}}><TradeIcon id={iconId} size={13} strokeWidth={1.8}/></div>
                <span style={{fontSize:11.5,fontWeight:700,color:tc,whiteSpace:"nowrap"}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الإعلانات بقت في الهيرو نفسه (مكان البحث والصورة القديم) على الويب، فمش محتاجين نكررها هنا تاني */}

      {/* Corporate Partners — قسم مستقل تمامًا لشركاء النخبة والشركات، بتصميم أفخم من باقي الأعضاء */}
      {!loading && members.filter(m => ["elite","company"].includes(getMemberPlan(m)) && m.status==="approved").length > 0 && (
        <div className={isDesktop?"desktop-container":"section"} style={{ paddingTop: isDesktop?0:0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
            <div>
              <div className="section-title" style={{ color: tc }}>🏆 شركاؤنا وشركاء النخبة</div>
              <div className="gold-line" />
              <div style={{ color: sub, fontSize: 11.5, marginTop: 4 }}>أكبر الشركات والموردين الموثقين على المنصة</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate("search", { type: "elite" })}>الكل</button>
          </div>
          <div className={isDesktop?"grid-2 desktop-4col":"grid-2"}>
            {members.filter(m => ["elite","company"].includes(getMemberPlan(m)) && m.status==="approved")
              .sort((a,b) => (PLANS[getMemberPlan(a)]?.searchPriority??9) - (PLANS[getMemberPlan(b)]?.searchPriority??9))
              .slice(0, isDesktop?8:6).map(m => <PartnerCard key={m.id} member={m} onClick={onMemberClick} dark={darkMode} />)}
          </div>
        </div>
      )}

      {/* VIP Members */}
      <div className={isDesktop?"desktop-container":"section"} style={{ paddingTop: isDesktop?0:0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <div><div className="section-title" style={{ color: tc }}>⭐ الأعضاء المميزون</div><div className="gold-line" /></div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate("search", { type: "vip" })}>الكل</button>
        </div>
        {loading ? (
          <div className={isDesktop?"grid-2 desktop-4col":"grid-2"}>{[1, 2, 3, 4].map(i => <SkeletonCard key={i} dark={darkMode} />)}</div>
        ) : (
          <div className={isDesktop?"grid-2 desktop-4col":"grid-2"}>
            {members.filter(m => ["vip","premium"].includes(getMemberPlan(m)) && m.status==="approved").slice(0, isDesktop?8:6).map(m => <MemberCard key={m.id} member={m} onClick={onMemberClick} dark={darkMode} />)}
          </div>
        )}
      </div>

      {promoSlot === 1 && <PromoBanner cfg={cfg} />}

      {/* Posts Feed */}
      <div className={isDesktop?"desktop-container":"section"} style={{ paddingTop: isDesktop?36:0 }}>
        <div style={{maxWidth:isDesktop?700:"none",margin:isDesktop?"0 auto":0}}>
        {/* Posts Header + Add Post Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div><div className="section-title" style={{ color: tc }}>📱 المنشورات</div><div className="gold-line" /></div>
        </div>

        {/* Add Post Box — visible to all users */}
        <div style={{ background: card, borderRadius: 15, padding: "12px 14px", marginBottom: 13, border: `1px solid ${darkMode ? "rgba(201,168,76,.1)" : C.grayLight}`, boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Av text={user?.displayName || "؟"} size={40} type={user ? "starter" : "starter"} />
            <div onClick={handleAddPost} style={{ flex: 1, background: darkMode ? "rgba(255,255,255,.06)" : "#F5F7FA", borderRadius: 22, padding: "10px 16px", cursor: "pointer", color: sub, fontSize: 13, border: `1px solid ${darkMode ? "rgba(255,255,255,.08)" : C.grayLight}`, transition: "all .2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
              onMouseLeave={e => e.currentTarget.style.borderColor = darkMode ? "rgba(255,255,255,.08)" : C.grayLight}>
              {user ? "شارك خبرتك أو أحدث أعمالك... 💬" : "سجّل دخولك لنشر منشور... 💬"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${darkMode ? "rgba(255,255,255,.06)" : "#F0F0F0"}` }}>
            {[["📸", "صورة"], ["🎬", "فيديو"], ["💰", "عرض سعر"]].map(([icon, label]) => (
              <button key={label} onClick={handleAddPost} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: sub, fontSize: 12, fontFamily: "'Tajawal'", fontWeight: 600, padding: "5px 0", borderRadius: 8, transition: "color .18s" }}
                onMouseEnter={e => e.currentTarget.style.color = C.gold}
                onMouseLeave={e => e.currentTarget.style.color = sub}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {!loading && displayPosts.length === 0 && (
          <div style={{ textAlign:"center", padding:"46px 20px", background: card, borderRadius:16, border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
            <div style={{fontSize:46,marginBottom:12}}>📭</div>
            <div style={{color:tc,fontWeight:800,fontSize:14.5,marginBottom:5,fontFamily:"'Cairo'"}}>لسه مفيش منشورات هنا</div>
            <div style={{color:sub,fontSize:12,marginBottom:16}}>يلا كن أول واحد يشارك خبرته أو شغله مع الأعضاء</div>
            <button className="btn btn-primary btn-sm" onClick={handleAddPost}>✏️ أضف أول منشور</button>
          </div>
        )}

        {/* Posts List */}
        {displayPosts.map((post, idx) => (
          <div key={post.id}>
            {idx === 1 && promoSlot === 2 && <PromoBanner cfg={cfg} />}
            {/* ✳️ AD between every 3 posts */}
            {idx > 0 && idx % 3 === 0 && homeAds.length > 0 && (() => {
              const adIndex = Math.floor(idx / 3) % homeAds.length;
              const ad = homeAds[adIndex];
              return <Ad3DCard ad={ad} variant="inline" darkMode={darkMode} style={{marginBottom:11}}/>;
            })()}


            {/* Post Card */}
            <div style={{ background: card, borderRadius: 16, marginBottom: 11, border: `1px solid ${darkMode ? "rgba(201,168,76,.07)" : C.grayLight}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.04)", animation: `fadeInUp ${.1 + idx * .05}s ease both` }}>
              <div style={{ padding: "13px 13px 9px" }}>
                <div style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <Av text={post.author} size={40} type={post.type || "starter"} />
                  <div style={{ flex: 1 }}>
                    <div onClick={() => post.authorId && onMemberClick({ id: post.authorId, name: post.author, specialty: post.specialty, type: post.type })} style={{ fontWeight: 700, fontSize: 13.5, color: tc, cursor: post.authorId ? "pointer" : "default", display: "inline-block" }}>{post.author}</div>
                    <div style={{ fontSize: 10.5, color: sub }}>{post.specialty} · {tAgo(post.time)}</div>
                  </div>
                  {post.boosted && (
                    <span style={{ background:"rgba(201,168,76,.18)", border:`1px solid rgba(201,168,76,.35)`, color:C.gold, fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, alignSelf:"flex-start", whiteSpace:"nowrap" }}>🚀 مُروَّج</span>
                  )}
                  {post.type && post.type !== "starter" && (
                    <span className={`badge badge-${getMemberPlan(post)}`} style={{ fontSize: 9.5, alignSelf: "flex-start" }}>{getMemberPlan(post) === "vip" ? "VIP" : getMemberPlan(post) === "premium" ? "مميز" : "أساسي"}</span>
                  )}
                  {user?.isAdmin && (
                    <button onClick={() => {
                      if (window.confirm("هل تريد حذف هذا المنشور؟")) {
                        DB.deletePost(post.id).then(() => setPosts(p => p.filter(post_ => post_.id !== post.id))).catch(e => alert("❌ خطأ: " + e.message));
                      }
                    }} style={{ background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, padding: "4px 8px", color: "#EF4444", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>🗑️</button>
                  )}
                </div>
                <p style={{ fontSize: 13, color: darkMode ? "rgba(255,255,255,.78)" : "#334155", lineHeight: 1.78 }}>{post.content}</p>
                {post.images?.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: post.images.length === 1 ? "1fr" : "1fr 1fr", gap: 3, borderRadius: 10, overflow: "hidden", marginTop: 9 }}>
                    {post.images.slice(0, 4).map((img, i) => (
                      <img key={i} src={img} alt="" style={{ width: "100%", aspectRatio: post.images.length === 1 ? "16/9" : "1", objectFit: "contain", background: darkMode ? "#0B1220" : "#F1F5F9" }} />
                    ))}
                  </div>
                )}
                {post.video && (
                  <video src={post.video} controls style={{ width: "100%", borderRadius: 10, marginTop: 9, maxHeight: 320, background: "#000" }} />
                )}
              </div>
              <div style={{ borderTop: `1px solid ${darkMode ? "rgba(255,255,255,.05)" : "#F5F5F5"}`, display: "flex" }}>
                {[[`❤️`, post.likes || 0, () => toggleLike(post)],
                  ["💬", post.comments || 0, () => setSelectedPostForComments(post)],
                  ["🔗", post.shares || 0, () => copyOrShareLink(SITE_URL, "الدليل الشامل", post.content?.slice(0,80))]
                ].map(([icon, count, action]) => (
                  <button key={icon} onClick={action} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "9px 0", display: "flex", justifyContent: "center", gap: 4, color: (post.likedBy||[]).includes(user?.uid) && icon === "❤️" ? C.error : sub, fontSize: 12.5, fontFamily: "'Tajawal'", transition: "color .18s" }}
                    onMouseEnter={e => e.currentTarget.style.color = C.gold}
                    onMouseLeave={e => e.currentTarget.style.color = (post.likedBy||[]).includes(user?.uid) && icon === "❤️" ? C.error : sub}>
                    <span style={{ fontSize: 14 }}>{icon}</span> {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Load More Posts */}
        {!loading && displayPosts.length > 0 && hasMorePosts && (
          <button className="btn btn-outline" style={{ width:"100%", marginTop:4, marginBottom:11 }} onClick={loadMorePosts} disabled={loadingMorePosts}>
            {loadingMorePosts ? <><Spinner size={16} color={C.gold}/> جاري التحميل...</> : "⬇️ تحميل المزيد من المنشورات"}
          </button>
        )}
        </div>
      </div>

      {/* Add Post Modal */}
      {showAddPost && (
        <AddPostModal user={user} onClose={() => setShowAddPost(false)} onPost={handleNewPost} darkMode={darkMode} />
      )}

      {selectedPostForComments && (
        <CommentsModal postId={selectedPostForComments.id} darkMode={darkMode} currentUser={user} onClose={() => setSelectedPostForComments(null)} />
      )}

      {/* Floating Add Post Button */}
      <div onClick={handleAddPost} style={{ position: "fixed", bottom: 90, right: 14, zIndex: 998, width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg,${C.info},#2563EB)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, cursor: "pointer", boxShadow: "0 4px 18px rgba(59,130,246,.48)", animation: "float 3s ease-in-out infinite" }}>
        ✏️
      </div>
    </div>
  );
};

// ============================================================
// DIRECT MESSAGES SCREEN
// ============================================================
const DirectMessagesScreen = ({ darkMode, currentUser }) => {
  const isDesktop = useIsDesktop();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    DB.getChats(currentUser.uid).then(c => { setChats(c); setLoading(false); }).catch(() => setLoading(false));
  }, [currentUser]);

  if (!currentUser) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 13, background: bg, paddingBottom: 80 }}>
      <div style={{ fontSize: 50 }}>🔒</div>
      <div style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 17, color: tc }}>سجّل دخولك أولاً</div>
    </div>
  );

  const chatList = (
    loading ? <SkeletonCard dark={darkMode} /> :
    chats.length === 0 ? (
      <div style={{ textAlign: "center", padding: "50px 15px", color: sub }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
        لا توجد رسائل بعد
      </div>
    ) : (
      chats.map(chat => (
        <div key={chat.id} onClick={() => setSelectedChat(chat)} style={{ background: isDesktop?(selectedChat?.id===chat.id?(darkMode?"rgba(201,168,76,.12)":"#FDF8ED"):card):card, borderRadius: 13, padding: 13, marginBottom: 10, cursor: "pointer", display: "flex", gap: 11, border: `1px solid ${isDesktop&&selectedChat?.id===chat.id?C.gold:(darkMode ? "rgba(201,168,76,.1)" : C.grayLight)}` }}>
          <Av size={44} text={chat.otherUserName || "?"} type={chat.otherUserPlan||"basic"} src={chat.otherUserAvatar} />
          <div style={{ flex: 1, minWidth:0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: tc, marginBottom: 3 }}>{chat.otherUserName || "عضو"}</div>
            <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{chat.lastMessage?.substring(0, 40)}...</div>
          </div>
        </div>
      ))
    )
  );

  // على الديسكتوب: قايمة المحادثات + المحادثة المفتوحة جنب بعض في نفس الشاشة (زي واتساب ويب)
  if (isDesktop) {
    return (
      <div style={{ background: bg, minHeight: "100vh" }}>
        <div className="desktop-container" style={{paddingTop:22}}>
          <h2 style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 22, color: tc, marginBottom: 16 }}>💬 رسائلك</h2>
          <div className="desktop-messages-grid" style={{ minHeight:400}}>
            <div className="desktop-chat-list-panel" style={{background:card,borderRadius:14,padding:12,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,overflowY:"auto"}}>
              {chatList}
            </div>
            <div className="desktop-chat-window-panel" style={{background:card,borderRadius:14,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,overflow:"hidden",display:"flex"}}>
              {selectedChat ? (
                <ChatScreen chat={selectedChat} currentUser={currentUser} darkMode={darkMode} embedded/>
              ) : (
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:sub}}>
                  <div style={{fontSize:44}}>💬</div>
                  <div>اختر محادثة من القايمة لعرضها هنا</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedChat) return (
    <ChatScreen chat={selectedChat} currentUser={currentUser} darkMode={darkMode} onBack={() => setSelectedChat(null)} />
  );

  return (
    <div style={{ background: bg, minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ background: `linear-gradient(135deg,${C.navyDeep},${C.navy})`, padding: "50px 16px 18px" }}>
        <h2 style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 19, color: "white", marginBottom: 3 }}>💬 رسائلك</h2>
        <p style={{ color: "rgba(255,255,255,.45)", fontSize: 12.5 }}>تواصل مع الآخرين</p>
      </div>
      <div style={{ padding: "11px 14px" }}>
        {chatList}
      </div>
    </div>
  );
};

// ============================================================
// CHAT SCREEN
// ============================================================
const ChatScreen = ({ chat, currentUser, darkMode, onBack, embedded=false }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;

  useEffect(() => {
    const chatId = chat.id;
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, `chats/${chatId}/messages`),
      snap => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(msgs.sort((a, b) => (a.time?.toMillis?.() || 0) - (b.time?.toMillis?.() || 0)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [chat.id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await DB.sendMessage(currentUser.uid, chat.users.find(u => u !== currentUser.uid), currentUser.displayName, newMessage);
      setNewMessage("");
    } catch(e) { alert("❌ خطأ في إرسال الرسالة"); }
  };

  const tAgo = t => { const d=(Date.now()-(typeof t==="number"?t:t?.toMillis?.()||Date.now()))/1000; if(d<60)return"الآن";if(d<3600)return`${Math.floor(d/60)}د`;if(d<86400)return`${Math.floor(d/3600)}س`;return`${Math.floor(d/86400)}ي`; };

  return (
    <div style={{ background: bg, height: embedded?"100%":"100vh", minHeight: embedded?"auto":"100vh", display: "flex", flexDirection: "column", paddingBottom: embedded?0:80 }}>
      <div style={{ background: card, borderBottom: `1px solid ${darkMode ? "rgba(201,168,76,.1)" : C.grayLight}`, padding: "14px 14px 12px", display: "flex", gap: 11, alignItems: "center", position: "sticky", top: 0, zIndex: 100, borderRadius: embedded?"14px 14px 0 0":0 }}>
        {!embedded && <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>←</button>}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: tc }}>{chat.otherUserName || "محادثة"}</div>
          <div style={{ fontSize: 11, color: sub }}>آخر رسالة: {chat.lastTime ? tAgo(chat.lastTime) : "..."}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "11px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
        {loading ? <SkeletonCard dark={darkMode} /> :
        messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 15px", color: sub, alignSelf: "center" }}>لا توجد رسائل</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.senderId === currentUser.uid ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "75%", background: msg.senderId === currentUser.uid ? C.gold : card, color: msg.senderId === currentUser.uid ? C.navy : tc, borderRadius: 12, padding: "10px 13px", border: msg.senderId === currentUser.uid ? "none" : `1px solid ${darkMode ? "rgba(201,168,76,.1)" : C.grayLight}` }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 4, wordBreak: "break-word" }}>{msg.message}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{tAgo(msg.time)}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ background: card, padding: "11px 14px", borderTop: `1px solid ${darkMode ? "rgba(201,168,76,.1)" : C.grayLight}`, display: "flex", gap: 8 }}>
        <input placeholder="رسالتك..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === "Enter" && handleSendMessage()}
          style={{ flex: 1, padding: "10px 12px", border: `1px solid ${darkMode ? "rgba(201,168,76,.2)" : C.grayLight}`, borderRadius: 8, background: bg, color: tc, fontFamily: "'Cairo'", fontSize: 12.5, outline: "none" }}
        />
        <button onClick={handleSendMessage} style={{ background: C.gold, color: C.navy, border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>إرسال</button>
      </div>
    </div>
  );
};

// ============================================================
// SEARCH SCREEN
// ============================================================
const SearchScreen = ({ initialFilters={}, onMemberClick, darkMode }) => {
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState(initialFilters.query||"");
  const [gov, setGov] = useState(initialFilters.gov||"");
  const [city, setCity] = useState(initialFilters.city||"");
  const [specialty, setSpecialty] = useState(initialFilters.specialty||"");
  const [category, setCategory] = useState(initialFilters.category||"");
  const [mtype, setMtype] = useState(initialFilters.type||"");
  const [sort, setSort] = useState("priority");
  const [minRating, setMinRating] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const dq = useDebounce(query, 350);
  const bg = darkMode?C.navyDeep:C.offWhite;
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.45)":C.gray;

  const doSearch = useCallback(async () => {
    setLoading(true);
    const data = await DB.getMembers({ query:dq, gov, specialty, category, type:mtype, sort });
    let filtered = minRating>0 ? data.filter(m=>m.rating>=minRating) : data;
    if (city) filtered = filtered.filter(m=>m.city===city);
    setResults(filtered);
    setLoading(false);
  }, [dq, gov, specialty, category, mtype, sort, minRating, city]);

  useEffect(()=>{ doSearch(); }, [doSearch]);

  const [refreshing, setRefreshing] = useState(false);
  const [touchY, setTouchY] = useState(null);
  const [pullDist, setPullDist] = useState(0);
  const onTS = e => setTouchY(e.touches[0].clientY);
  const onTM = e => { if(!touchY||window.scrollY>0) return; const d=e.touches[0].clientY-touchY; if(d>0) setPullDist(Math.min(d,65)); };
  // باگ تاني كان هنا: السحب للتحديث (pull-to-refresh) كان بينده على setMembers و setPosts وهما
  // أصلاً مش موجودين في شاشة البحث دي (كانوا متبقّيين بالغلط من كود الشاشة الرئيسية)، فكان بيدّي
  // خطأ (crash) في الخلفية بدل ما يحدّث نتائج البحث فعليًا. دلوقتي بيعيد نفس البحث الحالي (doSearch)
  const onTE = async () => { if(pullDist>50){setRefreshing(true);await doSearch();setRefreshing(false);} setPullDist(0);setTouchY(null); };

  return (
    <div style={{background:bg,minHeight:"100vh",paddingBottom:80}} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      {(refreshing||pullDist>20)&&<div style={{textAlign:"center",padding:"8px",color:C.gold,fontSize:12,fontFamily:"'Cairo'"}}>{refreshing?<><Spinner size={13} color={C.gold}/> جاري التحديث...</>:"↓ اسحب للتحديث"}</div>}
      <div style={{background:`linear-gradient(135deg,${C.navyDeep},${C.navy})`,padding:isDesktop?"26px 0 22px":"48px 15px 16px"}}>
        <div className={isDesktop?"desktop-container":undefined}>
        <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isDesktop?24:19,color:"white",marginBottom:13}}>🔍 البحث في الدليل</h2>
        <div className="search-bar" style={{marginBottom:9, maxWidth:isDesktop?560:"none"}}>
          <button>🔍</button>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="اسم، تخصص، محافظة..." autoFocus/>
          {query&&<button onClick={()=>setQuery("")} style={{background:"none",color:C.gray,fontSize:15,padding:"0 11px",flexShrink:0,border:"none",cursor:"pointer"}}>✕</button>}
        </div>
        {!isDesktop && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:9}}>
          <select className="select select-dark" value={gov} onChange={e=>{setGov(e.target.value);setCity("");}}>
            <option value="">كل المحافظات</option>
            {GOVERNORATES.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
          <select className="select select-dark" value={specialty} onChange={e=>setSpecialty(e.target.value)}>
            <option value="">كل التخصصات</option>
            {SPECIALTIES.map(s=><option key={s.id} value={s.label}>{s.icon} {s.label}</option>)}
          </select>
        </div>
        )}
        {!isDesktop && (
        <div style={{marginBottom:9}}>
          <select className="select select-dark" style={{width:"100%"}} value={city} onChange={e=>setCity(e.target.value)} disabled={!gov}>
            <option value="">{gov?"كل المدن/المراكز":"اختر محافظة أولاً لتحديد المدينة"}</option>
            {getMarakez(gov).map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        )}
        {!isDesktop && (
        <>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowFilters(!showFilters)}>⚙️ فلاتر متقدمة {showFilters?"▲":"▼"}</button>
        {showFilters&&(
          <div style={{background:"rgba(255,255,255,.06)",borderRadius:11,padding:13,marginTop:8,animation:"fadeInUp .28s ease"}}>
            <div style={{marginBottom:10}}>
              <div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginBottom:6}}>النوع</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <div className={`chip ${category===""?"active":""}`} onClick={()=>setCategory("")} style={{fontSize:11}}>الكل</div>
                {MEMBER_CATEGORIES.map(c=>(
                  <div key={c.id} className={`chip ${category===c.id?"active":""}`} onClick={()=>setCategory(c.id)} style={{fontSize:11}}>{c.label}</div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginBottom:6}}>نوع العضوية</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {[["","الكل"],["elite","شركاء النخبة"],["company","شركات"],["vip","VIP"],["premium","مميز"],["basic","أساسي"],["starter","مبتدئ"]].map(([v,l])=>(
                  <div key={v} className={`chip ${mtype===v?"active":""}`} onClick={()=>setMtype(v)} style={{fontSize:11}}>{l}</div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginBottom:6}}>ترتيب النتائج</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {[["priority","الأفضل"],["rating","الأعلى تقييماً"],["views","الأكثر مشاهدة"]].map(([v,l])=>(
                  <div key={v} className={`chip ${sort===v?"active":""}`} onClick={()=>setSort(v)} style={{fontSize:11}}>{l}</div>
                ))}
              </div>
            </div>
            <div>
              <div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginBottom:5}}>أدنى تقييم: {minRating>0?`${minRating}★`:"الكل"}</div>
              <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={e=>setMinRating(+e.target.value)} style={{width:"100%",accentColor:C.gold}}/>
            </div>
          </div>
        )}
        </>
        )}
        </div>
      </div>

      {isDesktop ? (
        <div className="desktop-container" style={{paddingTop:26}}>
          <div className="desktop-search-grid">
            {/* Filters Sidebar */}
            <div style={{background:darkMode?C.cardBg:"white",borderRadius:16,padding:18,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,position:"sticky",top:90}}>
              <div style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:15,color:tc,marginBottom:14}}>⚙️ الفلاتر</div>
              <div className="form-group">
                <div className="form-label" style={{color:tc}}>المحافظة</div>
                <select className={`select${darkMode?" select-dark":""}`} value={gov} onChange={e=>{setGov(e.target.value);setCity("");}}>
                  <option value="">كل المحافظات</option>
                  {GOVERNORATES.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group">
                <div className="form-label" style={{color:tc}}>المدينة/المركز</div>
                <select className={`select${darkMode?" select-dark":""}`} value={city} onChange={e=>setCity(e.target.value)} disabled={!gov}>
                  <option value="">{gov?"كل المدن/المراكز":"اختر محافظة أولاً"}</option>
                  {getMarakez(gov).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <div className="form-label" style={{color:tc}}>التخصص</div>
                <select className={`select${darkMode?" select-dark":""}`} value={specialty} onChange={e=>setSpecialty(e.target.value)}>
                  <option value="">كل التخصصات</option>
                  {SPECIALTIES.map(s=><option key={s.id} value={s.label}>{s.icon} {s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <div className="form-label" style={{color:tc}}>النوع</div>
                <select className={`select${darkMode?" select-dark":""}`} value={category} onChange={e=>setCategory(e.target.value)}>
                  <option value="">كل الأنواع</option>
                  {MEMBER_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div style={{marginBottom:14}}>
                <div className="form-label" style={{color:tc,marginBottom:7}}>نوع العضوية</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {[["","الكل"],["elite","شركاء النخبة"],["company","شركات"],["vip","VIP"],["premium","مميز"],["basic","أساسي"],["starter","مبتدئ"]].map(([v,l])=>(
                    <div key={v} className={`chip ${mtype===v?"active":""} ${darkMode&&mtype!==v?"chip-gray":""}`} onClick={()=>setMtype(v)} style={{fontSize:11}}>{l}</div>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <div className="form-label" style={{color:tc,marginBottom:7}}>ترتيب النتائج</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {[["priority","الأفضل"],["rating","الأعلى تقييماً"],["views","الأكثر مشاهدة"]].map(([v,l])=>(
                    <div key={v} className={`chip ${sort===v?"active":""} ${darkMode&&sort!==v?"chip-gray":""}`} onClick={()=>setSort(v)} style={{fontSize:11}}>{l}</div>
                  ))}
                </div>
              </div>
              <div>
                <div className="form-label" style={{color:tc,marginBottom:5}}>أدنى تقييم: {minRating>0?`${minRating}★`:"الكل"}</div>
                <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={e=>setMinRating(+e.target.value)} style={{width:"100%",accentColor:C.gold}}/>
              </div>
            </div>
            {/* Results */}
            <div>
              <div style={{color:sub,fontSize:13,marginBottom:14}}>{loading?"جاري البحث...":<>تم العثور على <strong style={{color:C.gold}}>{results.length}</strong> نتيجة</>}</div>
              {loading?(
                <div className="grid-2 desktop-4col">{[1,2,3,4].map(i=><SkeletonCard key={i} dark={darkMode}/>)}</div>
              ):(
                <>
                  <div className="grid-2 desktop-4col">
                    {results.map(m=><MemberCard key={m.id} member={m} onClick={onMemberClick} dark={darkMode}/>)}
                  </div>
                  {results.length===0&&(
                    <div style={{textAlign:"center",padding:"48px 20px"}}>
                      <div style={{fontSize:48,marginBottom:10}}>🔍</div>
                      <div style={{fontWeight:700,color:tc,marginBottom:5}}>لا توجد نتائج</div>
                      <div style={{color:sub,fontSize:13}}>جرب تغيير الفلاتر أو كلمة البحث</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
      <div style={{padding:"11px 14px 0"}}>
        <div style={{color:sub,fontSize:12,marginBottom:10}}>{loading?"جاري البحث...":<>تم العثور على <strong style={{color:C.gold}}>{results.length}</strong> نتيجة</>}</div>
        {loading?(
          <div className="grid-2">{[1,2,3,4].map(i=><SkeletonCard key={i} dark={darkMode}/>)}</div>
        ):(
          <>
            <div className="grid-2">
              {results.map(m=><MemberCard key={m.id} member={m} onClick={onMemberClick} dark={darkMode}/>)}
            </div>
            {results.length===0&&(
              <div style={{textAlign:"center",padding:"48px 20px"}}>
                <div style={{fontSize:48,marginBottom:10}}>🔍</div>
                <div style={{fontWeight:700,color:tc,marginBottom:5}}>لا توجد نتائج</div>
                <div style={{color:sub,fontSize:13}}>جرب تغيير الفلاتر أو كلمة البحث</div>
              </div>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
};


// ============================================================
// WORKS TAB — صور الأعمال (5 صور حقيقية)
// ============================================================
const WorksTab = ({ member, currentUser, darkMode }) => {
  const [photos, setPhotos] = useState(member.workPhotos || []);
  const [uploading, setUploading] = useState(false);
  const [memberPosts, setMemberPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const fileRef = useRef(null);
  const isOwner = currentUser?.uid === member?.id;
  const card = darkMode ? C.cardBg : "white";
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;
  const tc = darkMode ? "white" : C.navy;
  const tAgo = t => { const d=(Date.now()-(typeof t==="number"?t:t?.toMillis?.()||Date.now()))/1000; if(d<60)return"الآن";if(d<3600)return`${Math.floor(d/60)} د`;if(d<86400)return`${Math.floor(d/3600)} س`;return`${Math.floor(d/86400)} يوم`; };

  useEffect(() => {
    if (!member?.id) { setLoadingPosts(false); return; }
    DB.getUserPosts(member.id).then(p => { setMemberPosts(p); setLoadingPosts(false); }).catch(()=>setLoadingPosts(false));
  }, [member?.id]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - photos.length);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        // تحجيم الصورة ورفعها على Firebase Storage
        const blob = await resizeImageMax(file, 1100, 0.85);
        const url = await uploadBlobToStorage(blob, `workPhotos/${member.id}/${Date.now()}_${urls.length}.jpg`);
        urls.push(url);
      }
      const newPhotos = [...photos, ...urls].slice(0, 5);
      setPhotos(newPhotos);
      await updateDoc(doc(db, "members", member.id), { workPhotos: newPhotos });
    } catch(e) { console.error(e); alert("❌ حدث خطأ أثناء رفع الصور: " + e.message); }
    setUploading(false);
  };

  const removePhoto = async (idx) => {
    const newPhotos = photos.filter((_,i) => i !== idx);
    setPhotos(newPhotos);
    try { await updateDoc(doc(db, "members", member.id), { workPhotos: newPhotos }); } catch {}
  };

  return (
    <div style={{animation:"fadeIn .28s ease"}}>
      {photos.length > 0 ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:12}}>
          {photos.map((src,i) => (
            <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:9,overflow:"hidden"}}>
              <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              {isOwner&&(
                <button onClick={()=>removePhoto(i)} style={{position:"absolute",top:4,left:4,background:"rgba(0,0,0,.65)",border:"none",borderRadius:"50%",width:22,height:22,color:"white",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{textAlign:"center",padding:"38px 20px"}}>
          <div style={{fontSize:44,marginBottom:9}}>📸</div>
          <div style={{color:sub,marginBottom:4}}>لا توجد صور أعمال بعد</div>
          {isOwner&&<div style={{color:sub,fontSize:12}}>أضف حتى 5 صور من أعمالك</div>}
        </div>
      )}
      {isOwner && photos.length < 5 && (
        <div>
          <input type="file" ref={fileRef} accept="image/*" multiple style={{display:"none"}} onChange={handleUpload}/>
          <button className="btn btn-outline" style={{width:"100%"}} onClick={()=>fileRef.current?.click()} disabled={uploading}>
            {uploading ? <><Spinner size={14} color={C.gold}/> جاري الرفع...</> : `📸 إضافة صور (${photos.length}/5)`}
          </button>
          <div style={{textAlign:"center",fontSize:11,color:sub,marginTop:6}}>يمكنك إضافة حتى 5 صور من أعمالك</div>
        </div>
      )}
      {!isOwner && photos.length === 0 && (
        <div style={{textAlign:"center",padding:"20px",color:sub,fontSize:12}}>لم يضف هذا العضو صور أعمال بعد</div>
      )}

      {/* منشورات العضو — تظهر هنا تلقائياً لما ينشر من الصفحة الرئيسية */}
      <div style={{ marginTop: 22 }}>
        <h4 style={{ color: tc, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📝 منشورات {member.name?.split(" ")[0]}</h4>
        {loadingPosts ? (
          <div style={{ textAlign:"center", padding:"16px 0" }}><Spinner size={16} color={C.gold}/></div>
        ) : memberPosts.length === 0 ? (
          <div style={{ textAlign:"center", padding:"22px", color: sub, fontSize: 12 }}>لا توجد منشورات بعد</div>
        ) : memberPosts.map(post => (
          <div key={post.id} style={{ background: card, borderRadius: 13, padding: 12, marginBottom: 9, border: `1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
            <div style={{ fontSize: 10.5, color: sub, marginBottom: 6 }}>🕐 {tAgo(post.time)}</div>
            <p style={{ fontSize: 13, color: darkMode ? "rgba(255,255,255,.78)" : "#334155", lineHeight: 1.7, marginBottom: post.images?.length || post.video ? 8 : 0 }}>{post.content}</p>
            {post.images?.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: post.images.length === 1 ? "1fr" : "1fr 1fr", gap: 3, borderRadius: 9, overflow: "hidden" }}>
                {post.images.slice(0,4).map((img,i)=>(<img key={i} src={img} alt="" style={{width:"100%",aspectRatio:post.images.length===1?"16/9":"1",objectFit:"contain",background:darkMode?"#0B1220":"#F1F5F9"}}/>))}
              </div>
            )}
            {post.video && <video src={post.video} controls style={{ width:"100%", borderRadius: 9, maxHeight: 260, background:"#000" }}/>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// PROFILE SCREEN
// ============================================================
const ProfileScreen = ({ member, onBack, darkMode, currentUser, onRequireAuth, onShowPayment, onSaveUpdated }) => {
  const cfg = useConfig();
  const [tab, setTab] = useState("about");
  const [reviews, setReviews] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [memberData, setMemberData] = useState(member || {});
  const [showChat, setShowChat] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);
  const isOwner = currentUser?.uid === member?.id;
  const bg = darkMode?C.navyDeep:C.offWhite;
  const card = darkMode?C.cardBg:"white";
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.45)":C.gray;
  const tAgo = t => { const d=(Date.now()-t)/86400000; return d<1?"اليوم":d<7?`${Math.floor(d)} أيام`:`${Math.floor(d/30)} شهر`; };

  useEffect(()=>{
    if(!member) return;
    setMemberData(member);
    DB.trackProfileView(currentUser?.uid, member.id, currentUser?.displayName);
    DB.getReviews(member.id).then(setReviews);
    // تحميل حالة الحفظ
    if (currentUser?.uid) {
      getDoc(doc(db,`members/${currentUser.uid}/saved`,member.id)).then(snap => setIsSaved(snap.exists()));
      DB.getIsFollowing(currentUser.uid, member.id).then(setIsFollowing);
    }
    // تحميل عدد المتابعين
    DB.getFollowers(member.id).then(setFollowers);
    getDoc(doc(db,"members",member.id)).then(snap=>{
      if(snap.exists()) setMemberData({id:snap.id,...snap.data()});
    }).catch(()=>{});
  },[member?.id, currentUser?.uid]);

  const submitReview = async () => {
    if(!reviewText.trim()) return;
    setSubmitting(true);
    await DB.addReview(member.id,{name:currentUser?.displayName||"مستخدم",rating:reviewRating,text:reviewText});
    setReviews(p=>[{id:Date.now(),name:currentUser?.displayName||"مستخدم",rating:reviewRating,text:reviewText,time:Date.now()},...p]);
    // تحديث معدل النجوم على الشاشة فورًا بدل ما يستنى Refresh عشان يبين الرقم الجديد
    setMemberData(p => {
      const oldCount = p.reviews || 0;
      const oldRating = p.rating || 0;
      const newCount = oldCount + 1;
      return { ...p, reviews: newCount, rating: Math.round((((oldRating*oldCount)+reviewRating)/newCount)*10)/10 };
    });
    setReviewText(""); setReviewRating(5); setSubmitting(false);
  };

  const shareProfile = () => {
    const url = buildMemberUrl(member);
    copyOrShareLink(url, member.name, member.specialty);
  };

  // رفع صورة غطاء جديدة — متاح لصاحب البروفايل بس
  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadBlobToStorage(file, `covers/${member.id}_${Date.now()}`);
      await updateDoc(doc(db,"members",member.id), { coverUrl: url });
      setMemberData(p => ({...p, coverUrl:url}));
    } catch (err) {
      alert("❌ حصل خطأ في رفع الصورة: " + (err?.message||""));
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  if(!member) return null;

  if (showChat && currentUser) {
    const chatId = [currentUser.uid, member.id].sort().join("_");
    return (
      <ChatScreen
        chat={{ id: chatId, users: [currentUser.uid, member.id], otherUserId: member.id, otherUserName: member.name, otherUserAvatar: member.avatarUrl, otherUserPlan: getMemberPlan(member) }}
        currentUser={currentUser}
        darkMode={darkMode}
        onBack={() => setShowChat(false)}
      />
    );
  }

  return (
    <div style={{background:bg,minHeight:"100vh",paddingBottom:80}}>
      {/* Cover with Avatar Overlapping - Avatar on top */}
      <div style={{position:"relative",marginBottom:30}}>
        {/* Cover Image */}
        <div style={{height:165,background:`linear-gradient(135deg,${PLANS[getMemberPlan(member)]?.color||C.navy}99,${C.navyDeep})`,position:"relative",overflow:"hidden"}}>
          {memberData.coverUrl&&<img src={memberData.coverUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.38}}/>}
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.28)"}}/>
          <button onClick={onBack} style={{position:"absolute",top:48,right:14,background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,padding:"7px 11px",color:"white",cursor:"pointer",backdropFilter:"blur(10px)",fontSize:17}}>←</button>
          {isOwner && (
            <>
              <input ref={coverInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleCoverChange}/>
              <button onClick={()=>coverInputRef.current?.click()} disabled={uploadingCover} style={{position:"absolute",top:48,left:14,background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,padding:"7px 11px",color:"white",cursor:"pointer",backdropFilter:"blur(10px)",fontSize:13,fontFamily:"'Cairo'",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                {uploadingCover?<Spinner size={12} color="white"/>:"📷 تغيير الغطاء"}
              </button>
            </>
          )}
        </div>
        
        {/* Avatar & Info Section - Overlapping Cover */}
        <div style={{padding:"0 16px",position:"relative",zIndex:2}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginTop:-44,marginBottom:14}}>
            {/* Avatar with Pulse for Premium Members */}
            <div style={{position:"relative"}}>
              <div style={{position:"relative",display:"inline-block"}}>
                <Av text={member.name} size={86} type={getMemberPlan(member)} src={member.avatarUrl}/>
                {["premium","vip","company","elite"].includes(getMemberPlan(member)) && (
                  <div style={{
                    position:"absolute",
                    inset:-3,
                    borderRadius:"50%",
                    border:`2px solid ${PLANS[getMemberPlan(member)]?.color||C.gold}`,
                    animation:`premiumPulse 2s ease-in-out infinite`,
                    boxShadow: `0 0 0 0 ${PLANS[getMemberPlan(member)]?.color||C.gold}99`
                  }}/>
                )}
              </div>
            </div>
            
            {/* QR & Copy Buttons */}
            <div style={{display:"flex",gap:7}}>
              <button onClick={shareProfile} style={{background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,padding:"7px 11px",color:"white",cursor:"pointer",backdropFilter:"blur(10px)",fontSize:15}}>🔗</button>
              <button onClick={()=>setShowQR(true)} style={{background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,padding:"7px 11px",color:"white",cursor:"pointer",backdropFilter:"blur(10px)",fontSize:15}}>📱 QR</button>
            </div>
          </div>

          {/* Member Info: Name, Specialty, Type Badge, Registration Date */}
          <div style={{marginBottom:13}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
              <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:20,color:tc}}>{member.name}</h2>
              {member.badge&&<span style={{fontSize:17}}>{member.badge}</span>}
              {member.verified&&<span title="موثق">✅</span>}
            </div>
            <div style={{color:sub,fontSize:13,marginBottom:7}}>🔧 {member.specialty}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:9}}>
              <span className={`badge badge-${getMemberPlan(member)}`}>عضو {PLANS[getMemberPlan(member)]?.label || "مبتدئ"}</span>
              <span style={{color:sub,fontSize:11.5}}>📍 {member.gov} - {member.city}</span>
              {member.createdAt && (
                <span style={{color:sub,fontSize:11.5}}>📅 عضو منذ {new Date(member.createdAt.toDate?.() || member.createdAt).toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"})}</span>
              )}
            </div>
            <div style={{display:"flex",gap:13,alignItems:"center"}}>
              <StarRating rating={member.rating}/>
              <span style={{fontWeight:700,color:C.gold}}>{member.rating}</span>
              <span style={{fontSize:11.5,color:sub}}>({member.reviews} تقييم)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{display:"flex",gap:7,paddingBottom:3,marginBottom:9}}>
            {!isOwner&&<button className="btn btn-outline btn-sm" onClick={()=>{ if(!currentUser){onRequireAuth?.();return;} setShowChat(true); }}>💬 راسل</button>}
            <button className="btn btn-primary btn-sm" onClick={()=>{DB.trackStat(member.id,"waMessages");window.open(`https://wa.me/2${member.phone}?text=${encodeURIComponent("مرحباً " + member.name + "، وجدتك في الدليل الشامل وأريد الاستفسار عن خدماتك")}`);}}>💬 واتساب</button>
            <button className="btn btn-navy btn-sm" onClick={()=>{DB.trackStat(member.id,"calls");window.open(`tel:${member.phone}`);}}>📞</button>
          </div>
          {/* طلب عرض سعر سريع — رسالة جاهزة ومنظمة بدل الشات العادي، بتساعد العميل يوصف طلبه بسرعة */}
          {!isOwner&&(
            <button onClick={()=>{
              DB.trackStat(member.id,"waMessages");
              const msg = `مرحباً ${member.name}، أريد عرض سعر لخدمة:\n- نوع الشغل: \n- الموقع: ${member.gov||""}\n- وصف مختصر: \n\n(وصلتك من الدليل الشامل)`;
              window.open(`https://wa.me/2${member.phone}?text=${encodeURIComponent(msg)}`);
            }} style={{width:"100%",background:`linear-gradient(135deg,${C.gold}22,${C.goldDark}11)`,border:`1px solid rgba(201,168,76,.35)`,borderRadius:10,padding:"9px 12px",color:C.gold,cursor:"pointer",fontFamily:"'Cairo'",fontWeight:700,fontSize:12.5,marginBottom:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              📝 اطلب عرض سعر سريع
            </button>
          )}
        </div>
      </div>

      <div style={{padding:"0 16px"}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:13}}>
          {[["👁",memberData.views||0,"مشاهدة"],["📞",memberData.calls||0,"اتصال"],["💬",memberData.waMessages||0,"واتساب"],["❤️",memberData.saves||0,"حفظ"]].map(([icon,val,label])=>(
            <div key={label} style={{background:card,borderRadius:11,padding:"11px 5px",textAlign:"center",border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
              <div style={{fontSize:16,marginBottom:2}}>{icon}</div>
              <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:15,color:C.gold}}>{val>999?`${(val/1000).toFixed(1)}ك`:val}</div>
              <div style={{fontSize:9.5,color:sub}}>{label}</div>
            </div>
          ))}
        </div>

        {/* Availability Toggle for Owner */}
        {isOwner&&(
          <div style={{background:card,borderRadius:13,padding:"11px 15px",marginBottom:11,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:tc}}>حالة التوفر</div>
              <div style={{fontSize:11.5,color:sub}}>{memberData.available!==false?"أنت متاح للعمل الآن":"أنت غير متاح حالياً"}</div>
            </div>
            <div className={`toggle ${memberData.available!==false?"on":""}`} onClick={async()=>{
              const newVal = memberData.available===false?true:false;
              await DB.toggleAvailability(member.id, newVal);
              setMemberData(p=>({...p,available:newVal}));
            }}/>
          </div>
        )}

        {/* Social */}
        {(memberData.facebook||memberData.instagram||memberData.website||memberData.lat)&&(
          <div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap"}}>
            {memberData.facebook&&<a href={`https://${memberData.facebook}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">📘</a>}
            {memberData.instagram&&<a href={`https://instagram.com/${memberData.instagram}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">📸</a>}
            {memberData.website&&<a href={`https://${memberData.website}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">🌐 الموقع</a>}
            {memberData.lat&&<button className="btn btn-outline btn-sm" onClick={()=>window.open(`https://maps.google.com/?q=${memberData.lat},${memberData.lng}`)}>📍 خريطة</button>}
          </div>
        )}

        {/* Save & Follow Buttons + Followers Count */}
        {!isOwner && currentUser && (
          <div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap"}}>
            <button 
              onClick={async () => {
                if (isSaved) {
                  await DB.removeSavedMember(currentUser.uid, member.id);
                  setIsSaved(false);
                } else {
                  await DB.saveMember(currentUser.uid, member.id);
                  setIsSaved(true);
                }
                onSaveUpdated?.();
              }}
              style={{
                flex:1,
                padding:"9px 13px",
                borderRadius:9,
                border:`1px solid ${isSaved?C.gold:darkMode?"rgba(201,168,76,.3)":"#E5E7EB"}`,
                background:isSaved?`${C.gold}15`:"transparent",
                color:isSaved?C.gold:sub,
                cursor:"pointer",
                fontFamily:"'Cairo'",
                fontWeight:700,
                fontSize:12.5,
                transition:"all .2s"
              }}
            >
              {isSaved?"❤️ محفوظ":"🤍 حفظ"}
            </button>
            <button 
              onClick={async () => {
                if (isFollowing) {
                  await DB.unfollowMember(currentUser.uid, member.id);
                  setIsFollowing(false);
                } else {
                  await DB.followMember(currentUser.uid, member.id, currentUser.displayName);
                  setIsFollowing(true);
                }
              }}
              style={{
                flex:1,
                padding:"9px 13px",
                borderRadius:9,
                border:`1px solid ${isFollowing?C.info:darkMode?"rgba(59,130,246,.3)":"#E5E7EB"}`,
                background:isFollowing?`${C.info}15`:"transparent",
                color:isFollowing?C.info:sub,
                cursor:"pointer",
                fontFamily:"'Cairo'",
                fontWeight:700,
                fontSize:12.5,
                transition:"all .2s"
              }}
            >
              {isFollowing?"👥 متابع":"👥 متابعة"}
            </button>
          </div>
        )}

        {/* Followers Count */}
        {followers > 0 && (
          <div style={{background:card,borderRadius:11,padding:"9px 13px",marginBottom:13,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,textAlign:"center"}}>
            <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:14,color:C.gold}}>{followers}</div>
            <div style={{color:sub,fontSize:10.5}}>👥 متابع</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",background:darkMode?"rgba(255,255,255,.05)":"#F0F4F8",borderRadius:11,padding:3.5,marginBottom:14,gap:3}}>
          {[["about","النبذة"],["works","الأعمال"],["reviews","التقييمات"],["video","فيديو"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px 0",border:"none",borderRadius:8,cursor:"pointer",background:tab===t?`linear-gradient(135deg,${C.gold},${C.goldDark})`:"transparent",color:tab===t?C.navyDeep:sub,fontFamily:"'Cairo'",fontWeight:700,fontSize:11.5,transition:"all .2s"}}>{l}</button>
          ))}
        </div>

        {tab==="about"&&(
          <div style={{animation:"fadeIn .28s ease"}}>
            <div style={{background:card,borderRadius:13,padding:15,marginBottom:11,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
              <h4 style={{color:tc,marginBottom:9,fontWeight:700}}>نبذة تعريفية</h4>
              <p style={{color:darkMode?"rgba(255,255,255,.68)":"#475569",fontSize:13,lineHeight:1.8}}>{member.bio||"لا توجد نبذة متاحة"}</p>
            </div>
            <div style={{background:card,borderRadius:13,padding:15,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
              <h4 style={{color:tc,marginBottom:11,fontWeight:700}}>معلومات التواصل</h4>
              {[["📱","الهاتف",member.phone],["📍","المنطقة",`${member.gov} - ${member.city}`],["⏳","سنوات الخبرة",member.experience?`${member.experience} سنة`:""],["📅","عضو منذ",member.joinDate||"2024"]].filter(([,,v])=>v).map(([icon,label,val])=>(
                <div key={label} style={{display:"flex",gap:9,marginBottom:10}}>
                  <div style={{width:34,height:34,borderRadius:9,background:"rgba(201,168,76,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{icon}</div>
                  <div><div style={{fontSize:10.5,color:sub}}>{label}</div><div style={{fontSize:13,fontWeight:600,color:tc}}>{val}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="works"&&(
          <WorksTab member={member} currentUser={currentUser} darkMode={darkMode}/>
        )}

        {tab==="reviews"&&(
          <div style={{animation:"fadeIn .28s ease"}}>
            {currentUser&&(
              <div style={{background:card,borderRadius:13,padding:15,marginBottom:13,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
                <h4 style={{color:tc,marginBottom:9,fontWeight:700}}>أضف تقييمك</h4>
                <div style={{marginBottom:9}}><StarRating rating={reviewRating} size={22} interactive onRate={setReviewRating}/></div>
                <textarea className={`input${darkMode?" input-dark":""}`} placeholder="شاركنا رأيك..." value={reviewText} onChange={e=>setReviewText(e.target.value)} rows={3}/>
                <button className="btn btn-primary btn-sm" style={{marginTop:9}} onClick={submitReview} disabled={submitting}>{submitting?<Spinner size={13} color={C.navyDeep}/>:"إرسال التقييم"}</button>
              </div>
            )}
            {reviews.map(r=>(
              <div key={r.id} style={{background:card,borderRadius:13,padding:13,marginBottom:9,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <Av text={r.name} size={32} type="basic"/>
                    <div><div style={{fontWeight:700,fontSize:12.5,color:tc}}>{r.name}</div><StarRating rating={r.rating} size={11}/></div>
                  </div>
                  <div style={{color:sub,fontSize:10.5}}>{tAgo(typeof r.time==="number"?r.time:r.time?.toMillis?.())||"اليوم"}</div>
                </div>
                <p style={{color:darkMode?"rgba(255,255,255,.68)":"#475569",fontSize:12.5}}>{r.text}</p>
              </div>
            ))}
            {reviews.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:sub}}>لا توجد تقييمات بعد</div>}
          </div>
        )}

        {tab==="video"&&(
          <div style={{animation:"fadeIn .28s ease"}}>
            {getVideoLimit(getMemberPlan(member), cfg) > 0 ? (
              member.introVideoUrl ? (
                <video src={member.introVideoUrl} controls style={{width:"100%",borderRadius:13,background:"#000"}}/>
              ) : (
                <div style={{background:card,borderRadius:13,overflow:"hidden",border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
                  <div style={{aspectRatio:"16/9",background:`linear-gradient(135deg,${C.navyDeep},${C.navy})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:48,marginBottom:10}}>🎬</div>
                    <div style={{color:C.gold,fontWeight:700}}>لا يوجد فيديو تعريفي بعد</div>
                    {currentUser?.uid===member.id&&<div style={{color:"rgba(255,255,255,.38)",fontSize:11.5,marginTop:3}}>أضف فيديو عند نشر منشور جديد</div>}
                  </div>
                </div>
              )
            ):(
              <div style={{textAlign:"center",padding:"38px 20px"}}>
                <div style={{fontSize:44,marginBottom:9}}>🎬</div>
                <div style={{color:tc,fontWeight:700,marginBottom:5}}>الفيديو متاح للباقات الأعلى فقط</div>
                <button className="btn btn-primary btn-sm" onClick={()=>{ if(!currentUser){onRequireAuth?.();return;} onShowPayment?.(); }}>ترقية الاشتراك</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQR&&(
        <div className="modal-overlay" onClick={()=>setShowQR(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{padding:"18px 22px 28px",textAlign:"center"}}>
              <h3 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:C.navy,marginBottom:4}}>QR Code</h3>
              <p style={{color:C.gray,fontSize:12.5,marginBottom:18}}>امسح الكود للوصول لملف {member.name}</p>
              <div style={{display:"flex",justifyContent:"center",marginBottom:18}}><QRDisplay value={`daleel://member/${member.id}`} size={160}/></div>
              <button className="btn btn-primary" style={{width:"100%"}} onClick={()=>setShowQR(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// JOBS SCREEN
// ============================================================
const JobsScreen = ({ darkMode, currentUser, onRequireAuth }) => {
  const isDesktop = useIsDesktop();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [applyModal, setApplyModal] = useState(null);
  const [applyNote, setApplyNote] = useState("");
  const [applicantsModal, setApplicantsModal] = useState(null);
  const [applicantsList, setApplicantsList] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postForm, setPostForm] = useState({ title:"", company:"", location:"", salary:"", type:"دوام كامل", desc:"", skills:"", urgent:false });
  const [posting, setPosting] = useState(false);
  const bg = darkMode?C.navyDeep:C.offWhite;
  const card = darkMode?C.cardBg:"white";
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.45)":C.gray;

  useEffect(()=>{ DB.getJobs().then(j=>{setJobs(j);setLoading(false);}); },[]);

  const filtered = useMemo(()=>{
    if(filter==="all") return jobs;
    if(filter==="urgent") return jobs.filter(j=>j.urgent);
    return jobs.filter(j=>j.type===filter);
  },[jobs,filter]);

  const handleApply = async () => {
    if(!applyModal) return;
    try {
      await DB.applyJob(applyModal.id, currentUser?.uid, {
        note: applyNote,
        applicantName: currentUser?.displayName || "مستخدم",
        applicantPhone: currentUser?.phone || "",
      });
      setJobs(p => p.map(j => j.id===applyModal.id ? {...j, applicants:(j.applicants||0)+1} : j));
      setAppliedJobs(p=>new Set([...p,applyModal.id]));
      setApplyModal(null); setApplyNote("");
    } catch(e) { alert("❌ " + e.message); }
  };

  const openPostModal = () => {
    if (!currentUser) { onRequireAuth?.(); return; }
    setShowPostModal(true);
  };

  const handlePostJob = async () => {
    if (!postForm.title.trim() || !postForm.company.trim() || !postForm.location.trim()) return;
    setPosting(true);
    try {
      const skills = postForm.skills.split(",").map(s=>s.trim()).filter(Boolean);
      const id = await DB.postJob({ ...postForm, skills, postedBy: currentUser?.uid });
      const newJob = { id, ...postForm, skills, applicants:0, postedAt: new Date() };
      setJobs(p => [newJob, ...p]);
      setShowPostModal(false);
      setPostForm({ title:"", company:"", location:"", salary:"", type:"دوام كامل", desc:"", skills:"", urgent:false });
    } catch(e) {
      alert("❌ " + e.message);
    }
    setPosting(false);
  };

  const openApplicants = async (job) => {
    setApplicantsModal(job);
    setLoadingApplicants(true);
    const apps = await DB.getJobApplications(job.id);
    setApplicantsList(apps);
    setLoadingApplicants(false);
  };

  const tPosted = d => { const diff=(Date.now()-(d instanceof Date?d:new Date(d)))/86400000; return diff<1?"اليوم":diff<7?`منذ ${Math.floor(diff)} أيام`:"منذ أسبوع+"; };

  return (
    <div style={{background:bg,minHeight:"100vh",paddingBottom:80}}>
      <div style={{background:`linear-gradient(135deg,${C.navyDeep},${C.navy})`,padding:isDesktop?"26px 0":"50px 16px 18px"}}>
        <div className={isDesktop?"desktop-container":undefined}>
          <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isDesktop?24:19,color:"white",marginBottom:3}}>💼 الوظائف المتاحة</h2>
          <p style={{color:"rgba(255,255,255,.45)",fontSize:12.5}}>ابحث عن فرصتك في قطاع البناء</p>
        </div>
      </div>
      <div className={isDesktop?"desktop-container":undefined}>
      <div className="scroll-x" style={{padding:"11px 14px 0"}}>
        {[["all","الكل"],["urgent","🔥 عاجل"],["دوام كامل","دوام كامل"],["فريلانسر","فريلانسر"]].map(([v,l])=>(
          <div key={v} className={`chip ${filter===v?"active":""}`} onClick={()=>setFilter(v)} style={{flexShrink:0}}>{l}</div>
        ))}
      </div>
      <div style={isDesktop?{padding:"11px 0",display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}:{padding:"11px 14px"}}>
        {loading?[1,2,3].map(i=><SkeletonCard key={i} dark={darkMode}/>):
        filtered.map((job,idx)=>(
          <div key={job.id} style={{background:card,borderRadius:15,padding:15,marginBottom:11,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,boxShadow:"0 2px 10px rgba(0,0,0,.04)",animation:`fadeInUp ${.1+idx*.07}s ease both`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9}}>
              <div>
                <div style={{display:"flex",gap:5,marginBottom:5}}>
                  {job.urgent&&<span className="badge badge-danger" style={{fontSize:9.5}}>🔥 عاجل</span>}
                  <span className="badge badge-free" style={{fontSize:9.5}}>{job.type}</span>
                </div>
                <div style={{fontWeight:800,fontSize:15.5,color:tc,marginBottom:3}}>{job.title}</div>
                <div style={{color:C.gold,fontSize:12.5,fontWeight:600}}>🏢 {job.company}</div>
              </div>
              <button onClick={()=>setSavedJobs(p=>{const n=new Set(p);n.has(job.id)?n.delete(job.id):n.add(job.id);return n;})} style={{background:"none",border:"none",fontSize:21,cursor:"pointer",color:savedJobs.has(job.id)?C.gold:C.gray}}>{savedJobs.has(job.id)?"🔖":"🏷️"}</button>
            </div>
            {job.desc&&<p style={{fontSize:12.5,color:sub,marginBottom:9,lineHeight:1.62}}>{job.desc}</p>}
            <div style={{display:"flex",gap:9,color:sub,fontSize:11.5,marginBottom:9,flexWrap:"wrap"}}>
              <span>📍 {job.location}</span><span>💰 {job.salary}</span><span>🕐 {tPosted(job.postedAt)}</span><span>👥 {job.applicants} متقدم</span>
            </div>
            {job.cvNumber && (
              <div style={{background:`${C.gold}15`,border:`1px solid ${C.gold}33`,borderRadius:9,padding:"9px 11px",marginBottom:11,display:"flex",alignItems:"center",gap:7}}>
                <span>📧 رقم CV:</span>
                <span style={{fontFamily:"monospace",fontWeight:700,color:C.gold}}>{job.cvNumber}</span>
              </div>
            )}
            {job.skills?.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:11}}>
              {job.skills.map(sk=><span key={sk} className="chip chip-gray" style={{fontSize:10.5,padding:"3px 9px"}}>{sk}</span>)}
            </div>}
            <div style={{display:"flex",gap:7}}>
              <button className={`btn btn-sm ${appliedJobs.has(job.id)?"btn-ghost":"btn-primary"}`} style={{flex:1}}
                onClick={()=>{if(appliedJobs.has(job.id))return;setApplyModal(job);}}>
                {appliedJobs.has(job.id)?"✅ تم التقديم":"تقدم الآن →"}
              </button>
              {(currentUser?.isAdmin || job.postedBy===currentUser?.uid) && (
                <button className="btn btn-sm btn-outline" onClick={()=>openApplicants(job)} style={{padding:"7px 11px"}}>👥 المتقدمين</button>
              )}
              {currentUser?.isAdmin && (
                <button className="btn btn-sm btn-ghost" onClick={async () => {
                  if (window.confirm("حذف الوظيفة نهائياً؟")) {
                    await DB.deleteJob(job.id);
                    setJobs(p => p.filter(j => j.id !== job.id));
                  }
                }} style={{padding:"7px 11px"}}>🗑️</button>
              )}
            </div>
          </div>
        ))}

        <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyLight})`,borderRadius:15,padding:18,textAlign:"center",border:`1px solid rgba(201,168,76,.2)`,...(isDesktop?{gridColumn:"1 / -1"}:{})}}>
          <div style={{fontSize:34,marginBottom:7}}>📢</div>
          <div style={{fontFamily:"'Cairo'",fontWeight:800,color:"white",fontSize:14.5,marginBottom:3}}>هل تبحث عن موظفين؟</div>
          <p style={{color:"rgba(255,255,255,.55)",fontSize:12,marginBottom:12}}>انشر وظيفتك وتواصل مع المتخصصين</p>
          <button className="btn btn-primary btn-sm" onClick={openPostModal}>+ نشر وظيفة</button>
        </div>
      </div>
      </div>

      {applyModal&&(
        <div className="modal-overlay" onClick={()=>setApplyModal(null)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{padding:"15px 18px 28px"}}>
              <h3 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:C.navy,marginBottom:3}}>التقديم على الوظيفة</h3>
              <p style={{color:C.gray,fontSize:12.5,marginBottom:14}}>📌 {applyModal.title} — {applyModal.company}</p>
              <div className="form-group">
                <label className="form-label">رسالة التقديم (اختياري)</label>
                <textarea className="input" placeholder="اكتب نبذة عن خبرتك..." value={applyNote} onChange={e=>setApplyNote(e.target.value)} rows={4}/>
              </div>
              <button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:7}} onClick={handleApply}>إرسال الطلب ✉️</button>
              <button className="btn btn-ghost" style={{width:"100%"}} onClick={()=>setApplyModal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {applicantsModal&&(
        <div className="modal-overlay" onClick={()=>setApplicantsModal(null)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{padding:"15px 18px 28px",maxHeight:"80vh",overflowY:"auto"}}>
              <h3 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:C.navy,marginBottom:3}}>👥 المتقدمين</h3>
              <p style={{color:C.gray,fontSize:12.5,marginBottom:14}}>📌 {applicantsModal.title} — {applicantsModal.company}</p>
              {loadingApplicants ? (
                <div style={{textAlign:"center",padding:"20px 0"}}><Spinner size={22} color={C.gold}/></div>
              ) : applicantsList.length===0 ? (
                <div style={{textAlign:"center",padding:"20px 0",color:C.gray,fontSize:13}}>لسه محدش قدّم على الوظيفة دي</div>
              ) : applicantsList.map(app=>(
                <div key={app.id} style={{background:"#F8FAFF",borderRadius:12,padding:"11px 13px",marginBottom:9,border:`1px solid ${C.grayLight}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <div style={{fontWeight:700,fontSize:13.5,color:C.navy}}>{app.applicantName||"مستخدم"}</div>
                    <span style={{fontSize:10,color:C.gray}}>{tPosted(app.appliedAt?.toDate?.()||app.appliedAt)}</span>
                  </div>
                  {app.note && <p style={{fontSize:12,color:C.gray,marginBottom:8,lineHeight:1.5}}>{app.note}</p>}
                  {app.applicantPhone && (
                    <div style={{display:"flex",gap:7}}>
                      <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={()=>window.open(`tel:${app.applicantPhone}`)}>📞 اتصال</button>
                      <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>window.open(`https://wa.me/2${app.applicantPhone}`)}>💬 واتساب</button>
                    </div>
                  )}
                </div>
              ))}
              <button className="btn btn-ghost" style={{width:"100%",marginTop:5}} onClick={()=>setApplicantsModal(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {showPostModal&&(
        <div className="modal-overlay" onClick={()=>!posting&&setShowPostModal(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{padding:"15px 18px 28px",maxHeight:"80vh",overflowY:"auto"}}>
              <h3 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:C.navy,marginBottom:14}}>📢 نشر وظيفة جديدة</h3>
              <div className="form-group">
                <label className="form-label req">المسمى الوظيفي</label>
                <input className="input" placeholder="مثال: مهندس موقع" value={postForm.title} onChange={e=>setPostForm(p=>({...p,title:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label req">اسم الشركة / صاحب العمل</label>
                <input className="input" placeholder="اسم الشركة" value={postForm.company} onChange={e=>setPostForm(p=>({...p,company:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label req">الموقع</label>
                <input className="input" placeholder="مثال: القاهرة - مدينة نصر" value={postForm.location} onChange={e=>setPostForm(p=>({...p,location:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">الراتب</label>
                <input className="input" placeholder="مثال: 6,000 - 9,000 ج" value={postForm.salary} onChange={e=>setPostForm(p=>({...p,salary:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">نوع الدوام</label>
                <select className="select" value={postForm.type} onChange={e=>setPostForm(p=>({...p,type:e.target.value}))}>
                  <option value="دوام كامل">دوام كامل</option>
                  <option value="فريلانسر">فريلانسر</option>
                  <option value="دوام جزئي">دوام جزئي</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">وصف الوظيفة</label>
                <textarea className="input" placeholder="تفاصيل الوظيفة والمتطلبات..." value={postForm.desc} onChange={e=>setPostForm(p=>({...p,desc:e.target.value}))} rows={4}/>
              </div>
              <div className="form-group">
                <label className="form-label">المهارات المطلوبة (افصل بينها بفاصلة)</label>
                <input className="input" placeholder="مثال: AutoCAD, إدارة مواقع" value={postForm.skills} onChange={e=>setPostForm(p=>({...p,skills:e.target.value}))}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                <div className={`toggle ${postForm.urgent?"on":""}`} onClick={()=>setPostForm(p=>({...p,urgent:!p.urgent}))}/>
                <span style={{fontSize:12.5,color:C.navy}}>🔥 وظيفة عاجلة</span>
              </div>
              <button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:7}} disabled={posting} onClick={handlePostJob}>
                {posting?<><Spinner size={14} color={C.navyDeep}/> جاري النشر...</>:"نشر الوظيفة ✅"}
              </button>
              <button className="btn btn-ghost" style={{width:"100%"}} onClick={()=>!posting&&setShowPostModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// AI ASSISTANT SCREEN
// ============================================================
// NOTIFICATIONS SCREEN
// ============================================================
const NotificationsScreen = ({ darkMode, currentUser }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState(new Set());
  const [openNotif, setOpenNotif] = useState(null);
  const bg = darkMode?C.navyDeep:C.offWhite;
  const card = darkMode?C.cardBg:"white";
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.45)":C.gray;
  const tAgo = t => {
    const ms = t?.toMillis?.() || (t?.seconds ? t.seconds*1000 : typeof t==="number" ? t : Date.now());
    const d=(Date.now()-ms)/60000;
    return d<1?"الآن":d<60?`${Math.floor(d)} د`:d<1440?`${Math.floor(d/60)} س`:`${Math.floor(d/1440)} يوم`;
  };

  useEffect(()=>{
    (async () => {
      let memberType = "starter";
      try {
        if (currentUser?.uid) {
          const snap = await getDoc(doc(db,"members",currentUser.uid));
          if (snap.exists()) memberType = getMemberPlan(snap.data());
        }
      } catch {}
      const n = await DB.getNotifications(currentUser?.uid, memberType);
      setNotifications(n);
      // نبدأ readIds بالإشعارات المتعلّمة "مقروءة" فعليًا من قبل (محفوظة في Firestore)
      // بدل ما تفضل كلها تبان "غير مقروءة" كل ما المستخدم يفتح الشاشة أو يعمل ريفريش
      setReadIds(new Set(n.filter(x=>DB.isNotifRead(x, currentUser?.uid)).map(x=>x.id)));
      setLoading(false);
    })();
  },[currentUser?.uid]);

  const openNotification = (n) => {
    if (!readIds.has(n.id)) {
      setReadIds(p=>new Set([...p,n.id]));
      if (currentUser?.uid) DB.markNotificationRead(n, currentUser.uid);
    }
    setOpenNotif(n);
  };

  const markAllRead = () => {
    const unread = notifications.filter(n=>!readIds.has(n.id));
    setReadIds(new Set(notifications.map(n=>n.id)));
    if (currentUser?.uid) unread.forEach(n => DB.markNotificationRead(n, currentUser.uid));
  };

  return (
    <div style={{background:bg,minHeight:"100vh",paddingBottom:80}}>
      <div style={{background:`linear-gradient(135deg,${C.navyDeep},${C.navy})`,padding:"50px 16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:19,color:"white"}}>🔔 الإشعارات</h2>
        <button onClick={markAllRead} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:12.5,fontFamily:"'Tajawal'"}}>تعليم الكل مقروء</button>
      </div>
      <div style={{padding:"13px"}}>
        {loading?[1,2,3].map(i=><SkeletonCard key={i} dark={darkMode}/>):
        notifications.length===0?<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:52,marginBottom:12}}>🔔</div><div style={{color:tc,fontWeight:700}}>لا توجد إشعارات</div><div style={{color:sub,fontSize:13,marginTop:5}}>ستظهر هنا الإشعارات من الإدارة</div></div>:
        notifications.map((n,i)=>{
          const read = readIds.has(n.id);
          return (
            <div key={n.id} onClick={()=>openNotification(n)} style={{background:card,borderRadius:13,padding:13,marginBottom:7,border:`1px solid ${!read?`${n.color||C.gold}3a`:(darkMode?"rgba(201,168,76,.06)":C.grayLight)}`,display:"flex",gap:11,cursor:"pointer",opacity:read?.8:1,animation:`fadeInUp ${.1+i*.05}s ease both`,transition:"all .2s"}}>
              <div style={{width:42,height:42,borderRadius:11,background:`${n.color||C.gold}1a`,border:`1px solid ${n.color||C.gold}3a`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{n.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontWeight:700,fontSize:13.5,color:tc}}>{n.title}</span>
                  {!read&&<div style={{width:7.5,height:7.5,borderRadius:"50%",background:n.color||C.gold,flexShrink:0,marginTop:4}}/>}
                </div>
                <div style={{color:sub,fontSize:12.5,marginBottom:2,lineHeight:1.5}}>{n.body||n.text}</div>
                <div style={{color:sub,fontSize:10.5}}>{tAgo(n.time||n.createdAt||Date.now())}</div>
              </div>
            </div>
          );
        })}
      </div>
      {openNotif && (
        <div className="modal-overlay" onClick={()=>setOpenNotif(null)}>
          <div className="modal-sheet" style={{ background:card }} onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{ padding:"18px 20px 28px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{width:46,height:46,borderRadius:12,background:`${openNotif.color||C.gold}1a`,border:`1px solid ${openNotif.color||C.gold}3a`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{openNotif.icon}</div>
                <div style={{flex:1}}>
                  <h3 style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:16,color:tc }}>{openNotif.title}</h3>
                  <div style={{ color:sub, fontSize:11 }}>{tAgo(openNotif.time||openNotif.createdAt||Date.now())}</div>
                </div>
              </div>
              <p style={{ color:tc, fontSize:14, lineHeight:1.9, whiteSpace:"pre-wrap" }}>{openNotif.body||openNotif.text}</p>
              <button className="btn btn-primary btn-lg" style={{ width:"100%", marginTop:18 }} onClick={()=>setOpenNotif(null)}>تم</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// PAYMENT SCREEN
// ============================================================
const PaymentScreen = ({ onBack, darkMode, onSuccess }) => {
  const cfg = useConfig();
  const [plan, setPlan] = useState("premium");
  const [method, setMethod] = useState("vodafone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const bg = darkMode?C.navyDeep:C.offWhite;
  const card = darkMode?C.cardBg:"white";
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.45)":C.gray;
  const p = PLANS[plan];
  const livePrice = getPlanPrice(plan, cfg);
  const methods = [["vodafone","📱","فودافون كاش"],["instapay","💳","InstaPay"],["fawry","🏪","فوري"],["card","💰","بطاقة بنكية"]];

  const handlePay = () => {
    const methodName = methods.find(m=>m[0]===method)?.[2] || method;
    const msg = `مرحباً، أريد الاشتراك في باقة ${p.label} بسعر ${livePrice} جنيه سنويًا عن طريق ${methodName}${phone ? " - رقم: " + phone : ""}`;
    window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <div style={{background:bg,minHeight:"100vh",paddingBottom:80}}>
      <div style={{background:`linear-gradient(135deg,${C.navyDeep},${C.navy})`,padding:"50px 16px 20px",display:"flex",gap:11,alignItems:"center"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"white",fontSize:21,cursor:"pointer"}}>←</button>
        <div>
          <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:19,color:"white"}}>💳 ترقية الاشتراك</h2>
          <p style={{color:"rgba(255,255,255,.45)",fontSize:12.5}}>اختر الباقة المناسبة</p>
        </div>
      </div>
      <div style={{padding:"15px"}}>
        <h3 style={{color:tc,fontFamily:"'Cairo'",fontWeight:700,marginBottom:11}}>الباقات</h3>
        {Object.entries(PLANS).map(([key,pl])=>(
          <div key={key} onClick={()=>setPlan(key)} style={{background:key==="vip"&&plan===key?"linear-gradient(145deg,#1a0a3c,#2d1b69)":card,borderRadius:15,padding:15,marginBottom:9,cursor:"pointer",border:`2px solid ${plan===key?pl.color:darkMode?"rgba(201,168,76,.1)":C.grayLight}`,transition:"all .2s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                <span className={`badge badge-${key}`}>{pl.label}</span>
                {plan===key&&<span style={{color:pl.color}}>✓</span>}
              </div>
              <span style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:17,color:pl.color}}>{getPlanPrice(key,cfg)} ج/سنة</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:3.5}}>
              {pl.features.map(f=><div key={f} style={{fontSize:11.5,color:key==="vip"&&plan===key?"rgba(255,255,255,.72)":sub,display:"flex",gap:5}}><span style={{color:pl.color}}>✓</span>{f}</div>)}
            </div>
          </div>
        ))}

        <h3 style={{color:tc,fontFamily:"'Cairo'",fontWeight:700,marginBottom:11,marginTop:5}}>طريقة الدفع</h3>
        <div className="grid-2" style={{marginBottom:13}}>
          {methods.map(([id,icon,label])=>(
            <div key={id} onClick={()=>setMethod(id)} style={{background:card,borderRadius:11,padding:"13px 9px",textAlign:"center",cursor:"pointer",border:`2px solid ${method===id?C.gold:darkMode?"rgba(201,168,76,.1)":C.grayLight}`,transition:"all .2s"}}>
              <div style={{fontSize:24,marginBottom:5}}>{icon}</div>
              <div style={{fontSize:11.5,fontWeight:700,color:tc}}>{label}</div>
            </div>
          ))}
        </div>

        {method!=="card"&&(
          <div className="form-group" style={{marginBottom:18}}>
            <label className="form-label req" style={{color:tc}}>رقم الهاتف</label>
            <input className={`input${darkMode?" input-dark":""}`} type="tel" placeholder="01xxxxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)}/>
          </div>
        )}

        <div style={{background:"rgba(201,168,76,.07)",border:`1px solid rgba(201,168,76,.2)`,borderRadius:13,padding:13,marginBottom:15}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:sub,fontSize:12.5}}>الباقة</span><span style={{fontWeight:700,color:tc}}>{p.label}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:sub,fontSize:12.5}}>طريقة الدفع</span><span style={{fontWeight:700,color:tc}}>{methods.find(m=>m[0]===method)?.[2]}</span></div>
          <div className="divider"/>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontFamily:"'Cairo'",fontWeight:800,color:tc}}>المجموع</span>
            <span style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:19,color:C.gold}}>{livePrice} جنيه</span>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{width:"100%"}} onClick={handlePay}>
          تواصل لإتمام الدفع عبر واتساب 💬
        </button>
        <div style={{textAlign:"center",color:sub,fontSize:11.5,marginTop:10}}>📞 سيتم التواصل معك لتأكيد الاشتراك</div>
      </div>
    </div>
  );
};

// ============================================================
// REGISTER / MY PROFILE SCREEN
// ============================================================
const RegisterScreen = ({ onSuccess, darkMode, currentUser }) => {
  const cfg = useConfig();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({type:"",name:"",specialty:"",gov:"",city:"",experience:"",phone:"",bio:"",facebook:"",instagram:"",tiktok:"",website:"",plan:"starter"});
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [avatarPrev, setAvatarPrev] = useState(null);
  const [coverPrev, setCoverPrev] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [customCity, setCustomCity] = useState(false);
  const [locatingMe, setLocatingMe] = useState(false);
  const [originalPlan, setOriginalPlan] = useState(null);
  const avatarRef = useRef(null);
  const coverRef = useRef(null);
  const bg = darkMode?C.navyDeep:C.offWhite;
  const card = darkMode?C.cardBg:"white";
  const tc = darkMode?"white":C.navy;
  const sub = darkMode?"rgba(255,255,255,.45)":C.gray;
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const steps = ["النوع","البيانات","السوشيال","الباقة"];
  const types = [["craftsman","🔧","صنايعي"],["technician","⚡","فني"],["engineer","📐","مهندس"],["contractor","🏢","مقاول"],["company","🏢","شركة"],["supplier","📦","مورد"],["developer","🏙️","مطور"]];

  useEffect(() => {
    if (!currentUser?.uid) { setLoadingProfile(false); return; }
    getDoc(doc(db, "members", currentUser.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setForm(p => ({ ...p, ...data }));
        if (data.city && !getMarakez(data.gov).includes(data.city)) setCustomCity(true);
        if (data.avatarUrl) setAvatarPrev(data.avatarUrl);
        if (data.coverUrl) setCoverPrev(data.coverUrl);
        if (data.type) setStep(2);
        // بنسجل الباقة الحالية الأصلية عشان نعرف لو المستخدم غيّرها وقت الحفظ
        setOriginalPlan(data.plan || data.type || "starter");
      }
      setLoadingProfile(false);
    }).catch(() => setLoadingProfile(false));
  }, [currentUser?.uid]);

  // تنظيف معاينات الأفاتار والغلاف (لو كانت blob محلي) لما الشاشة تتقفل
  const avatarPrevRef = useRef(avatarPrev);
  const coverPrevRef = useRef(coverPrev);
  avatarPrevRef.current = avatarPrev;
  coverPrevRef.current = coverPrev;
  useEffect(() => () => {
    if (avatarPrevRef.current?.startsWith("blob:")) URL.revokeObjectURL(avatarPrevRef.current);
    if (coverPrevRef.current?.startsWith("blob:")) URL.revokeObjectURL(coverPrevRef.current);
  }, []);

  // ملحوظة: بنستخدم uploadBlobToStorage الموحّدة (فيها timeout ومعالجة أخطاء) بدل ما نكرر نفس المنطق هنا

  const handleSubmit = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let avatarUrl = form.avatarUrl || "";
      let coverUrl = form.coverUrl || "";
      // رفع الصورة الشخصية لـ Firebase Storage
      if (avatarFile) {
        setUploadProgress("📸 جاري رفع الصورة الشخصية...");
        avatarUrl = await uploadBlobToStorage(avatarFile, `avatars/${currentUser.uid}`);
      }
      // رفع صورة الغلاف لـ Firebase Storage
      if (coverFile) {
        setUploadProgress("🖼️ جاري رفع صورة الغلاف...");
        coverUrl = await uploadBlobToStorage(coverFile, `covers/${currentUser.uid}`);
      }
      setUploadProgress("");
      // تغيير الباقة من هنا مش بيتحفظ مباشرة — لازم يتواصل مع الإدارة الأول لتأكيد الدفع
      // (نفس فكرة approveMember بالظبط، بس هنا العضو نفسه اللي بيحاول يغيّر لنفسه)
      const planChanged = originalPlan && form.plan && form.plan !== originalPlan;
      const memberData = {
        ...form,
        id: currentUser.uid,
        uid: currentUser.uid,
        name: form.name || currentUser.displayName || "",
        phone: form.phone || currentUser.phone || "",
        updatedAt: new Date(),
        available: true,
        // نضمن إن الموقع الجغرافي (لو اتحدد) يتحفظ صريح كرقم، مش يتسحب بس من الفورم
        // عشان نتفادى أي مشكلة لو النوع اتغيّر لحاجة تانية غير رقم بالغلط في أي حتة
        ...(form.lat != null && { lat: Number(form.lat), lng: Number(form.lng) }),
        ...(avatarUrl && { avatarUrl }),
        ...(coverUrl && { coverUrl }),
        // لو غيّر الباقة، بنرجّعها زي ما كانت — مش هتتفعل غير من لوحة الأدمن بعد الدفع
        ...(planChanged && { plan: originalPlan }),
      };
      await setDoc(doc(db, "members", currentUser.uid), {
        views: 0, calls: 0, waMessages: 0, saves: 0, rating: 0, reviews: 0, createdAt: new Date(),
        ...memberData,
      }, { merge: true });
      setLoading(false);
      setUploadProgress("");

      if (planChanged) {
        const planLabel = PLANS[form.plan]?.label || form.plan;
        const price = getPlanPrice(form.plan, cfg);
        const msg = `مرحباً، أريد زيادة/تغيير الاشتراك الخاص بي إلى باقة ${planLabel} بسعر ${price} جنيه سنويًا - الاسم: ${memberData.name} - الهاتف: ${memberData.phone}`;
        alert(`✅ تم حفظ باقي بياناتك بنجاح.\n\n⚠️ بخصوص تغيير الباقة إلى "${planLabel}": برجاء التحدث إلى الإدارة لتأكيد الدفع (${price} جنيه/سنة) وتفعيل الباقة الجديدة.`);
        window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`);
      }

      onSuccess(); // بننده بس لما الحفظ ينجح فعلاً
    } catch(e) {
      alert(`خطأ في الحفظ (${e.code||"بدون كود"}): ${e.message||e}`);
      setLoading(false);
      setUploadProgress("");
      // مانقفلش/مانطلعش من الشاشة هنا — عشان المستخدم يقدر يعيد المحاولة
    }
  };

  if (loadingProfile) return (
    <div style={{background:bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",paddingBottom:80}}>
      <Spinner size={32} color={C.gold}/>
    </div>
  );

  return (
    <div style={{background:bg,minHeight:"100vh",paddingBottom:80}}>
      <div style={{background:`linear-gradient(145deg,${C.navyDeep},${C.navy})`,padding:"50px 16px 20px"}}>
        <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:19,color:"white",marginBottom:13}}>📝 {currentUser?"تعديل ملفي المهني":"إنشاء حساب مهني"}</h2>
        <div style={{display:"flex",gap:0}}>
          {steps.map((name,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
              <div style={{height:3.5,background:step>i+1?C.gold:step===i+1?C.gold:"rgba(255,255,255,.18)",borderRadius:i===0?"2px 0 0 2px":i===steps.length-1?"0 2px 2px 0":0,transition:"all .38s"}}/>
              <div style={{fontSize:9,color:step>=i+1?C.gold:"rgba(255,255,255,.28)",textAlign:"center"}}>{name}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"18px 15px"}}>
        {step===1&&(
          <div style={{animation:"fadeInUp .38s ease"}}>
            <div className="section-title" style={{color:tc,marginBottom:5}}>نوع حسابك</div>
            <div className="gold-line"/>
            <div className="grid-2">
              {types.map(([id,icon,label])=>(
                <div key={id} onClick={()=>set("type",id)} style={{background:card,borderRadius:13,padding:"16px 11px",textAlign:"center",cursor:"pointer",border:`2px solid ${form.type===id?C.gold:darkMode?"rgba(201,168,76,.1)":C.grayLight}`,transition:"all .2s",transform:form.type===id?"scale(1.02)":"scale(1)"}}>
                  <div style={{fontSize:28,marginBottom:7}}>{icon}</div>
                  <div style={{fontWeight:700,fontSize:13,color:tc}}>{label}</div>
                  {form.type===id&&<div style={{color:C.gold,fontSize:17,marginTop:5}}>✓</div>}
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" style={{width:"100%",marginTop:16}} disabled={!form.type} onClick={()=>setStep(2)}>التالي ←</button>
          </div>
        )}

        {step===2&&(
          <div style={{animation:"fadeInUp .38s ease"}}>
            <div className="section-title" style={{color:tc,marginBottom:5}}>بياناتك المهنية</div>
            <div className="gold-line"/>
            {/* Avatar & Cover */}
            <div style={{marginBottom:15}}>
              <div style={{height:95,borderRadius:13,background:coverPrev?`url(${coverPrev}) center/cover`:`linear-gradient(135deg,${C.navy},${C.navyLight})`,position:"relative",marginBottom:7,cursor:"pointer"}} onClick={()=>coverRef.current?.click()}>
                {!coverPrev&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,.38)",fontSize:12.5}}>📷 صورة الغلاف</div>}
              </div>
              <input type="file" ref={coverRef} accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){if(coverPrev&&coverPrev.startsWith("blob:"))URL.revokeObjectURL(coverPrev);setCoverFile(f);setCoverPrev(URL.createObjectURL(f));}}}/>
              <div style={{display:"flex",alignItems:"center",gap:11}}>
                <div onClick={()=>avatarRef.current?.click()} style={{width:60,height:60,borderRadius:"50%",border:`2px dashed ${C.gold}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",background:avatarPrev?`url(${avatarPrev}) center/cover`:  "rgba(201,168,76,.07)",overflow:"hidden",flexShrink:0}}>
                  {!avatarPrev&&<span style={{fontSize:22}}>📸</span>}
                </div>
                <input type="file" ref={avatarRef} accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){if(avatarPrev&&avatarPrev.startsWith("blob:"))URL.revokeObjectURL(avatarPrev);setAvatarFile(f);setAvatarPrev(URL.createObjectURL(f));}}}/>
                <div style={{color:sub,fontSize:12}}>انقر لإضافة صورة شخصية</div>
              </div>
            </div>
            {[["name","الاسم الكامل","text","أدخل اسمك",true],["specialty","التخصص","text","مثال: سباكة وصرف صحي",true],["phone","رقم الهاتف","tel","01xxxxxxxxx",true]].map(([k,l,t,ph,req])=>(
              <div key={k} className="form-group">
                <label className={`form-label${req?" req":""}`} style={{color:tc}}>{l}</label>
                <input className={`input${darkMode?" input-dark":""}`} type={t} placeholder={ph} value={form[k]} onChange={e=>set(k,e.target.value)}/>
              </div>
            ))}
            <div className="form-group">
              <label className="form-label req" style={{color:tc}}>المحافظة</label>
              <select className={`select${darkMode?" select-dark":""}`} value={form.gov} onChange={e=>{set("gov",e.target.value);set("city","");setCustomCity(false);}}>
                <option value="">اختر المحافظة</option>
                {GOVERNORATES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{color:tc}}>المدينة / المركز</label>
              {!customCity && (
                <select className={`select${darkMode?" select-dark":""}`} value={form.city} onChange={e=>{ if(e.target.value==="أخرى"){ setCustomCity(true); set("city",""); } else { set("city",e.target.value); } }} disabled={!form.gov}>
                  <option value="">{form.gov?"اختر المدينة / المركز":"اختر المحافظة أولاً"}</option>
                  {getMarakez(form.gov).map(c=><option key={c} value={c}>{c}</option>)}
                  {form.gov&&<option value="أخرى">أخرى</option>}
                </select>
              )}
              {customCity&&(
                <div style={{display:"flex",gap:7}}>
                  <input className={`input${darkMode?" input-dark":""}`} placeholder="اكتب اسم المدينة/المركز" value={form.city} onChange={e=>set("city",e.target.value)} autoFocus/>
                  <button type="button" className="btn btn-outline" style={{flexShrink:0,padding:"0 12px"}} onClick={()=>{setCustomCity(false);set("city","");}}>رجوع</button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" style={{color:tc}}>سنوات الخبرة</label>
              <input className={`input${darkMode?" input-dark":""}`} type="number" min="0" placeholder="مثال: 5" value={form.experience||""} onChange={e=>set("experience",e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label" style={{color:tc}}>نبذة تعريفية</label>
              <textarea className={`input${darkMode?" input-dark":""}`} placeholder="اكتب نبذة عن خبرتك وتخصصاتك..." value={form.bio} onChange={e=>set("bio",e.target.value)} rows={3}/>
            </div>
            <div style={{display:"flex",gap:9}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>setStep(1)}>→ السابق</button>
              <button className="btn btn-primary" style={{flex:2}} disabled={!form.name||!form.specialty||!form.phone||!form.gov} onClick={()=>setStep(3)}>التالي ←</button>
            </div>
          </div>
        )}

        {step===3&&(
          <div style={{animation:"fadeInUp .38s ease"}}>
            <div className="section-title" style={{color:tc,marginBottom:5}}>روابط التواصل الاجتماعي</div>
            <div className="gold-line"/>
            <p style={{color:sub,fontSize:12.5,marginBottom:15}}>أضف روابطك لزيادة المصداقية (اختياري)</p>
            {[["facebook","📘","فيسبوك","facebook.com/username"],["instagram","📸","إنستجرام","@username"],["tiktok","🎵","تيك توك","@username"],["website","🌐","الموقع الإلكتروني","www.yoursite.com"]].map(([k,icon,label,ph])=>(
              <div key={k} className="form-group">
                <label className="form-label" style={{color:tc}}>{icon} {label}</label>
                <input className={`input${darkMode?" input-dark":""}`} placeholder={ph} value={form[k]} onChange={e=>set(k,e.target.value)}/>
              </div>
            ))}
            <div className="form-group">
              <label className="form-label" style={{color:tc}}>📍 موقعك على الخريطة (اختياري)</label>
              <p style={{color:sub,fontSize:11.5,marginBottom:8}}>يساعد العملاء يلاقوك بسهولة على خرائط جوجل من صفحة بروفايلك</p>
              {form.lat ? (
                <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",borderRadius:10,padding:"9px 12px"}}>
                  <span style={{color:C.success,fontWeight:700,fontSize:12.5,flex:1}}>✅ تم تحديد موقعك</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={()=>{set("lat",null);set("lng",null);}}>إزالة</button>
                </div>
              ) : (
                <button type="button" className="btn btn-outline" style={{width:"100%"}} disabled={locatingMe} onClick={()=>{
                  setLocatingMe(true);
                  getMyLocation(
                    (pos) => { set("lat", pos.coords.latitude); set("lng", pos.coords.longitude); setLocatingMe(false); },
                    (msg) => { alert("⚠️ " + msg); setLocatingMe(false); }
                  );
                }}>{locatingMe ? <><Spinner size={15} color={C.gold}/> جاري التحديد...</> : "📍 حدد موقعي الحالي"}</button>
              )}
            </div>
            <div style={{display:"flex",gap:9,marginTop:5}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>setStep(2)}>→ السابق</button>
              <button className="btn btn-primary" style={{flex:2}} onClick={()=>setStep(4)}>التالي ←</button>
            </div>
          </div>
        )}

        {step===4&&(
          <div style={{animation:"fadeInUp .38s ease"}}>
            <div className="section-title" style={{color:tc,marginBottom:5}}>اختر باقة اشتراكك</div>
            <div className="gold-line"/>
            {Object.entries(PLANS).map(([key,pl])=>(
              <div key={key} onClick={()=>set("plan",key)} style={{background:key==="vip"&&form.plan===key?"linear-gradient(145deg,#1a0a3c,#2d1b69)":card,borderRadius:15,padding:15,marginBottom:9,border:`2px solid ${form.plan===key?pl.color:darkMode?"rgba(201,168,76,.1)":C.grayLight}`,cursor:"pointer",transition:"all .2s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <span className={`badge badge-${key}`}>{pl.label}</span>
                    {form.plan===key&&<span style={{color:pl.color}}>✓</span>}
                  </div>
                  <span style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:15.5,color:pl.color}}>{getPlanPrice(key,cfg)} ج/سنة</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {pl.features.map(f=><div key={f} style={{fontSize:11.5,color:key==="vip"&&form.plan===key?"rgba(255,255,255,.7)":sub,display:"flex",gap:5}}><span style={{color:pl.color}}>✓</span>{f}</div>)}
                </div>
              </div>
            ))}
            {originalPlan && form.plan !== originalPlan && (
              <div style={{background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.3)",borderRadius:11,padding:"10px 13px",marginBottom:9,fontSize:11.5,color:C.warning,lineHeight:1.6}}>
                ⚠️ اخترت باقة مختلفة عن باقتك الحالية. الباقة الجديدة مش هتتفعل تلقائي — هيتفتحلك واتساب بعد الحفظ للتواصل مع الإدارة وتأكيد الدفع.
              </div>
            )}
            <div style={{display:"flex",gap:9,marginTop:5}}>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>setStep(3)}>→ السابق</button>
              <button className="btn btn-primary" style={{flex:2}} onClick={handleSubmit} disabled={loading}>
                {loading ? <><Spinner size={15} color={C.navyDeep}/> {uploadProgress||"جاري الحفظ..."}</> : "حفظ الحساب 🎉"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// ADMIN SCREEN
// ============================================================
// ============================================================
// ADMIN SCREEN — Full Control Panel
// ============================================================
const MyProfileScreen = ({ onSuccess, darkMode, currentUser, onMemberClick, onShowPayment }) => {
  const cfg = useConfig();
  const isDesktop = useIsDesktop();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current:"", next:"", confirm:"" });
  const [pwError, setPwError] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;

  useEffect(() => {
    if (!currentUser?.uid) { setLoading(false); return; }
    getDoc(doc(db, "members", currentUser.uid)).then(snap => {
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentUser?.uid]);

  if (loading) return (
    <div style={{background:bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",paddingBottom:80}}>
      <Spinner size={32} color={C.gold}/>
    </div>
  );

  if (!profile || editing) return (
    <RegisterScreen onSuccess={()=>{ setEditing(false); onSuccess(); setProfile(null); }} darkMode={darkMode} currentUser={currentUser}/>
  );

  const planInfo = PLANS[getMemberPlan(profile)] || PLANS.starter;

  return (
    <div style={{background:bg, minHeight:"100vh", paddingBottom:100}}>
      <div style={{background:`linear-gradient(135deg,${C.navyDeep},${C.navy})`,padding:isDesktop?"26px 0":"50px 16px 22px"}}>
        <div style={{maxWidth:isDesktop?720:"none",margin:isDesktop?"0 auto":0,padding:isDesktop?"0 28px":0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:20,color:"white"}}>👤 حسابي</h2>
          <button onClick={()=>setEditing(true)} style={{background:"rgba(201,168,76,.18)",border:`1px solid rgba(201,168,76,.35)`,borderRadius:10,padding:"7px 13px",color:C.gold,fontFamily:"'Cairo'",fontWeight:700,fontSize:12,cursor:"pointer"}}>✏️ تعديل</button>
        </div>
        <div style={{background:"rgba(255,255,255,.07)",borderRadius:16,padding:15,border:`1px solid rgba(201,168,76,.18)`}}>
          <div style={{display:"flex",gap:13,alignItems:"center",marginBottom:12}}>
            <Av text={profile.name} size={62} type={getMemberPlan(profile)} src={profile.avatarUrl}/>
            <div>
              <div style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:"white",marginBottom:2}}>{profile.name}</div>
              <div style={{fontSize:12.5,color:"rgba(255,255,255,.55)",marginBottom:5}}>🔧 {profile.specialty}</div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span className={`badge badge-${getMemberPlan(profile)}`}>{planInfo.label}</span>
                <div className={`toggle ${profile.available!==false?"on":""}`} style={{transform:"scale(.75)"}} onClick={async()=>{
                  const newVal = profile.available===false?true:false;
                  await DB.toggleAvailability(profile.id, newVal);
                  setProfile(p=>({...p,available:newVal}));
                }}/>
                <span style={{fontSize:10.5,color:profile.available!==false?C.success:C.error}}>{profile.available!==false?"متاح":"غير متاح"}</span>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
            {[["👁",profile.views||0,"مشاهدة"],["📞",profile.calls||0,"اتصال"],["💬",profile.waMessages||0,"واتساب"],["⭐",profile.rating||0,"تقييم"]].map(([icon,val,label])=>(
              <div key={label} style={{textAlign:"center",background:"rgba(255,255,255,.06)",borderRadius:9,padding:"9px 4px"}}>
                <div style={{fontSize:15}}>{icon}</div>
                <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:14,color:C.gold}}>{val}</div>
                <div style={{fontSize:9.5,color:"rgba(255,255,255,.38)"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      <div style={{padding:isDesktop?"22px 0":"15px",maxWidth:isDesktop?720:"none",margin:isDesktop?"0 auto":0}}>
        <div style={{padding:isDesktop?"0 28px":0}}>
        <div style={{background:card,borderRadius:15,padding:15,marginBottom:11,border:`2px solid ${planInfo.color}33`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div>
              <div style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:15,color:tc}}>اشتراكك الحالي</div>
              <span className={`badge badge-${getMemberPlan(profile)}`} style={{marginTop:4,display:"inline-block"}}>{planInfo.label}</span>
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:18,color:planInfo.color}}>{getPlanPrice(profile.plan||profile.type,cfg)} ج</div>
              <div style={{fontSize:10.5,color:sub}}>سنويًا</div>
            </div>
          </div>
          {profile.type!=="starter" && profile.subscriptionEnd && (()=>{
            const endD = profile.subscriptionEnd?.toDate?.() || new Date(profile.subscriptionEnd);
            const daysLeft = Math.ceil((endD.getTime()-Date.now())/86400000);
            const expired = daysLeft <= 0;
            return (
              <div style={{fontSize:11.5,fontWeight:700,color: expired?C.error:daysLeft<=5?C.warning:sub,marginBottom:9}}>
                {expired ? "⚠️ اشتراكك منتهي، تواصل مع الإدارة للتجديد" : `⏳ متبقي ${daysLeft} يوم على انتهاء الاشتراك`}
              </div>
            );
          })()}
          <button className="btn btn-primary btn-sm" style={{width:"100%"}} onClick={onShowPayment}>⬆️ ترقية الاشتراك</button>
        </div>

        <div style={{background:card,borderRadius:15,padding:15,marginBottom:11,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
          <div style={{fontFamily:"'Cairo'",fontWeight:700,fontSize:14,color:tc,marginBottom:11}}>معلوماتي</div>
          {[["📱","الهاتف",profile.phone],["📍","المنطقة",`${profile.gov||""} ${profile.city?`- ${profile.city}`:""}`],["🔧","التخصص",profile.specialty],["⏳","سنوات الخبرة",profile.experience?`${profile.experience} سنة`:""],["📅","عضو منذ",profile.createdAt?.toDate?.()?.getFullYear?.()?.toString()||"2026"]].filter(([,,v])=>v).map(([icon,label,val])=>(
            <div key={label} style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:9,background:"rgba(201,168,76,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{icon}</div>
              <div><div style={{fontSize:10.5,color:sub}}>{label}</div><div style={{fontSize:13,fontWeight:600,color:tc}}>{val}</div></div>
            </div>
          ))}
        </div>

        <div style={{background:card,borderRadius:15,padding:15,marginBottom:11,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`}}>
          <div style={{fontFamily:"'Cairo'",fontWeight:700,fontSize:14,color:tc,marginBottom:11}}>📸 أعمالي</div>
          <WorksTab member={profile} currentUser={currentUser} darkMode={darkMode}/>
        </div>

        <button className="btn btn-outline btn-lg" style={{width:"100%",marginBottom:9}} onClick={()=>onMemberClick(profile)}>
          👁 عرض ملفي العام
        </button>
        <button className="btn btn-ghost" style={{width:"100%",fontSize:12,color:sub,marginBottom:9}} onClick={()=>setEditing(true)}>
          ✏️ تعديل البيانات
        </button>
        <button className="btn btn-ghost" style={{width:"100%",fontSize:12,color:sub,marginBottom:9}} onClick={()=>{setShowPasswordModal(true);setPwForm({current:"",next:"",confirm:""});setPwError("");}}>
          🔑 تغيير كلمة السر
        </button>
        <button className="btn btn-ghost" style={{width:"100%",fontSize:12,color:sub,marginBottom:9}} onClick={()=>setShowLegal(true)}>
          📄 الشروط والأحكام وسياسة الخصوصية
        </button>
        </div>
      </div>

      <LegalModal isOpen={showLegal} onClose={()=>setShowLegal(false)} darkMode={darkMode}/>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={()=>!changingPw && setShowPasswordModal(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{padding:"15px 18px 28px"}}>
              <h3 style={{fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:C.navy,marginBottom:14}}>🔑 تغيير كلمة السر</h3>
              <div className="form-group">
                <label className="form-label req">كلمة السر الحالية</label>
                <input className="input" type="password" value={pwForm.current} onChange={e=>setPwForm(p=>({...p,current:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label req">كلمة السر الجديدة (6 أرقام على الأقل)</label>
                <input className="input" type="password" value={pwForm.next} onChange={e=>setPwForm(p=>({...p,next:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label req">تأكيد كلمة السر الجديدة</label>
                <input className="input" type="password" value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))}/>
              </div>
              {pwError && <div style={{color:C.error,fontSize:12.5,fontWeight:700,marginBottom:10}}>{pwError}</div>}
              <button className="btn btn-primary btn-lg" style={{width:"100%",marginBottom:7}} disabled={changingPw} onClick={async ()=>{
                setPwError("");
                if (pwForm.next.length < 6) return setPwError("كلمة السر الجديدة لازم تكون 6 أرقام على الأقل");
                if (pwForm.next !== pwForm.confirm) return setPwError("كلمة السر الجديدة والتأكيد مش متطابقين");
                setChangingPw(true);
                try {
                  await DB.changeOwnPassword(pwForm.current, pwForm.next);
                  setChangingPw(false);
                  setShowPasswordModal(false);
                  alert("✅ تم تغيير كلمة السر بنجاح");
                } catch(e) {
                  setChangingPw(false);
                  if (e.code==="auth/wrong-password"||e.code==="auth/invalid-credential") setPwError("كلمة السر الحالية غلط");
                  else if (e.code==="auth/network-request-failed") setPwError("تعذر الاتصال بالإنترنت، حاول تاني");
                  else setPwError(`حصل خطأ (${e.code||"بدون كود"}): ${e.message||e}`);
                }
              }}>{changingPw?<Spinner size={15} color={C.navyDeep}/>:"حفظ كلمة السر الجديدة"}</button>
              <button className="btn btn-ghost" style={{width:"100%"}} disabled={changingPw} onClick={()=>setShowPasswordModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ADMIN_EMAIL = "admin@daleel.com"; // internal only
const ADMIN_PHONE = "01110001986"; // ← رقم موبايل الأدمن
const ADMIN_PIN = "1234"; // ← الرقم السري الافتراضي (يتغير من إعدادات التطبيق)

// ============================================================
// ADMIN — طلبات "اطلب صنايعي" (نص حر بيبعته الزوار)
// مكوّن مستقل بحاله (بحالته وuseEffect بتاعته) عشان مانضيفش لـ AdminScreen
// نفسه اللي أصلاً معاه عدد كبير جدًا من الـ hooks
// ============================================================
const AdminServiceRequestsSection = ({ darkMode }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;

  useEffect(() => {
    DB.getServiceRequests().then(r => { setRequests(r); setLoading(false); });
  }, []);

  const tAgo = (t) => {
    if (!t) return "";
    const ms = t?.toDate?.()?.getTime?.() || new Date(t).getTime();
    const d = (Date.now() - ms) / 1000;
    if (d < 60) return "الآن";
    if (d < 3600) return `منذ ${Math.floor(d/60)} د`;
    if (d < 86400) return `منذ ${Math.floor(d/3600)} س`;
    return `منذ ${Math.floor(d/86400)} يوم`;
  };

  if (loading) return <div style={{ textAlign:"center", padding:40 }}><Spinner size={26} color={C.gold}/></div>;

  if (requests.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"50px 20px" }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🛠️</div>
        <div style={{ fontFamily:"'Cairo'", fontWeight:700, color:tc }}>مفيش طلبات لسه</div>
        <div style={{ color:sub, fontSize:13, marginTop:4 }}>هتظهر هنا أول ما حد يستخدم زرار "اطلب صنايعي"</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {requests.map(r => (
        <div key={r.id} style={{ background:card, borderRadius:14, padding:14, border:`1px solid ${darkMode?"rgba(255,255,255,.08)":C.grayLight}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:8 }}>
            <div style={{ fontFamily:"'Cairo'", fontWeight:700, fontSize:14.5, color:tc, flex:1 }}>{r.text}</div>
            <div style={{ fontSize:11, color:sub, flexShrink:0, marginRight:10 }}>{tAgo(r.createdAt)}</div>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, fontSize:12, color:sub }}>
            {r.gov && <span>📍 {r.gov}{r.city ? " - "+r.city : ""}</span>}
            {r.userName && <span>👤 {r.userName}</span>}
          </div>
          {r.phone && (
            <a href={`https://wa.me/2${r.phone.replace(/^0/,"")}`} target="_blank" rel="noreferrer"
              style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:10, background:"linear-gradient(135deg,#25D366,#128C7E)", color:"white", padding:"7px 13px", borderRadius:10, fontFamily:"'Cairo'", fontWeight:700, fontSize:12.5, textDecoration:"none" }}>
              💬 {r.phone}
            </a>
          )}
        </div>
      ))}
    </div>
  );
};

const AdminScreen = ({ darkMode, currentUser }) => {
  const cfg = useConfig();
  const [section, setSection] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [adminPhone, setAdminPhone] = useState("");
  // Members management
  const [members, setMembers] = useState([]);
  const [memberStatusFilter, setMemberStatusFilter] = useState("");
  const [memberTypeFilter, setMemberTypeFilter] = useState("");
  const [memberGovFilter, setMemberGovFilter] = useState("");
  const [memberVisibleCount, setMemberVisibleCount] = useState(30);
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingVisibleCount, setPendingVisibleCount] = useState(30);
  // Ads management
  const [payments, setPayments] = useState([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ name:"", plan:"basic", amount:"", method:"فودافون كاش", status:"success" });
  const [savingPayment, setSavingPayment] = useState(false);
  const [ads, setAds] = useState([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [showAddAd, setShowAddAd] = useState(false);
  const [newAd, setNewAd] = useState({ title:"", advertiser:"", phone:"", desc:"", plan:"banner", endDate:"", price:"", emoji:"🏢", color1:C.navy, color2:C.navyLight, badge:"إعلان مميز" });
  const [adImageFile, setAdImageFile] = useState(null);
  const [adImagePreview, setAdImagePreview] = useState(null);
  const [uploadingAdImage, setUploadingAdImage] = useState(false);
  // App Settings
  const [appSettings, setAppSettings] = useState({
    whatsapp: "201110001986",
    facebook: "",
    instagram: "",
    website: "",
    planPrices: { starter:60, basic:120, premium:250, vip:600, company:1000, elite:1500 },
    postLimits: { starter:0, basic:5, premium:10, vip:20, company:40, elite:80 },
    videoLimits: { starter:0, basic:0, premium:0, vip:1, company:5, elite:10 },
    appName: "الدليل الشامل",
    welcomeMsg: "",
    maintenanceMode: false,
    autoApprove: false,
    adminPhone: "01110001986",
    adminPin: "",
    splashLogoUrl: "",
    appSlogan: "منصة البناء في مصر",
    maxPhotosStarter: 5,
    maxPhotosBasic: 15,
    maxPhotosVip: 999,
    contactEmail: "",
    termsText: "",
  });
  const [settingsSection, setSettingsSection] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  // Notifications
  const [notifText, setNotifText] = useState("");
  const [notifTarget, setNotifTarget] = useState("all");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [sentNotifs, setSentNotifs] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  // Modals
  const [confirmModal, setConfirmModal] = useState(null);
  const [customDays, setCustomDays] = useState(365); // عدد أيام الاشتراك اللي الأدمن بيحدده وقت القبول أو التجديد

  const bg = darkMode ? C.navyDeep : C.offWhite;
  const card = darkMode ? C.cardBg : "white";
  const tc = darkMode ? "white" : C.navy;
  const sub = darkMode ? "rgba(255,255,255,.45)" : C.gray;
  const tAgo = t => { if(!t) return ""; const ms = typeof t==="number"?t:(t?.toDate?.()?.getTime?.()||new Date(t).getTime()); const d=(Date.now()-ms)/1000; if(d<60)return"الآن";if(d<3600)return`منذ ${Math.floor(d/60)} د`;if(d<86400)return`منذ ${Math.floor(d/3600)} س`;return`منذ ${Math.floor(d/86400)} يوم`; };

  // مشتقة مباشرة من members بدل ما تكون state منفصلة — كده لما الأدمن يوافق/يرفض عضو
  // بيتشال فورًا من قائمة "المعلّقين" من غير ما نحتاج نحدّث حالتين مختلفتين ويحصل تضارب بينهم
  const pendingList = useMemo(() => members.filter(m => !m.status || m.status === "pending").sort((a,b) => {
    // الأحدث (آخر واحد قدّم الطلب) يظهر فوق
    const ta = a.createdAt?.toDate?.()?.getTime?.() || new Date(a.createdAt||0).getTime();
    const tb = b.createdAt?.toDate?.()?.getTime?.() || new Date(b.createdAt||0).getTime();
    return tb - ta;
  }), [members]);
  const filteredPending = useMemo(() => {
    if (!pendingSearch) return pendingList;
    return pendingList.filter(m => (m.name||"").includes(pendingSearch) || (m.specialty||"").includes(pendingSearch) || (m.phone||"").includes(pendingSearch));
  }, [pendingList, pendingSearch]);
  const filteredMembers = useMemo(() => {
    return members.filter(m =>
      (!memberSearch || (m.name||"").includes(memberSearch) || (m.specialty||"").includes(memberSearch) || (m.phone||"").includes(memberSearch)) &&
      (!memberStatusFilter || m.status === memberStatusFilter || (memberStatusFilter==="pending" && !m.status)) &&
      (!memberTypeFilter || m.type === memberTypeFilter) &&
      (!memberGovFilter || m.gov === memberGovFilter)
    );
  }, [members, memberSearch, memberStatusFilter, memberTypeFilter, memberGovFilter]);

  useEffect(() => {
    // قراءة واحدة بس لكل من "members" و"payments" (بدل ما كانت members بتتقرا مرتين:
    // مرة هنا ومرة جوه DB.getAdminStats) — أهم حاجة بتوفر وقت تحميل لوحة الأدمن
    // كل ما عدد الأعضاء يكبر (١٢٦ → ١٠٠٠+)
    Promise.all([
      getDocs(collection(db,"members")).catch(() => null),
      getDocs(query(collection(db,"payments"),orderBy("date","desc"),limit(200))).catch(() => null),
    ]).then(([membersSnap, paymentsSnap]) => {
      const all = membersSnap ? membersSnap.docs.map(d => ({ id:d.id, ...d.data() })) : [];
      const pays = paymentsSnap && !paymentsSnap.empty ? paymentsSnap.docs.map(d => ({ id:d.id, ...d.data() })) : [];
      setMembers(all);
      setPayments(pays);
      setStats(DB.getAdminStats(all, pays));
    });
    getDocs(query(collection(db,"notifications"),orderBy("time","desc"),limit(20))).then(snap=>{
      setSentNotifs(snap.docs.map(d=>({id:d.id,...d.data()})));
    }).catch(()=>{});
    // Load ads from Firestore
    getDocs(query(collection(db,"ads"),orderBy("startDate","desc"))).then(snap=>{
      setAds(snap.docs.map(d=>({id:d.id,...d.data()})));
      setAdsLoading(false);
    }).catch(()=>setAdsLoading(false));
  }, []);

  // Sync appSettings form with cfg (from ConfigContext/Firestore)
  useEffect(() => {
    setAppSettings(p => ({ ...p, ...cfg }));
  }, [cfg]);

  // Auto-login if currentUser is admin
  const isCurrentAdmin = currentUser && (
    currentUser.isAdmin ||
    currentUser.phone === (cfg.adminPhone||"").replace(/^(\+2|2)/,"") ||
    currentUser.phone === cfg.adminPhone ||
    currentUser.phone === "2"+(cfg.adminPhone||"") ||
    currentUser.email === (cfg.adminEmail||"admin@daleel.com")
  );

  if (!pinVerified && !isCurrentAdmin) return (
    <div style={{ background:bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:"0 30px", paddingBottom:80 }}>
      <div style={{ fontSize:56 }}>👑</div>
      <div style={{ fontFamily:"'Cairo'", fontWeight:800, fontSize:20, color:tc }}>لوحة الإدارة</div>
      <div style={{ color:sub, fontSize:13, marginBottom:4 }}>سجّل دخولك كمسؤول</div>
      <div style={{width:"100%",maxWidth:280,display:"flex",flexDirection:"column",gap:10}}>
        <input
          className={`input${darkMode?" input-dark":""}`}
          type="tel"
          placeholder="رقم الموبايل"
          value={adminPhone}
          onChange={e=>{ setAdminPhone(e.target.value); setPinError(false); }}
        />
        <input
          className={`input${darkMode?" input-dark":""}`}
          type="password"
          maxLength={30}
          placeholder="الرقم السري"
          value={pinInput}
          onChange={e=>{ setPinInput(e.target.value); setPinError(false); }}
          style={{ textAlign:"center", fontSize:20, letterSpacing:2 }}
        />
      </div>
      {pinError && <div style={{ color:C.error, fontSize:13, fontWeight:700 }}>❌ رقم الموبايل أو الرقم السري غلط</div>}
      <button className="btn btn-primary btn-lg" style={{ width:220 }} onClick={()=>{
        const cleanPhone = adminPhone.replace(/^(\+2|2)/,"");
        const configPhone = (cfg.adminPhone||"").replace(/^(\+2|2)/,"");
        if (cleanPhone === configPhone && pinInput === cfg.adminPin) {
          setPinVerified(true); setPinError(false);
        } else { setPinError(true); setPinInput(""); }
      }}>دخول 👑</button>
    </div>
  );

  // مدة الاشتراك السنوي بالأيام — تُستخدم لحساب تاريخ انتهاء الاشتراك تلقائيًا
  const SUBSCRIPTION_DAYS = 365; // القيمة الافتراضية لو الأدمن ماحددش رقم مختلف
  const approveMember = async (id, days) => {
    const durationDays = Number(days) > 0 ? Number(days) : SUBSCRIPTION_DAYS;
    const subStart = new Date();
    const subEnd = new Date(subStart.getTime() + durationDays*24*60*60*1000);
    try {
      await updateDoc(doc(db,"members",id), { status:"approved", approvedAt: new Date(), subscriptionStart: subStart, subscriptionEnd: subEnd, subscriptionDurationDays: durationDays });
      // Send notification to member — لازم recipientId مش target عشان تظهر فعلاً في إشعارات العضو (target مخصص للإشعارات العامة بس)
      await addDoc(collection(db,"notifications"), {
        recipientId: id,
        body: "🎉 تم قبول حسابك وتفعيله في الدليل الشامل! يمكنك الآن الظهور للعملاء.",
        title: "مرحباً بك في الدليل الشامل",
        icon: "✅", color: "#22C55E",
        time: new Date(), read: false,
      }).catch(()=>{});
      // تسجيل دفعة حقيقية تلقائيًا — لأن الأدمن أصلاً بيوافق على العضو بعد ما يتأكد
      // إن الدفع اتحصّل (فودافون كاش/InstaPay/فوري) عن طريق واتساب. من غير الخطوة دي،
      // شاشة "المدفوعات" وإيرادات لوحة التحكم كانت هتفضل صفر دايمًا رغم إن فيه فلوس بتتحصّل فعليًا.
      const approvedMember = members.find(m => m.id === id);
      const type = getMemberPlan(approvedMember);
      const amount = appSettings?.planPrices?.[type] ?? PLANS[type]?.price ?? 0;
      const paymentDoc = {
        memberId: id,
        name: approvedMember?.name || "",
        plan: type,
        amount,
        method: "تأكيد يدوي (واتساب)",
        status: "success",
        date: new Date(),
      };
      const payRef = await addDoc(collection(db,"payments"), paymentDoc).catch(() => null);
      if (payRef) {
        setPayments(p => {
          const next = [{ id: payRef.id, ...paymentDoc }, ...p];
          setStats(s => DB.getAdminStats(members.map(m => m.id===id?{...m,status:"approved"}:m), next));
          return next;
        });
      }
    } catch(e) { console.error(e); }
    setMembers(p => p.map(m => m.id===id ? {...m, status:"approved", subscriptionStart: subStart, subscriptionEnd: subEnd, subscriptionDurationDays: durationDays} : m));
    setConfirmModal(null);
  };
  const rejectMember = async (id) => {
    try {
      await updateDoc(doc(db,"members",id), { status:"rejected", rejectedAt: new Date() });
      // إشعار للعضو المرفوض عشان يعرف ويقدر يتواصل مع الإدارة يستفسر
      await addDoc(collection(db,"notifications"), {
        recipientId: id,
        body: "نأسف، لم يتم قبول طلبك في الدليل الشامل حاليًا. تواصل مع الإدارة لمعرفة التفاصيل.",
        title: "بخصوص طلب التسجيل",
        icon: "❌", color: "#EF4444",
        time: new Date(), read: false,
      }).catch(()=>{});
    } catch(e) { console.error(e); }
    setMembers(p => p.map(m => m.id===id ? {...m, status:"rejected"} : m));
    setConfirmModal(null);
  };
  // تجديد اشتراك عضو مفعّل بالفعل: بيمدد تاريخ الانتهاء 30 يوم من تاريخ اليوم (أو من تاريخ الانتهاء الحالي لو لسه ماخلصش)، ويسجل الدفعة تلقائي في المدفوعات
  const renewMemberSubscription = async (id, days) => {
    const target = members.find(m => m.id === id);
    if (!target) return;
    const durationDays = Number(days) > 0 ? Number(days) : SUBSCRIPTION_DAYS;
    const currentEnd = target.subscriptionEnd?.toDate?.() || (target.subscriptionEnd ? new Date(target.subscriptionEnd) : null);
    const base = (currentEnd && currentEnd.getTime() > Date.now()) ? currentEnd : new Date();
    const newEnd = new Date(base.getTime() + durationDays*24*60*60*1000);
    try {
      await updateDoc(doc(db,"members",id), { subscriptionEnd: newEnd, subscriptionRenewedAt: new Date(), subscriptionDurationDays: durationDays });
      const type = target.type || target.plan || "starter";
      const amount = appSettings?.planPrices?.[type] ?? PLANS[type]?.price ?? 0;
      const paymentDoc = { memberId:id, name: target.name||"", plan:type, amount, method:"تجديد يدوي (واتساب)", status:"success", date:new Date() };
      const payRef = await addDoc(collection(db,"payments"), paymentDoc).catch(()=>null);
      if (payRef) {
        setPayments(p => {
          const next = [{ id: payRef.id, ...paymentDoc }, ...p];
          setStats(s => DB.getAdminStats(members, next));
          return next;
        });
      }
      setMembers(p => p.map(x => x.id===id ? {...x, subscriptionEnd:newEnd, subscriptionDurationDays:durationDays} : x));
      alert(`✅ تم تجديد الاشتراك ${durationDays} يوم إضافي`);
    } catch(e) { alert("❌ خطأ في تجديد الاشتراك: " + e.message); }
    setConfirmModal(null);
  };
  // تسجيل دفعة يدويًا (لتجديد اشتراك، أو أي دفعة متعلقتش بموافقة عضو جديد)
  const addPaymentManual = async () => {
    if (!newPayment.name.trim() || !newPayment.amount) { alert("⚠️ اكتب الاسم والمبلغ"); return; }
    setSavingPayment(true);
    try {
      const paymentDoc = {
        name: newPayment.name.trim(),
        plan: newPayment.plan,
        amount: Number(newPayment.amount) || 0,
        method: newPayment.method,
        status: newPayment.status,
        date: new Date(),
      };
      const payRef = await addDoc(collection(db,"payments"), paymentDoc);
      setPayments(p => {
        const next = [{ id: payRef.id, ...paymentDoc }, ...p];
        setStats(s => DB.getAdminStats(members, next));
        return next;
      });
      setNewPayment({ name:"", plan:"basic", amount:"", method:"فودافون كاش", status:"success" });
      setShowAddPayment(false);
    } catch(e) { alert("❌ خطأ في تسجيل الدفعة: " + e.message); }
    setSavingPayment(false);
  };
  const approveAd = async (id) => {
    try {
      await updateDoc(doc(db,"ads",id), { status:"active" });
      setAds(p => p.map(a => a.id===id ? {...a, status:"active"} : a));
    } catch(e) { alert("❌ خطأ: " + e.message); }
  };
  const pauseAd = async (id) => {
    try {
      await updateDoc(doc(db,"ads",id), { status:"paused" });
      setAds(p => p.map(a => a.id===id ? {...a, status:"paused"} : a));
    } catch(e) { alert("❌ خطأ: " + e.message); }
  };
  const deleteAd = async (id) => {
    if (!window.confirm("حذف هذا الإعلان نهائياً؟")) return;
    try {
      await deleteDoc(doc(db,"ads",id));
      setAds(p => p.filter(a => a.id!==id));
    } catch(e) { alert("❌ خطأ: " + e.message); }
  };
  const handleAdImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (adImagePreview) URL.revokeObjectURL(adImagePreview);
    setAdImageFile(file);
    setAdImagePreview(URL.createObjectURL(file));
  };
  const addAd = async () => {
    if (!newAd.title || !newAd.phone) return;
    let imageUrl = "";
    try {
      if (adImageFile) {
        setUploadingAdImage(true);
        // رفع الصورة كما هي بدون تحجيم — سيتم عرضها بالحجم المناسب باستخدام CSS objectFit
        imageUrl = await uploadBlobToStorage(adImageFile, `ads/${Date.now()}_${newAd.plan}.jpg`);
        setUploadingAdImage(false);
      }
    } catch(e) { setUploadingAdImage(false); alert("❌ خطأ في رفع صورة الإعلان: " + e.message); return; }
    const adData = { ...newAd, imageUrl, status:"pending", views:0, clicks:0, startDate: new Date().toISOString().split("T")[0], createdAt: new Date() };
    try {
      const ref = await addDoc(collection(db,"ads"), adData);
      setAds(p => [...p, { ...adData, id: ref.id }]);
      setNewAd({ title:"", advertiser:"", phone:"", desc:"", plan:"banner", endDate:"", price:"", emoji:"🏢", color1:C.navy, color2:C.navyLight, badge:"إعلان مميز" });
      if (adImagePreview) URL.revokeObjectURL(adImagePreview);
      setAdImageFile(null); setAdImagePreview(null);
      setShowAddAd(false);
    } catch(e) { alert("❌ خطأ في الإضافة: " + e.message); }
  };
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db,"config","appSettings"), appSettings, { merge: true });
      // ConfigContext onSnapshot هيتحدث تلقائياً — مش محتاجين Object.assign
      alert("✅ تم حفظ الإعدادات بنجاح!");
      setSettingsSection(null);
    } catch(e) { alert("❌ خطأ: " + e.message); }
    setSavingSettings(false);
  };
  const cancelSubscription = async (memberId) => {
    if (!window.confirm("هل تريد إلغاء اشتراك هذا العضو؟")) return;
    try {
      await updateDoc(doc(db,"members",memberId), { type:"starter", plan:"starter", subscriptionCancelledAt: new Date() });
      setMembers(p => p.map(m => m.id===memberId ? {...m, type:"starter", plan:"starter"} : m));
      alert("✅ تم إلغاء الاشتراك");
    } catch(e) { alert("❌ خطأ: " + e.message); }
  };

  // تغيير باقة عضو مفعّل بالفعل (ترقية/تخفيض) — لازم يحصل بالظبط زي التفعيل الأول:
  // سعر الباقة الجديدة يتسجل كدفعة، وتاريخ الاشتراك يتجدد سنة من النهاردة
  const changeMemberType = async (memberId, newType) => {
    try {
      const target = members.find(m => m.id === memberId);
      const subStart = new Date();
      const subEnd = new Date(subStart.getTime() + SUBSCRIPTION_DAYS*24*60*60*1000);
      const updateData = { type: newType, plan: newType, updatedAt: new Date() };
      // الباقة المجانية (starter) مالهاش سعر ولا تاريخ انتهاء اشتراك
      if (newType !== "starter") {
        updateData.subscriptionStart = subStart;
        updateData.subscriptionEnd = subEnd;
      }
      await updateDoc(doc(db,"members",memberId), updateData);
      if (newType !== "starter" && target?.status === "approved") {
        const amount = appSettings?.planPrices?.[newType] ?? PLANS[newType]?.price ?? 0;
        const paymentDoc = { memberId, name: target?.name||"", plan:newType, amount, method:"تغيير باقة (واتساب)", status:"success", date:new Date() };
        const payRef = await addDoc(collection(db,"payments"), paymentDoc).catch(()=>null);
        if (payRef) {
          setPayments(p => {
            const next = [{ id: payRef.id, ...paymentDoc }, ...p];
            setStats(s => DB.getAdminStats(members, next));
            return next;
          });
        }
      }
      setMembers(p => p.map(m => m.id===memberId ? {...m, ...updateData} : m));
    } catch(e) { alert("❌ خطأ: " + e.message); }
  };

  const toggleVerified = async (memberId, verified) => {
    try {
      await updateDoc(doc(db,"members",memberId), { verified });
      setMembers(p => p.map(m => m.id===memberId ? {...m, verified} : m));
    } catch(e) { alert("❌ خطأ: " + e.message); }
  };

  // إعادة تعيين كلمة سر عضو نسي كلمة سره — بيولّد كلمة سر مؤقتة عشوائية وتبعتها له
  // بنفسك عن طريق واتساب بعد ما تتأكد من هويته. محتاجة الـ Cloud Function
  // (reset-password-function.js) تكون متنشرة على Firebase الأول عشان تشتغل.
  const resetMemberPassword = async (memberId, memberName) => {
    if (!window.confirm(`هل تريد إعادة تعيين كلمة سر "${memberName}"؟ هيتولّد رقم سري مؤقت جديد.`)) return;
    const tempPassword = String(Math.floor(100000 + Math.random()*900000)); // 6 أرقام عشوائية
    try {
      const fn = httpsCallable(functions, "resetMemberPassword");
      await fn({ memberId, newPassword: tempPassword });
      window.prompt(`✅ تم تغيير كلمة السر. الرقم السري المؤقت الجديد (انسخه وابعته للعضو عن طريق واتساب):`, tempPassword);
    } catch(e) {
      alert("❌ فشل إعادة التعيين: " + (e.message||e) + "\n\nتأكد إن الـ Cloud Function متنشرة على Firebase.");
    }
  };

  const deleteMember = async (memberId) => {
    try {
      await deleteDoc(doc(db,"members",memberId));
      setMembers(p => p.filter(m => m.id!==memberId));
      alert("✅ تم حذف العضو");
    } catch(e) { alert("❌ خطأ: " + e.message); }
  };
  const sendNotification = async () => {
    if (!notifText.trim()) return;
    setSendingNotif(true);
    try {
      await addDoc(collection(db,"notifications"), {
        recipientId: null, // صراحةً null عشان تفضل قابلة للاستعلام في getNotifications (مش مجرد حقل غايب)
        text: notifText,
        body: notifText,
        target: notifTarget,
        time: new Date(),
        read: false,
        icon: "📢",
        title: "إشعار من الإدارة",
      });
      alert(`✅ تم إرسال الإشعار لـ ${notifTarget === "all" ? "جميع المستخدمين" : "أعضاء " + notifTarget}`);
      setNotifText("");
    } catch(e) { alert("❌ خطأ في الإرسال: " + e.message); }
    setSendingNotif(false);
  };

  const navItems = [
    ["dashboard","📊","لوحة التحكم"],
    ["pending","⏳","طلبات القبول"],
    ["members","👥","الأعضاء"],
    ["serviceRequests","🛠️","طلبات الصنايعية"],
    ["ads","📢","الإعلانات"],
    ["notifications","🔔","الإشعارات"],
    ["payments","💰","المدفوعات"],
    ["settings","⚙️","الإعدادات"],
  ];

  const statCards = stats ? [
    { icon:"👥", label:"إجمالي الأعضاء", value:stats.totalMembers.toLocaleString(), change:"+12%", color:C.info },
    { icon:"⏳", label:"طلبات معلقة", value:pendingList.length, change:"جديد", color:C.warning },
    { icon:"💰", label:"إيرادات الشهر", value:`${(stats.monthRevenue/1000).toFixed(1)}ك`, change:"+18%", color:"#10B981" },
    { icon:"📢", label:"إعلانات نشطة", value:ads.filter(a=>a.status==="active").length, change:"+2", color:C.gold },
    { icon:"👁", label:"زيارات اليوم", value:stats.todayVisits.toLocaleString(), change:"+5%", color:C.purple },
    { icon:"⚠️", label:"شكاوى معلقة", value:stats.pendingComplaints, change:"-3", color:C.error },
  ] : [];

  return (
    <div style={{ background:bg, minHeight:"100vh", paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#060E1C,#0A1628)", padding:"50px 16px 18px" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${C.gold},${C.goldDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>👑</div>
          <div>
            <h2 style={{ fontFamily:"'Cairo'",fontWeight:900,fontSize:20,color:"white" }}>لوحة إدارة الدليل الشامل</h2>
            <p style={{ color:"rgba(201,168,76,.68)",fontSize:11.5 }}>مرحباً {currentUser?.displayName} · صلاحيات كاملة</p>
          </div>
          {pendingList.length > 0 && (
            <div style={{ marginRight:"auto", background:C.error, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, color:"white" }}>
              {pendingList.length} طلب جديد
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="scroll-x" style={{ padding:"11px 13px 0" }}>
        {navItems.map(([id,icon,label]) => (
          <div key={id} className={`chip ${section===id?"active":""}`} onClick={()=>setSection(id)} style={{ flexShrink:0, fontSize:11.5, position:"relative" }}>
            {icon} {label}
            {id==="pending" && pendingList.length > 0 && (
              <span style={{ marginRight:4, background:C.error, borderRadius:10, padding:"1px 5px", fontSize:9, fontWeight:800, color:"white" }}>
                {pendingList.length}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding:"13px" }}>

        {/* ══════════════ DASHBOARD ══════════════ */}
        {section==="dashboard" && (
          <>
            <div className="grid-2" style={{ marginBottom:14 }}>
              {statCards.map((s,i) => (
                <div key={s.label} style={{ background:card,borderRadius:13,padding:13,border:`1px solid ${darkMode?s.color+"22":C.grayLight}`,animation:`fadeInUp ${.1+i*.05}s ease both` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:9.5,color:sub,marginBottom:2 }}>{s.label}</div>
                      <div style={{ fontFamily:"'Cairo'",fontWeight:900,fontSize:24,color:tc }}>{s.value}</div>
                    </div>
                    <div style={{ width:40,height:40,borderRadius:10,background:`${s.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{s.icon}</div>
                  </div>
                  <div style={{ color:s.change.startsWith("+")? C.success : s.change.startsWith("-")? C.error : C.warning, fontSize:10.5,fontWeight:700,marginTop:7 }}>
                    {s.change.startsWith("+")?"↑":s.change.startsWith("-")?"↓":"🆕"} {s.change} هذا الشهر
                  </div>
                </div>
              ))}
            </div>
            {/* Revenue Chart */}
            {stats && (
              <div style={{ background:card,borderRadius:15,padding:15,marginBottom:14,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
                <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:700,marginBottom:13 }}>📈 إيرادات الأشهر الستة الأخيرة</h4>
                <div style={{ display:"flex",gap:5,alignItems:"flex-end",height:100 }}>
                  {stats.chartData.map(d => {
                    const mx = Math.max(...stats.chartData.map(x=>x.revenue));
                    return (
                      <div key={d.month} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                        <div style={{ fontSize:9,color:C.gold,fontWeight:700 }}>{(d.revenue/1000).toFixed(0)}ك</div>
                        <div style={{ width:"100%",height:(d.revenue/mx)*90,background:`linear-gradient(180deg,${C.gold},${C.goldDark})`,borderRadius:"3px 3px 0 0",minHeight:3 }}/>
                        <div style={{ fontSize:8.5,color:sub }}>{d.month.slice(0,3)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Quick shortcuts */}
            <div style={{ background:card,borderRadius:15,padding:14,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
              <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:700,marginBottom:12 }}>⚡ وصول سريع</h4>
              <div className="grid-2" style={{ gap:8 }}>
                {[["⏳","طلبات القبول","pending",C.warning],["📢","إدارة الإعلانات","ads",C.gold],["🔔","إرسال إشعار","notifications",C.info],["👥","إدارة الأعضاء","members",C.purple]].map(([icon,label,sec,color])=>(
                  <button key={sec} onClick={()=>setSection(sec)} style={{ background:`${color}12`,border:`1px solid ${color}2a`,borderRadius:11,padding:"12px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:5,fontFamily:"'Tajawal'",transition:"all .2s" }}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${color}22`;e.currentTarget.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`${color}12`;e.currentTarget.style.transform="translateY(0)";}}>
                    <span style={{ fontSize:22 }}>{icon}</span>
                    <span style={{ fontSize:11,fontWeight:700,color:tc }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════ PENDING MEMBERS ══════════════ */}
        {section==="pending" && (
          <>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13 }}>
              <div><div style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc }}>⏳ طلبات القبول</div>
                <div style={{ color:sub,fontSize:12,marginTop:2 }}>{filteredPending.length} طلب ينتظر المراجعة</div>
              </div>
            </div>
            <div className="search-bar" style={{ marginBottom:12, background:card }}>
              <span>🔍</span>
              <input placeholder="ابحث باسم أو تخصص أو رقم موبايل..." value={pendingSearch} onChange={e=>{setPendingSearch(e.target.value);setPendingVisibleCount(30);}} style={{ flex:1,padding:"11px 5px",border:"none",background:"transparent",fontSize:13.5,color:tc,fontFamily:"'Tajawal'",direction:"rtl",outline:"none" }}/>
            </div>
            {filteredPending.slice(0,pendingVisibleCount).map((m,i)=>(
              <div key={m.id} style={{ background:card,borderRadius:15,padding:15,marginBottom:11,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}`,animation:`fadeInUp ${.1+i*.07}s ease both` }}>
                <div style={{ display:"flex",gap:10,marginBottom:11 }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minWidth:22,height:22,borderRadius:"50%",background:darkMode?"rgba(201,168,76,.15)":"#F0F0F0",color:C.gold,fontSize:11,fontWeight:800,flexShrink:0 }}>{i+1}</div>
                  <Av text={m.name} size={46} type={getMemberPlan(m)}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800,fontSize:14.5,color:tc,marginBottom:2 }}>{m.name}</div>
                    <div style={{ fontSize:12,color:sub,marginBottom:4 }}>🔧 {m.specialty} · 📍 {m.gov}{m.city?` - ${m.city}`:""}</div>
                    <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                      <span className={`badge badge-${getMemberPlan(m)}`}>{PLANS[getMemberPlan(m)]?.label}</span>
                      <span style={{ fontSize:10.5,color:sub }}>📞 {m.phone}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"left" }}>
                    <span style={{ background:`rgba(245,158,11,.15)`,color:C.warning,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700 }}>⏳ معلق</span>
                  </div>
                </div>
                <div style={{ background:darkMode?"rgba(255,255,255,.04)":"#F8FAFF",borderRadius:9,padding:"9px 12px",marginBottom:11,border:`1px solid ${darkMode?"rgba(255,255,255,.06)":C.grayLight}` }}>
                  <div style={{ fontSize:11.5,color:sub,display:"flex",gap:8,flexWrap:"wrap" }}>
                    <span>💳 {getPlanPrice(getMemberPlan(m),appSettings)} ج/سنة</span>
                    {m.createdAt && <span>🕐 {tAgo(m.createdAt)}</span>}
                  </div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <button className="btn btn-primary" style={{ flex:2,padding:"9px 0" }}
                    onClick={()=>{setCustomDays(365);setConfirmModal({type:"approve",id:m.id,name:m.name});}}>
                    ✅ قبول وتفعيل الحساب
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ flex:1 }}
                    onClick={()=>setConfirmModal({type:"reject",id:m.id,name:m.name})}>
                    ❌ رفض
                  </button>
                </div>
              </div>
            ))}
            {filteredPending.length > pendingVisibleCount && (
              <button className="btn btn-outline" style={{width:"100%",marginTop:6}} onClick={()=>setPendingVisibleCount(c=>c+30)}>
                عرض المزيد ({filteredPending.length - pendingVisibleCount} متبقي)
              </button>
            )}
            {filteredPending.length===0 && (
              <div style={{ textAlign:"center",padding:"50px 20px" }}>
                <div style={{ fontSize:50,marginBottom:10 }}>✅</div>
                <div style={{ color:tc,fontWeight:700,marginBottom:5 }}>{pendingSearch?"لا توجد نتائج مطابقة":"لا توجد طلبات معلقة"}</div>
                <div style={{ color:sub,fontSize:13 }}>{pendingSearch?"جرّب كلمة بحث مختلفة":"جميع الطلبات تمت مراجعتها"}</div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ MEMBERS ══════════════ */}
        {section==="members" && (
          <>
            <div style={{ marginBottom:13 }}>
              <div style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:2 }}>👥 إدارة الأعضاء</div>
              <div style={{ color:sub,fontSize:12 }}>{filteredMembers.length} من {members.length} عضو مسجل</div>
            </div>
            <div className="search-bar" style={{ marginBottom:9, background:card }}>
              <button style={{ background:"none",border:"none",padding:"0 10px",fontSize:16 }}>🔍</button>
              <input placeholder="ابحث باسم أو تخصص أو رقم موبايل..." value={memberSearch} onChange={e=>{setMemberSearch(e.target.value);setMemberVisibleCount(30);}} style={{ flex:1,padding:"11px 5px",border:"none",background:"transparent",fontSize:13.5,color:tc,fontFamily:"'Tajawal'",direction:"rtl",outline:"none" }}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:12}}>
              <select value={memberStatusFilter} onChange={e=>{setMemberStatusFilter(e.target.value);setMemberVisibleCount(30);}}
                style={{ padding:"8px 6px",borderRadius:8,border:`1px solid ${darkMode?"rgba(255,255,255,.12)":C.grayLight}`,background:darkMode?"#1a2744":"white",color:tc,fontSize:12,fontFamily:"'Tajawal'" }}>
                <option value="">كل الحالات</option>
                <option value="pending">⏳ معلق</option>
                <option value="approved">✅ مفعّل</option>
                <option value="rejected">❌ مرفوض</option>
              </select>
              <select value={memberTypeFilter} onChange={e=>{setMemberTypeFilter(e.target.value);setMemberVisibleCount(30);}}
                style={{ padding:"8px 6px",borderRadius:8,border:`1px solid ${darkMode?"rgba(255,255,255,.12)":C.grayLight}`,background:darkMode?"#1a2744":"white",color:tc,fontSize:12,fontFamily:"'Tajawal'" }}>
                <option value="">كل الباقات</option>
                {Object.keys(PLANS).map(k=><option key={k} value={k}>{PLANS[k].label}</option>)}
              </select>
              <select value={memberGovFilter} onChange={e=>{setMemberGovFilter(e.target.value);setMemberVisibleCount(30);}}
                style={{ padding:"8px 6px",borderRadius:8,border:`1px solid ${darkMode?"rgba(255,255,255,.12)":C.grayLight}`,background:darkMode?"#1a2744":"white",color:tc,fontSize:12,fontFamily:"'Tajawal'" }}>
                <option value="">كل المحافظات</option>
                {GOVERNORATES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {(memberStatusFilter||memberTypeFilter||memberGovFilter) && (
              <button className="btn btn-ghost btn-sm" style={{marginBottom:10}} onClick={()=>{setMemberStatusFilter("");setMemberTypeFilter("");setMemberGovFilter("");}}>✕ مسح الفلاتر</button>
            )}
            {filteredMembers.slice(0,memberVisibleCount).map((m,i)=>(
              <div key={m.id} style={{ background:card,borderRadius:13,padding:13,marginBottom:8,border:`1px solid ${darkMode?"rgba(201,168,76,.08)":C.grayLight}`,animation:`fadeInUp ${.1+i*.04}s ease both` }}>
                <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:8 }}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minWidth:22,height:22,borderRadius:"50%",background:darkMode?"rgba(201,168,76,.15)":"#F0F0F0",color:C.gold,fontSize:11,fontWeight:800,flexShrink:0 }}>{i+1}</div>
                  <Av text={m.name} size={44} type={getMemberPlan(m)}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:13.5,color:tc,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{m.name}</div>
                    <div style={{ fontSize:11.5,color:sub }}>{m.specialty} · {m.gov}</div>
                    <div style={{ fontSize:11,color:sub,marginTop:2 }}>📱 {m.phone}</div>
                  </div>
                  <div style={{ display:"flex",gap:5 }}>
                    <button onClick={()=>window.open(`tel:${m.phone}`)} style={{ background:`rgba(34,197,94,.12)`,border:`1px solid rgba(34,197,94,.25)`,borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:14 }}>📞</button>
                    <button onClick={()=>toggleVerified(m.id, !m.verified)} title={m.verified?"إلغاء التوثيق":"توثيق العضو"}
                      style={{ background: m.verified?`rgba(201,168,76,.18)`:(darkMode?"rgba(255,255,255,.06)":"#F0F0F0"), border:`1px solid ${m.verified?"rgba(201,168,76,.4)":"transparent"}`,borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:14 }}>
                      {m.verified?"✅":"⚪"}
                    </button>
                    <button onClick={()=>resetMemberPassword(m.id, m.name)} title="إعادة تعيين كلمة السر"
                      style={{ background: darkMode?"rgba(255,255,255,.06)":"#F0F0F0", border:"1px solid transparent",borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:14 }}>🔑</button>
                    <button onClick={()=>{ if(window.confirm(`حذف "${m.name}" نهائياً؟`)) deleteMember(m.id); }} style={{ background:`rgba(239,68,68,.1)`,border:`1px solid rgba(239,68,68,.2)`,borderRadius:8,padding:"6px 9px",cursor:"pointer",fontSize:14 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                  <span style={{ fontSize:11.5,color:sub,flexShrink:0 }}>العضوية:</span>
                  <select value={m.type||"starter"} onChange={e=>changeMemberType(m.id,e.target.value)}
                    style={{ flex:1,padding:"5px 8px",borderRadius:8,border:`1px solid ${C.gold}44`,background:darkMode?"#1a2744":"white",color:tc,fontSize:12,fontFamily:"'Tajawal'",cursor:"pointer" }}>
                    {Object.entries(PLANS).map(([k,pl])=><option key={k} value={k}>{pl.label} - {getPlanPrice(k,appSettings)===0?"مجاني":getPlanPrice(k,appSettings)+"ج"}</option>)}
                  </select>
                  <select value={m.status||"pending"} onChange={async e=>{
                    const v = e.target.value;
                    // بنمرّ دايمًا على approveMember/rejectMember (مش تحديث خام) عشان يتحسب الاشتراك والدفعة والإشعار تلقائيًا مهما كان مصدر التغيير
                    if (v === "approved") { await approveMember(m.id); return; }
                    if (v === "rejected") { await rejectMember(m.id); return; }
                    try{ await updateDoc(doc(db,"members",m.id),{status:v}); setMembers(p=>p.map(x=>x.id===m.id?{...x,status:v}:x)); }catch(err){}
                  }}
                    style={{ flex:1,padding:"5px 8px",borderRadius:8,border:`1px solid rgba(34,197,94,.4)`,background:darkMode?"#1a2744":"white",color:tc,fontSize:12,fontFamily:"'Tajawal'",cursor:"pointer" }}>
                    <option value="pending">⏳ معلق</option>
                    <option value="approved">✅ مفعّل</option>
                    <option value="rejected">❌ مرفوض</option>
                  </select>
                </div>
                {m.status==="approved" && m.type!=="starter" && (()=>{
                  const endD = m.subscriptionEnd?.toDate?.() || (m.subscriptionEnd ? new Date(m.subscriptionEnd) : null);
                  const daysLeft = endD ? Math.ceil((endD.getTime()-Date.now())/86400000) : null;
                  const expired = daysLeft !== null && daysLeft <= 0;
                  return (
                    <div style={{ display:"flex",gap:6,alignItems:"center",marginTop:8 }}>
                      <span style={{ fontSize:10.5,fontWeight:700,color: daysLeft===null?sub:expired?C.error:daysLeft<=5?C.warning:C.success,background: daysLeft===null?"transparent":(expired?"rgba(239,68,68,.12)":daysLeft<=5?"rgba(245,158,11,.12)":"rgba(34,197,94,.1)"),borderRadius:20,padding: daysLeft===null?0:"3px 10px" }}>
                        {daysLeft===null ? "لا يوجد تاريخ اشتراك مسجل" : expired ? "⚠️ الاشتراك منتهي" : `⏳ متبقي ${daysLeft} يوم`}
                      </span>
                      <button onClick={()=>{setCustomDays(365);setConfirmModal({type:"renew",id:m.id,name:m.name});}} style={{ background:`rgba(201,168,76,.14)`,border:`1px solid rgba(201,168,76,.3)`,borderRadius:8,padding:"4px 9px",cursor:"pointer",fontSize:10.5,fontWeight:700,color:C.gold,fontFamily:"'Tajawal'" }}>🔄 تجديد</button>
                    </div>
                  );
                })()}
              </div>
            ))}
            {filteredMembers.length > memberVisibleCount && (
              <button className="btn btn-outline" style={{width:"100%",marginTop:6}} onClick={()=>setMemberVisibleCount(c=>c+30)}>
                عرض المزيد ({filteredMembers.length - memberVisibleCount} متبقي)
              </button>
            )}
            {filteredMembers.length===0 && (
              <div style={{ textAlign:"center",padding:"50px 20px" }}>
                <div style={{ fontSize:50,marginBottom:10 }}>🔍</div>
                <div style={{ color:tc,fontWeight:700,marginBottom:5 }}>لا توجد نتائج</div>
                <div style={{ color:sub,fontSize:13 }}>جرّب تغيير البحث أو الفلاتر</div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ SERVICE REQUESTS (اطلب صنايعي) ══════════════ */}
        {section==="serviceRequests" && (
          <AdminServiceRequestsSection darkMode={darkMode} />
        )}

        {/* ══════════════ ADS ══════════════ */}
        {section==="ads" && (
          <>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13 }}>
              <div>
                <div style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc }}>📢 إدارة الإعلانات</div>
                <div style={{ color:sub,fontSize:12,marginTop:2 }}>{ads.length} إعلان</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowAddAd(true)}>+ إضافة إعلان</button>
            </div>

            {adsLoading && <div style={{ textAlign:"center",padding:"30px",color:sub }}><Spinner size={20} color={C.gold}/> <span style={{ marginRight:8,fontFamily:"'Cairo'" }}>جاري تحميل الإعلانات...</span></div>}
            {!adsLoading && ads.length===0 && (
              <div style={{ textAlign:"center",padding:"40px 20px" }}>
                <div style={{ fontSize:48,marginBottom:10 }}>📢</div>
                <div style={{ color:tc,fontWeight:700,marginBottom:5 }}>لا توجد إعلانات بعد</div>
                <div style={{ color:sub,fontSize:13 }}>أضف أول إعلان باستخدام الزر أعلاه</div>
              </div>
            )}
            {ads.map((ad,i)=>(
              <div key={ad.id} style={{ background:card,borderRadius:15,padding:14,marginBottom:11,border:`1px solid ${ad.status==="active"?C.gold+"33":ad.status==="pending"?C.warning+"33":darkMode?"rgba(255,255,255,.06)":C.grayLight}`,animation:`fadeInUp ${.1+i*.07}s ease both` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9,gap:10 }}>
                  <div style={{ display:"flex",gap:10,minWidth:0 }}>
                    {ad.imageUrl && <img src={ad.imageUrl} alt="" style={{ width:46,height:46,borderRadius:9,objectFit:"cover",flexShrink:0 }}/>}
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:800,fontSize:14.5,color:tc,marginBottom:2 }}>{ad.title}</div>
                      <div style={{ fontSize:12,color:sub }}>👤 {ad.advertiser} · 📞 {ad.phone}</div>
                    </div>
                  </div>
                  <div>
                    {ad.status==="active" && <span style={{ background:`rgba(34,197,94,.15)`,color:C.success,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700 }}>🟢 نشط</span>}
                    {ad.status==="pending" && <span style={{ background:`rgba(245,158,11,.15)`,color:C.warning,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700 }}>⏳ معلق</span>}
                    {ad.status==="paused" && <span style={{ background:`rgba(138,155,176,.15)`,color:C.gray,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700 }}>⏸️ موقوف</span>}
                  </div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:11 }}>
                  {[["📋",{banner:"بانر",inline:"داخلي",hero:"رئيسي"}[ad.plan]||ad.plan,"المكان"],[" 👁",ad.views,"مشاهدة"],["🖱️",ad.clicks,"نقرة"],["💰",`${ad.price} ج`,"السعر"]].map(([icon,val,label])=>(
                    <div key={label} style={{ background:darkMode?"rgba(255,255,255,.04)":"#F8FAFF",borderRadius:9,padding:"8px 5px",textAlign:"center",border:`1px solid ${darkMode?"rgba(255,255,255,.06)":C.grayLight}` }}>
                      <div style={{ fontSize:14,marginBottom:2 }}>{icon}</div>
                      <div style={{ fontFamily:"'Cairo'",fontWeight:700,fontSize:12.5,color:tc }}>{val}</div>
                      <div style={{ fontSize:9.5,color:sub }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex",gap:7 }}>
                  {ad.status==="pending" && <button className="btn btn-primary btn-sm" style={{ flex:2 }} onClick={()=>approveAd(ad.id)}>✅ تفعيل الإعلان</button>}
                  {ad.status==="active" && <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={()=>pauseAd(ad.id)}>⏸️ إيقاف</button>}
                  {ad.status==="paused" && <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={()=>approveAd(ad.id)}>▶️ تشغيل</button>}
                  <button className="btn btn-danger btn-sm" onClick={()=>deleteAd(ad.id)}>🗑️</button>
                </div>
              </div>
            ))}

            {/* Add Ad Modal */}
            {showAddAd && (
              <div className="modal-overlay" onClick={()=>setShowAddAd(false)}>
                <div className="modal-sheet" style={{ background:card }} onClick={e=>e.stopPropagation()}>
                  <div className="modal-handle"/>
                  <div style={{ padding:"14px 18px 28px" }}>
                    <h3 style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:14 }}>📢 إضافة إعلان جديد</h3>
                    {[["title","عنوان الإعلان *","text"],["advertiser","اسم المعلن","text"],["phone","رقم الهاتف *","tel"],["desc","وصف الإعلان (يظهر في الصفحة الرئيسية)","text"],["price","السعر (جنيه)","number"],["endDate","تاريخ الانتهاء","date"]].map(([k,l,t])=>(
                      <div key={k} className="form-group">
                        <label className="form-label" style={{ color:tc }}>{l}</label>
                        <input className={`input${darkMode?" input-dark":""}`} type={t} value={newAd[k]||""} onChange={e=>setNewAd(p=>({...p,[k]:e.target.value}))}/>
                      </div>
                    ))}
                    <div className="form-group">
                      <label className="form-label" style={{ color:tc }}>إيموجي الإعلان (يظهر كخلفية)</label>
                      <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:6 }}>
                        {["🏢","🏢","🔧","⚡","🎨","🔨","📦","💎","❄️","🏛️"].map(em=>(
                          <div key={em} onClick={()=>setNewAd(p=>({...p,emoji:em}))} style={{ width:38,height:38,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",border:`2px solid ${newAd.emoji===em?C.gold:"transparent"}`,background:newAd.emoji===em?"rgba(201,168,76,.15)":"rgba(255,255,255,.05)" }}>{em}</div>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color:tc }}>مكان الإعلان</label>
                      <select className={`select${darkMode?" select-dark":""}`} value={newAd.plan} onChange={e=>setNewAd(p=>({...p,plan:e.target.value}))}>
                        <option value="hero">🔝 بانر رئيسي (أعلى الصفحة)</option>
                        <option value="inline">📄 إعلان داخلي (بين الأقسام)</option>
                        <option value="banner">📑 بين المنشورات</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color:tc }}>صورة الإعلان (اختياري)</label>
                      <div style={{ color:sub, fontSize:11, marginBottom:7 }}>
                        الصورة هتظهر بالحجم المناسب من غير تشويه — رفع أي حجم وهتتعرض بشكل صحيح
                      </div>
                      {adImagePreview && (
                        <div style={{ position:"relative", marginBottom:8, borderRadius:10, overflow:"hidden", aspectRatio: `${(AD_IMAGE_DIMS[newAd.plan]||AD_IMAGE_DIMS.banner).w}/${(AD_IMAGE_DIMS[newAd.plan]||AD_IMAGE_DIMS.banner).h}` }}>
                          <img src={adImagePreview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          <button onClick={()=>{if(adImagePreview)URL.revokeObjectURL(adImagePreview);setAdImageFile(null);setAdImagePreview(null);}} style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,.65)", border:"none", borderRadius:"50%", width:24, height:24, color:"white", cursor:"pointer", fontSize:13 }}>✕</button>
                        </div>
                      )}
                      <input id="adImageInput" type="file" accept="image/*" style={{ display:"none" }} onChange={handleAdImage}/>
                      <button className="btn btn-outline" style={{ width:"100%" }} onClick={()=>document.getElementById("adImageInput")?.click()} disabled={uploadingAdImage}>
                        {uploadingAdImage ? <><Spinner size={13} color={C.gold}/> جاري الرفع...</> : adImagePreview ? "📸 تغيير الصورة" : "📸 رفع صورة الإعلان"}
                      </button>
                    </div>
                    <button className="btn btn-primary btn-lg" style={{ width:"100%",marginBottom:8,marginTop:10 }} onClick={addAd} disabled={uploadingAdImage}>{uploadingAdImage?"جاري الرفع...":"إضافة الإعلان"}</button>
                    <button className="btn btn-ghost" style={{ width:"100%" }} onClick={()=>setShowAddAd(false)}>إلغاء</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ NOTIFICATIONS ══════════════ */}
        {section==="notifications" && (
          <>
            <div style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:13 }}>🔔 إرسال إشعارات جماعية</div>
            <div style={{ background:card,borderRadius:15,padding:16,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
              <div className="form-group">
                <label className="form-label req" style={{ color:tc }}>الجمهور المستهدف</label>
                <select className={`select${darkMode?" select-dark":""}`} value={notifTarget} onChange={e=>setNotifTarget(e.target.value)}>
                  <option value="all">📢 جميع المستخدمين</option>
                  <option value="elite">👑 شركاء النخبة فقط</option>
                  <option value="company">🏢 أعضاء الشركات فقط</option>
                  <option value="vip">⭐ أعضاء VIP فقط</option>
                  <option value="premium">✨ أعضاء Premium</option>
                  <option value="basic">أعضاء Basic</option>
                  <option value="starter">أعضاء مبتدئ</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label req" style={{ color:tc }}>نص الإشعار</label>
                <textarea className={`input${darkMode?" input-dark":""}`} placeholder="اكتب نص الإشعار هنا..." value={notifText} onChange={e=>setNotifText(e.target.value)} rows={4}/>
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
                {["🎉 عرض خاص!","⚠️ تنبيه مهم","📢 إعلان جديد","🆕 ميزة جديدة"].map(t=>(
                  <div key={t} className="chip chip-gray" style={{ fontSize:11.5 }} onClick={()=>setNotifText(t)}>{t}</div>
                ))}
              </div>
              <button className="btn btn-primary btn-lg" style={{ width:"100%" }} onClick={sendNotification} disabled={!notifText.trim()||sendingNotif}>
                {sendingNotif ? <><Spinner size={16} color={C.navyDeep}/> جاري الإرسال...</> : `🚀 إرسال لـ ${notifTarget==="all"?"الجميع":`أعضاء ${notifTarget}`}`}
              </button>
            </div>

            {/* Notification History */}
            <div style={{ marginTop:14,background:card,borderRadius:15,padding:15,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
              <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:700,marginBottom:12 }}>📋 سجل الإشعارات المُرسلة</h4>
              {sentNotifs.length===0?(
                <div style={{textAlign:"center",padding:"20px",color:sub,fontSize:13}}>لا توجد إشعارات مرسلة بعد</div>
              ):sentNotifs.map((n,i)=>{
                const t = n.time?.toMillis?.() || (n.time?.seconds?n.time.seconds*1000:Date.now());
                const diff = (Date.now()-t)/86400000;
                const timeStr = diff<1?"اليوم":diff<7?`منذ ${Math.floor(diff)} أيام`:`منذ ${Math.floor(diff/7)} أسابيع`;
                return (
                  <div key={i} style={{ borderBottom:`1px solid ${darkMode?"rgba(255,255,255,.05)":C.grayLight}`,paddingBottom:10,marginBottom:10 }}>
                    <div style={{ fontWeight:600,fontSize:13,color:tc,marginBottom:3 }}>{n.text||n.body}</div>
                    <div style={{ display:"flex",gap:10,fontSize:11,color:sub }}>
                      <span>👥 {n.target==="all"?"الجميع":n.target}</span>
                      <span>🕐 {timeStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══════════════ PAYMENTS ══════════════ */}
        {section==="payments" && (
          <>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13 }}>
              <div style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc }}>💰 سجل المدفوعات</div>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowAddPayment(v=>!v)}>+ تسجيل دفعة</button>
            </div>
            {showAddPayment && (
              <div style={{ background:card,borderRadius:13,padding:13,marginBottom:13,border:`1px solid ${C.gold}44` }}>
                <input placeholder="اسم العضو/العميل" value={newPayment.name} onChange={e=>setNewPayment(p=>({...p,name:e.target.value}))} style={{ width:"100%",padding:"9px 11px",borderRadius:9,border:`1px solid ${C.grayLight}`,marginBottom:8,fontFamily:"'Tajawal'" }}/>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8 }}>
                  <select value={newPayment.plan} onChange={e=>setNewPayment(p=>({...p,plan:e.target.value}))} style={{ padding:"9px",borderRadius:9,border:`1px solid ${C.grayLight}` }}>
                    {Object.keys(PLANS).map(k=><option key={k} value={k}>{PLANS[k].label}</option>)}
                  </select>
                  <input type="number" placeholder="المبلغ (ج)" value={newPayment.amount} onChange={e=>setNewPayment(p=>({...p,amount:e.target.value}))} style={{ padding:"9px",borderRadius:9,border:`1px solid ${C.grayLight}` }}/>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
                  <select value={newPayment.method} onChange={e=>setNewPayment(p=>({...p,method:e.target.value}))} style={{ padding:"9px",borderRadius:9,border:`1px solid ${C.grayLight}` }}>
                    {["فودافون كاش","InstaPay","فوري","بطاقة بنكية"].map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={newPayment.status} onChange={e=>setNewPayment(p=>({...p,status:e.target.value}))} style={{ padding:"9px",borderRadius:9,border:`1px solid ${C.grayLight}` }}>
                    <option value="success">✅ ناجحة</option>
                    <option value="failed">❌ فاشلة</option>
                  </select>
                </div>
                <button className="btn btn-primary btn-sm" style={{width:"100%"}} disabled={savingPayment} onClick={addPaymentManual}>{savingPayment?"جاري الحفظ...":"💾 حفظ الدفعة"}</button>
              </div>
            )}
            {payments.length===0?<div style={{textAlign:"center",padding:"40px",color:sub}}>لا توجد مدفوعات مسجلة بعد</div>:
            payments.map((p,i)=>(
              <div key={p.id||i} style={{ background:card,borderRadius:13,padding:13,marginBottom:8,border:`1px solid ${p.status==="success"?C.success+"22":C.error+"22"}`,display:"flex",gap:10,alignItems:"center" }}>
                <div style={{ width:40,height:40,borderRadius:10,background:p.status==="success"?`rgba(34,197,94,.12)`:`rgba(239,68,68,.12)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>
                  {p.status==="success"?"✅":"❌"}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:13.5,color:tc }}>{p.name||""}</div>
                  <div style={{ fontSize:11,color:sub }}>{p.method||""} · {tAgo(p.date)}</div>
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontFamily:"'Cairo'",fontWeight:900,fontSize:15,color:p.status==="success"?C.success:C.error }}>{p.amount||0} ج</div>
                  <div style={{ fontSize:10,color:sub }}>{PLANS[p.plan]?.label || p.plan || ""}</div>
                </div>
              </div>
            ))}
            {/* Summary — أرقام حقيقية محسوبة من سجل المدفوعات الفعلي بدل أرقام ثابتة */}
            <div style={{ background:`linear-gradient(135deg,${C.navy},${C.navyLight})`,borderRadius:15,padding:15,marginTop:5,border:`1px solid rgba(201,168,76,.2)` }}>
              <div style={{ color:"rgba(201,168,76,.7)",fontSize:11,fontWeight:700,marginBottom:8 }}>ملخص إجمالي (كل السجل المحمّل)</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
                {[[`${(stats?.totalRevenue||0).toLocaleString()} ج`,"إجمالي الإيرادات"],[String(stats?.successCount||0),"معاملة ناجحة"],[String(stats?.failedCount||0),"معاملة فاشلة"]].map(([v,l])=>(
                  <div key={l} style={{ textAlign:"center" }}>
                    <div style={{ fontFamily:"'Cairo'",fontWeight:900,color:C.gold,fontSize:15 }}>{v}</div>
                    <div style={{ color:"rgba(255,255,255,.5)",fontSize:10 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════ SETTINGS ══════════════ */}
        {section==="settings" && (
          <>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:13 }}>
              {settingsSection && <button onClick={()=>setSettingsSection(null)} style={{ background:"none",border:"none",color:C.gold,fontSize:20,cursor:"pointer",padding:0 }}>→</button>}
              <div style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc }}>⚙️ إعدادات التطبيق</div>
            </div>

            {/* Settings Menu */}
            {!settingsSection && [
              { key:"prices", icon:"💰", title:"أسعار الباقات", desc:"تعديل أسعار مبتدئ / أساسي / مميز / VIP" },
              { key:"limits", icon:"📝", title:"حدود النشر والفيديو", desc:"عدد المنشورات والفيديوهات المسموحة لكل باقة" },
              { key:"contact", icon:"🔗", title:"بيانات التواصل", desc:"واتساب، فيسبوك، إنستغرام، الموقع" },
              { key:"general", icon:"🔧", title:"إعدادات عامة", desc:"اسم التطبيق، الموافقة التلقائية، وضع الصيانة" },
              { key:"security", icon:"🔐", title:"الأمان والدخول", desc:"رقم الأدمن، الرقم السري، إيميل الأدمن" },
            ].map((s,i)=>(
              <div key={s.key} onClick={()=>setSettingsSection(s.key)} style={{ background:card,borderRadius:13,padding:14,marginBottom:8,border:`1px solid ${darkMode?"rgba(201,168,76,.08)":C.grayLight}`,display:"flex",gap:12,alignItems:"center",cursor:"pointer",transition:"all .2s",animation:`fadeInUp ${.1+i*.06}s ease both` }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.transform="translateX(-3px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=darkMode?"rgba(201,168,76,.08)":C.grayLight;e.currentTarget.style.transform="translateX(0)";}}>
                <div style={{ width:44,height:44,borderRadius:12,background:"rgba(201,168,76,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{s.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,fontSize:14,color:tc }}>{s.title}</div>
                  <div style={{ fontSize:12,color:sub }}>{s.desc}</div>
                </div>
                <div style={{ color:C.gold,fontSize:18 }}>←</div>
              </div>
            ))}

            {/* Prices Settings */}
            {settingsSection==="prices" && (
              <div style={{ background:card,borderRadius:15,padding:16,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
                <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:800,marginBottom:14,fontSize:15 }}>💰 أسعار الباقات (جنيه/سنة)</h4>
                {Object.entries(PLANS).map(([k,pl])=>[k,pl.label,pl.color]).map(([k,l,color])=>(
                  <div key={k} className="form-group" style={{ marginBottom:12 }}>
                    <label className="form-label" style={{ color:tc,display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ width:10,height:10,borderRadius:"50%",background:color,display:"inline-block" }}/>
                      {l}
                    </label>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <input className={`input${darkMode?" input-dark":""}`} type="number" min="0"
                        value={appSettings.planPrices?.[k]||""}
                        onChange={e=>setAppSettings(p=>({...p,planPrices:{...p.planPrices,[k]:Number(e.target.value)}}))}
                        style={{ flex:1 }}/>
                      <span style={{ color:sub,fontSize:13 }}>ج/سنة</span>
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary btn-lg" style={{ width:"100%" }} onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings?"جاري الحفظ...":"💾 حفظ الأسعار"}
                </button>
              </div>
            )}

            {/* Post & Video Limits Settings */}
            {settingsSection==="limits" && (
              <div style={{ background:card,borderRadius:15,padding:16,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
                <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:800,marginBottom:6,fontSize:15 }}>📝 عدد المنشورات المسموح بها شهريًا لكل باقة</h4>
                <div style={{ color:sub,fontSize:11.5,marginBottom:14 }}>حدد كام منشور يقدر العضو ينشره كل شهر حسب باقته — والعداد بيتصفّر تلقائيًا أول كل شهر. ضع 0 لمنع النشر تماماً.</div>
                {Object.entries(PLANS).map(([k,pl])=>[k,pl.label,pl.color]).map(([k,l,color])=>(
                  <div key={k} className="form-group" style={{ marginBottom:12 }}>
                    <label className="form-label" style={{ color:tc,display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ width:10,height:10,borderRadius:"50%",background:color,display:"inline-block" }}/>
                      {l}
                    </label>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <input className={`input${darkMode?" input-dark":""}`} type="number" min="0"
                        value={appSettings.postLimits?.[k]??0}
                        onChange={e=>setAppSettings(p=>({...p,postLimits:{...p.postLimits,[k]:Math.max(0,Number(e.target.value))}}))}
                        style={{ flex:1 }}/>
                      <span style={{ color:sub,fontSize:13 }}>منشور</span>
                    </div>
                  </div>
                ))}

                <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:800,marginTop:18,marginBottom:6,fontSize:15 }}>🎬 عدد الفيديوهات المسموح برفعها لكل باقة</h4>
                <div style={{ color:sub,fontSize:11.5,marginBottom:14 }}>عادةً تُفعّل هذه الميزة لأعلى باقة فقط (VIP) بفيديو واحد.</div>
                {Object.entries(PLANS).map(([k,pl])=>[k,pl.label,pl.color]).map(([k,l,color])=>(
                  <div key={k} className="form-group" style={{ marginBottom:12 }}>
                    <label className="form-label" style={{ color:tc,display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ width:10,height:10,borderRadius:"50%",background:color,display:"inline-block" }}/>
                      {l}
                    </label>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <input className={`input${darkMode?" input-dark":""}`} type="number" min="0" max="20"
                        value={appSettings.videoLimits?.[k]??0}
                        onChange={e=>setAppSettings(p=>({...p,videoLimits:{...p.videoLimits,[k]:Math.max(0,Number(e.target.value))}}))}
                        style={{ flex:1 }}/>
                      <span style={{ color:sub,fontSize:13 }}>فيديو</span>
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary btn-lg" style={{ width:"100%" }} onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings?"جاري الحفظ...":"💾 حفظ الحدود"}
                </button>
              </div>
            )}

            {/* Contact Settings */}
            {settingsSection==="contact" && (
              <div style={{ background:card,borderRadius:15,padding:16,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
                <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:800,marginBottom:14,fontSize:15 }}>🔗 بيانات التواصل</h4>
                {[["whatsapp","📱 واتساب (مع كود الدولة)","tel"],["facebook","📘 فيسبوك (رابط أو اسم الصفحة)","text"],["instagram","📸 إنستغرام (@username)","text"],["website","🌐 الموقع الإلكتروني","url"]].map(([k,l,t])=>(
                  <div key={k} className="form-group" style={{ marginBottom:12 }}>
                    <label className="form-label" style={{ color:tc }}>{l}</label>
                    <input className={`input${darkMode?" input-dark":""}`} type={t}
                      value={appSettings[k]||""}
                      onChange={e=>setAppSettings(p=>({...p,[k]:e.target.value}))}
                      placeholder={k==="whatsapp"?"201110001986":k==="instagram"?"@daleel_shamil":""}/>
                  </div>
                ))}
                <div className="form-group" style={{ marginBottom:14 }}>
                  <label className="form-label" style={{ color:tc }}>💬 رسالة الترحيب (تظهر للأعضاء الجدد)</label>
                  <textarea className={`input${darkMode?" input-dark":""}`} rows={3}
                    value={appSettings.welcomeMsg||""}
                    onChange={e=>setAppSettings(p=>({...p,welcomeMsg:e.target.value}))}
                    placeholder="أهلاً بك في الدليل الشامل..."/>
                </div>
                <button className="btn btn-primary btn-lg" style={{ width:"100%" }} onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings?"جاري الحفظ...":"💾 حفظ بيانات التواصل"}
                </button>
              </div>
            )}

            {/* General Settings */}
            {settingsSection==="general" && (
              <div style={{ background:card,borderRadius:15,padding:16,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
                <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:800,marginBottom:14,fontSize:15 }}>🔧 إعدادات عامة</h4>
                <div className="form-group" style={{ marginBottom:12 }}>
                  <label className="form-label" style={{ color:tc }}>اسم التطبيق</label>
                  <input className={`input${darkMode?" input-dark":""}`} value={appSettings.appName||""}
                    onChange={e=>setAppSettings(p=>({...p,appName:e.target.value}))}/>
                </div>
                {[
                  { key:"autoApprove", label:"✅ موافقة تلقائية على الأعضاء الجدد", desc:"تفعيل الحسابات فوراً بدون مراجعة يدوية" },
                  { key:"maintenanceMode", label:"🔧 وضع الصيانة", desc:"إخفاء التطبيق من المستخدمين مؤقتاً" },
                ].map(({key,label,desc})=>(
                  <div key={key} style={{ background:darkMode?"rgba(255,255,255,.04)":"#F8FAFF",borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1px solid ${darkMode?"rgba(255,255,255,.07)":C.grayLight}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10 }}>
                    <div>
                      <div style={{ fontWeight:700,fontSize:13.5,color:tc }}>{label}</div>
                      <div style={{ fontSize:11.5,color:sub,marginTop:2 }}>{desc}</div>
                    </div>
                    <div className={`toggle ${appSettings[key]?"on":""}`}
                      onClick={()=>setAppSettings(p=>({...p,[key]:!p[key]}))}/>
                  </div>
                ))}
                <button className="btn btn-primary btn-lg" style={{ width:"100%",marginTop:4 }} onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings?"جاري الحفظ...":"💾 حفظ الإعدادات"}
                </button>
              </div>
            )}

            {/* Security Settings */}
            {settingsSection==="security" && (
              <div style={{ background:card,borderRadius:15,padding:16,border:`1px solid ${darkMode?"rgba(201,168,76,.1)":C.grayLight}` }}>
                <h4 style={{ color:tc,fontFamily:"'Cairo'",fontWeight:800,marginBottom:6,fontSize:15 }}>🔐 الأمان والدخول</h4>
                <div style={{ background:`rgba(239,68,68,.08)`,border:`1px solid rgba(239,68,68,.2)`,borderRadius:10,padding:"10px 13px",marginBottom:14 }}>
                  <div style={{ color:C.error,fontSize:12,fontWeight:700 }}>⚠️ تنبيه: بعد التغيير ستحتاج لاستخدام البيانات الجديدة لتسجيل الدخول</div>
                </div>
                <div className="form-group" style={{ marginBottom:12 }}>
                  <label className="form-label" style={{ color:tc }}>📱 رقم موبايل الأدمن</label>
                  <input className={`input${darkMode?" input-dark":""}`} type="tel"
                    value={appSettings.adminPhone||""}
                    onChange={e=>setAppSettings(p=>({...p,adminPhone:e.target.value}))}
                    placeholder="01110001986"/>
                </div>
                <div className="form-group" style={{ marginBottom:12 }}>
                  <label className="form-label" style={{ color:tc }}>🔑 الرقم السري (PIN)</label>
                  <input className={`input${darkMode?" input-dark":""}`} type="password" maxLength={30}
                    value={appSettings.adminPin||""}
                    onChange={e=>setAppSettings(p=>({...p,adminPin:e.target.value}))}
                    placeholder="رقم/كلمة سرية"
                    style={{ letterSpacing:2, textAlign:"center", fontSize:18 }}/>
                </div>
                <div className="form-group" style={{ marginBottom:14 }}>
                  <label className="form-label" style={{ color:tc }}>📧 إيميل الأدمن (اختياري)</label>
                  <input className={`input${darkMode?" input-dark":""}`} type="email"
                    value={appSettings.adminEmail||""}
                    onChange={e=>setAppSettings(p=>({...p,adminEmail:e.target.value}))}
                    placeholder="admin@daleel.com"/>
                </div>
                <button className="btn btn-danger btn-lg" style={{ width:"100%" }} onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings?"جاري الحفظ...":"🔐 حفظ بيانات الدخول"}
                </button>
              </div>
            )}
          </>
        )}

      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={()=>setConfirmModal(null)}>
          <div className="modal-sheet" style={{ background:card }} onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{ padding:"18px 20px 28px", textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>{confirmModal.type==="approve"?"✅":confirmModal.type==="renew"?"🔄":"❌"}</div>
              <h3 style={{ fontFamily:"'Cairo'",fontWeight:800,fontSize:17,color:tc,marginBottom:6 }}>
                {confirmModal.type==="approve"?"قبول العضو":confirmModal.type==="renew"?"تجديد الاشتراك":"رفض العضو"}
              </h3>
              <p style={{ color:sub,fontSize:13,marginBottom:14 }}>
                {confirmModal.type==="approve"
                  ? `هل تريد قبول وتفعيل حساب "${confirmModal.name}"؟ سيتم إرسال بريد تأكيد له.`
                  : confirmModal.type==="renew"
                  ? `حدّد عدد أيام الاشتراك الجديدة لـ "${confirmModal.name}".`
                  : `هل تريد رفض طلب "${confirmModal.name}"؟ سيتم إرسال إشعار بالرفض.`}
              </p>
              {(confirmModal.type==="approve" || confirmModal.type==="renew") && (
                <div style={{ marginBottom:18, textAlign:"right" }}>
                  <label style={{ fontSize:12,color:sub,fontWeight:700,display:"block",marginBottom:6 }}>📅 مدة الاشتراك (بالأيام)</label>
                  <input type="number" min="1" value={customDays}
                    onChange={e=>setCustomDays(e.target.value===""?"":Math.max(1,Number(e.target.value)))}
                    style={{ width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${darkMode?"rgba(255,255,255,.12)":C.grayLight}`,background:darkMode?"rgba(255,255,255,.04)":"#F8FAFF",color:tc,fontSize:14,fontFamily:"'Tajawal'",textAlign:"center",outline:"none" }}/>
                  <div style={{ fontSize:10.5,color:sub,marginTop:4 }}>الافتراضي 365 يوم (سنة) — تقدر تغيّره لأي مدة تانية حسب الاتفاق مع العضو</div>
                </div>
              )}
              <div style={{ display:"flex",gap:10 }}>
                <button className={`btn btn-lg ${confirmModal.type==="reject"?"btn-danger":"btn-primary"}`} style={{ flex:2 }}
                  disabled={(confirmModal.type==="approve"||confirmModal.type==="renew") && (!customDays || customDays<1)}
                  onClick={()=>{
                    if(confirmModal.type==="approve") approveMember(confirmModal.id, customDays);
                    else if(confirmModal.type==="renew") renewMemberSubscription(confirmModal.id, customDays);
                    else rejectMember(confirmModal.id);
                  }}>
                  {confirmModal.type==="approve"?"✅ تأكيد القبول":confirmModal.type==="renew"?"🔄 تأكيد التجديد":"❌ تأكيد الرفض"}
                </button>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setConfirmModal(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// STATIC PAGES — من نحن / كيف يعمل الدليل / الأسئلة الشائعة / الخصوصية / الشروط
// كل صفحة ليها رابط مستقل (زي /about) عشان تكون قابلة للفهرسة في جوجل
// ============================================================
const STATIC_PAGES_CONTENT = {
  about: {
    title: "من نحن",
    body: [
      "الدليل الشامل هو منصة إلكترونية مصرية بتساعد الناس تلاقي أفضل الصنايعية والفنيين والشركات والموردين الموثوقين في مجال المقاولات والتشطيبات والعقارات، في كل محافظات مصر.",
      "هدفنا إننا نسهّل الوصول بين اللي محتاج خدمة (كهربائي، سباك، نقاش، شركة تشطيبات، مورد مواد بناء...) واللي بيقدّم الخدمة دي فعليًا، من غير وسطاء ومن غير تعقيد.",
      "كل صنايعي أو شركة على المنصة عندهم بروفايل فيه تخصصهم، منطقة عملهم، وسنين خبرتهم، عشان تقدر تاخد قرارك وانت مطمئن.",
    ],
  },
  "how-it-works": {
    title: "كيف يعمل الدليل الشامل",
    body: [
      "1. ابحث عن التخصص أو الخدمة اللي محتاجها (كهربائي، سباك، شركة تشطيبات...) أو دوّر حسب المحافظة والمنطقة.",
      "2. تصفح بروفايلات الصنايعية والشركات المتاحة، وشوف تخصصهم وخبرتهم وأعمالهم السابقة.",
      "3. تواصل مباشرة مع اللي يناسبك عن طريق التطبيق.",
      "4. لو إنت صنايعي أو صاحب شركة، تقدر تعمل حساب مجاني وتضيف بروفايلك عشان الناس تلاقيك بسهولة.",
    ],
  },
  faq: {
    title: "الأسئلة الشائعة",
    body: [
      "س: هل التسجيل في الدليل الشامل مجاني؟\nج: أيوه، إنشاء حساب أساسي والبحث عن الصنايعية مجاني بالكامل.",
      "س: إزاي أقدر أثق في الصنايعي اللي هتواصل معاه؟\nج: كل بروفايل بيوضح التخصص وسنين الخبرة ومنطقة العمل، وتقدر كمان تشوف تقييمات المستخدمين التانيين لو موجودة.",
      "س: هل أقدر أسجّل شركتي على المنصة؟\nج: أيوه، الشركات والموردين برضو يقدروا يعملوا حساب ويضيفوا بروفايل كامل لخدماتهم.",
    ],
  },
  privacy: {
    title: "سياسة الخصوصية",
    body: [
      "بنحترم خصوصيتك ومحافظين على بياناتك. بنجمع بس المعلومات اللازمة لتشغيل الخدمة زي الاسم ورقم الموبايل والتخصص، ومش بنبيع أو نشارك بياناتك مع أي جهة تالتة من غير موافقتك.",
      "بياناتك متخزنة بشكل آمن عبر خدمات Google Firebase المعتمدة عالميًا في الحماية والتشفير.",
      "لو عايز تمسح حسابك أو بياناتك بشكل نهائي، تقدر تتواصل معانا وهنساعدك في ذلك.",
    ],
  },
  terms: {
    title: "الشروط والأحكام",
    body: [
      "باستخدامك لمنصة الدليل الشامل، إنت موافق على الشروط دي. المنصة وسيط بيربط بين طالبي الخدمة ومقدميها، ومش مسؤولة بشكل مباشر عن جودة الخدمة المقدمة من الصنايعي أو الشركة.",
      "ممنوع نشر محتوى مخالف أو مضلل أو انتحال هوية شخص أو شركة تانية على المنصة.",
      "بنحتفظ بحق تعليق أو حذف أي حساب بيخالف الشروط دي أو بيسيء استخدام المنصة.",
    ],
  },
};

const StaticPageScreen = ({ pageKey, onBack, darkMode }) => {
  const page = STATIC_PAGES_CONTENT[pageKey];
  if (!page) return null;
  const tc = darkMode ? "white" : "#0A1F44";
  return (
    <div style={{ minHeight: "100vh", background: darkMode ? "#0A1F44" : "#F7F5F0", padding: "20px 16px 60px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: tc, fontSize: 16, fontFamily: "'Cairo'", fontWeight: 700, cursor: "pointer", marginBottom: 18 }}>→ رجوع</button>
      <h1 style={{ fontFamily: "'Cairo'", fontWeight: 800, fontSize: 24, color: tc, marginBottom: 16 }}>{page.title}</h1>
      {page.body.map((paragraph, i) => (
        <p key={i} style={{ fontFamily: "'Cairo'", fontSize: 15, lineHeight: 1.9, color: darkMode ? "rgba(255,255,255,.85)" : "#333", marginBottom: 14, whiteSpace: "pre-line" }}>
          {paragraph}
        </p>
      ))}
    </div>
  );
};

// روابط تذييل الصفحة — بتظهر تحت الصفحة الرئيسية وبتخلي جوجل يلاقي طريقه لكل الصفحات الثابتة
const StaticPagesFooter = ({ darkMode }) => {
  const links = [
    { key: "about", label: "من نحن" },
    { key: "how-it-works", label: "كيف يعمل الدليل" },
    { key: "faq", label: "الأسئلة الشائعة" },
    { key: "privacy", label: "سياسة الخصوصية" },
    { key: "terms", label: "الشروط والأحكام" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, padding: "24px 16px 90px", opacity: 0.75 }}>
      {links.map((l) => (
        <a
          key={l.key}
          href={`/${l.key}`}
          onClick={(e) => { e.preventDefault(); navigateTo(`/${l.key}`); }}
          style={{ fontFamily: "'Cairo'", fontSize: 12.5, color: darkMode ? "rgba(255,255,255,.7)" : "#555", textDecoration: "none" }}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
};

// ============================================================
// SPECIALTY / GOVERNORATE LANDING PAGES
// صفحات SEO تلقائية لكل تخصص ومحافظة، زي /specialties/كهربائي أو /governorates/القاهرة
// بتستخدم نفس شاشة البحث (SearchScreen) لكن بعنوان H1 وBreadcrumb مخصصين للصفحة عشان جوجل
// يفهم إن دي صفحة مستقلة لتخصص/محافظة بعينها مش نتيجة بحث عامة
// ============================================================
const SpecialtyGovScreen = ({ mode, param, onMemberClick, onBack, darkMode }) => {
  const isDesktop = useIsDesktop();
  const tc = darkMode ? "white" : C.navy;
  // القيمة اللي بتوصلنا من الرابط بترجع بمسافات بدل الشرطات (عشان تطابق قيم Firestore الأصلية)
  const readableParam = param.replace(/-/g, " ");
  const title = mode === "specialty" ? `${readableParam} في مصر` : `صنايعية وشركات في ${readableParam}`;
  const filters = mode === "specialty" ? { specialty: readableParam } : { gov: readableParam };

  return (
    <div style={{ background: darkMode ? C.navyDeep : C.offWhite, minHeight: "100vh" }}>
      <div style={{ padding: "18px 16px 4px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: tc, fontSize: 15, fontFamily: "'Cairo'", fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>→ الرئيسية</button>
        <h1 style={{ fontFamily: "'Cairo'", fontWeight: 800, fontSize: 21, color: tc, margin: "0 0 4px" }}>{title}</h1>
        <p style={{ fontFamily: "'Cairo'", fontSize: 13, color: darkMode ? "rgba(255,255,255,.55)" : C.gray, margin: 0 }}>
          {mode === "specialty"
            ? `تصفح قائمة الصنايعية والشركات المتخصصين في ${readableParam} على الدليل الشامل`
            : `تصفح كل الصنايعية والشركات المسجلين في محافظة ${readableParam} على الدليل الشامل`}
        </p>
      </div>
      <SearchScreen initialFilters={filters} onMemberClick={onMemberClick} darkMode={darkMode} />
    </div>
  );
};


// ============================================================
// QUICK REQUEST MODAL — نافذة "اطلب صنايعي" العائمة
// المستخدم بيكتب المهنة اللي محتاجها ويختار المحافظة، وبنوديه على طول
// لنتايج البحث المفلترة على أساسهم
// ============================================================
const QuickRequestModal = ({ onClose, onSubmitted, darkMode, currentUser }) => {
  const [text, setText] = useState("");
  const [gov, setGov] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [submitting, setSubmitting] = useState(false);
  const bg = darkMode ? C.navy : C.white;
  const tc = darkMode ? "white" : C.navy;
  const inputBg = darkMode ? "rgba(255,255,255,.08)" : C.offWhite;

  const canSubmit = text.trim().length >= 5 && (currentUser?.phone || phone.trim().length >= 8) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await DB.postServiceRequest({
        text: text.trim(),
        gov,
        city: city.trim(),
        userId: currentUser?.uid,
        userName: currentUser?.name,
        phone: currentUser?.phone || phone.trim(),
      });
      // نبعت إشعار فوري للصنايعية المتوافقين مع الطلب، من غير ما نستنى استجابتهم
      // عشان الرسالة تظهر للمستخدم بسرعة حتى لو مفيش صنايعية متوافقين حاليًا
      DB.notifyMatchingCraftsmen({ text: text.trim(), gov }).catch(()=>{});
      onSubmitted?.();
    } catch (e) {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: bg, width: "100%", maxWidth: 500, borderRadius: "22px 22px 0 0", padding: "22px 20px calc(22px + env(safe-area-inset-bottom))", animation: "slideUp .25s ease-out", maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: darkMode ? "rgba(255,255,255,.25)" : C.grayLight, margin: "0 auto 16px" }} />
        <div style={{ fontFamily: "'Cairo'", fontWeight: 800, fontSize: 19, color: tc, marginBottom: 4, textAlign: "center" }}>🛠️ اطلب صنايعي</div>
        <div style={{ fontFamily: "'Cairo'", fontSize: 13, color: darkMode ? "rgba(255,255,255,.5)" : C.gray, marginBottom: 20, textAlign: "center" }}>قولّنا محتاج إيه بالظبط بكلامك، وهنشوفلك أنسب صنايعي</div>

        <label style={{ fontFamily: "'Cairo'", fontSize: 13, fontWeight: 700, color: tc, display: "block", marginBottom: 6 }}>محتاج إيه؟</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="مثال: عندي تسريب مياه في الحمام ومحتاج سباك يجي النهارده لو ينفع"
          rows={4}
          style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1px solid ${darkMode ? "rgba(255,255,255,.15)" : C.grayLight}`, background: inputBg, color: tc, fontFamily: "'Cairo'", fontSize: 14.5, marginBottom: 16, boxSizing: "border-box", resize: "vertical" }}
        />

        <label style={{ fontFamily: "'Cairo'", fontSize: 13, fontWeight: 700, color: tc, display: "block", marginBottom: 6 }}>المحافظة (اختياري)</label>
        <select
          value={gov}
          onChange={(e) => setGov(e.target.value)}
          style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1px solid ${darkMode ? "rgba(255,255,255,.15)" : C.grayLight}`, background: inputBg, color: tc, fontFamily: "'Cairo'", fontSize: 14.5, marginBottom: 16, boxSizing: "border-box" }}
        >
          <option value="">اختر المحافظة</option>
          {EGYPT_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        <label style={{ fontFamily: "'Cairo'", fontSize: 13, fontWeight: 700, color: tc, display: "block", marginBottom: 6 }}>المنطقة بالظبط (اختياري)</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="مثال: مدينة نصر، حي أول"
          style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1px solid ${darkMode ? "rgba(255,255,255,.15)" : C.grayLight}`, background: inputBg, color: tc, fontFamily: "'Cairo'", fontSize: 14.5, marginBottom: 16, boxSizing: "border-box" }}
        />

        {!currentUser?.phone && (
          <>
            <label style={{ fontFamily: "'Cairo'", fontSize: 13, fontWeight: 700, color: tc, display: "block", marginBottom: 6 }}>رقم موبايلك عشان نرجعلك</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              type="tel"
              style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: `1px solid ${darkMode ? "rgba(255,255,255,.15)" : C.grayLight}`, background: inputBg, color: tc, fontFamily: "'Cairo'", fontSize: 14.5, marginBottom: 22, boxSizing: "border-box" }}
            />
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: !canSubmit ? C.grayLight : `linear-gradient(135deg,${C.gold},${C.goldDark})`, color: !canSubmit ? C.gray : C.navyDeep, fontFamily: "'Cairo'", fontWeight: 800, fontSize: 16, cursor: !canSubmit ? "not-allowed" : "pointer", marginTop: currentUser?.phone ? 6 : 0 }}
        >
          {submitting ? <Spinner size={18} color={C.navyDeep} /> : "ابعت الطلب 🚀"}
        </button>
      </div>
    </div>
  );
};


// ============================================================
// MAIN APP
// ============================================================
function App() {
  const cfg = useConfig();
  const isDesktop = useIsDesktop();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchFilters, setSearchFilters] = useState({});
  const [showPayment, setShowPayment] = useState(false);
  const [showQuickRequest, setShowQuickRequest] = useState(false);
  const [savedUpdated, setSavedUpdated] = useState(0);
  const [user, setUser] = useState(() => {
    try { const s = localStorage.getItem("daleel_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  // لو المستخدم داخل بجلسة محفوظة من قبل (مش أول تسجيل دخول)، برضو نتأكد إن جهازه مسجل للإشعارات
  useEffect(() => { if (user?.uid) registerPushToken(user.uid); }, [user?.uid]);
  // استقبال الإشعار وهو التطبيق مفتوح فعليًا قدام المستخدم (foreground) — بيتعرض كـ toast
  // داخل التطبيق، عكس لما يكون التطبيق مقفول واللي بيتكفّل بالعرض هو الـ Service Worker
  useEffect(() => {
    let unsub;
    (async () => {
      const supported = await isMessagingSupported().catch(() => false);
      if (!supported) return;
      const messaging = getMessaging(app);
      unsub = onMessage(messaging, (payload) => {
        showToast(payload?.notification?.title || payload?.data?.title || "🔔 عندك إشعار جديد");
      });
    })();
    return () => unsub?.();
  }, []);
  // Show auth after splash if not logged in
  const [showAuth, setShowAuth] = useState(false);
  // لينك مشاركة البروفايل بقى بالشكل القابل للفهرسة: https://eldalel-elshamel.online/craftsmen/اسم-تخصص-مدينة-ID
  // ولسه بيدعم الرابط القديم ?member=ID عشان أي لينكات اتشاركت قبل كده تفضل شغالة
  // اللي بيفتحه لازم يشوف بروفايل الشخص ده على طول، مش الصفحة الرئيسية
  // نسجل زيارة جديدة مع كل مرة الصفحة تتفتح/تتحدث (Refresh)، من غير أي شرط
  useEffect(() => { DB.trackSiteVisit(); }, []);
  const [routeInfo, setRouteInfo] = useState(() => parseCurrentPath());
  // نتابع زرار رجوع/قدام المتصفح (وأي تنقل بنعمله إحنا بـ navigateTo) ونحدّث الـ state بتاعنا معاه
  useEffect(() => {
    const onPop = () => setRouteInfo(parseCurrentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const sharedMemberId = routeInfo.page === "member" ? routeInfo.id : null;
  useEffect(() => {
    if (!sharedMemberId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "members", sharedMemberId));
        if (snap.exists()) {
          setSelectedMember({ id: snap.id, ...snap.data() });
        } else {
          showToast("⚠️ هذا الملف الشخصي غير موجود أو تم حذفه");
          navigateTo("/", { replace: true });
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [sharedMemberId]);
  // كل ما البروفايل المفتوح يتغيّر، نحدّث عنوان الصفحة والـ Meta tags وSchema.org
  // ونبعت pageview يدوي لـ Google Analytics عشان يسجّل الزيارة دي كصفحة منفصلة
  useEffect(() => {
    if (selectedMember) {
      const memberPath = buildMemberPath(selectedMember);
      const memberTitle = `${selectedMember.name} - ${selectedMember.specialty || ""} ${selectedMember.city ? "في " + selectedMember.city : ""}`.trim();
      updateMetaTags({
        title: memberTitle,
        description: selectedMember.bio || `تواصل مع ${selectedMember.name}، ${selectedMember.specialty || "متخصص"} في ${selectedMember.city || "مصر"} على الدليل الشامل`,
        path: memberPath,
        image: selectedMember.avatar,
        type: "profile",
      });
      injectSchema(buildLocalBusinessSchema(selectedMember));
      trackPageView(memberPath, memberTitle);
    } else if (routeInfo.page === "static" && STATIC_PAGES_CONTENT[routeInfo.param]) {
      const page = STATIC_PAGES_CONTENT[routeInfo.param];
      updateMetaTags({ title: page.title, description: page.body[0]?.slice(0, 155), path: `/${routeInfo.param}` });
      injectSchema(null);
      trackPageView(`/${routeInfo.param}`, page.title);
    } else if (routeInfo.page === "specialty" || routeInfo.page === "governorate") {
      const readableParam = routeInfo.param.replace(/-/g, " ");
      const isSpecialty = routeInfo.page === "specialty";
      const pageTitle = isSpecialty ? `${readableParam} في مصر` : `صنايعية وشركات في ${readableParam}`;
      const path = `/${isSpecialty ? "specialties" : "governorates"}/${routeInfo.param}`;
      updateMetaTags({
        title: pageTitle,
        description: isSpecialty
          ? `ابحث عن أفضل ${readableParam} في مصر على الدليل الشامل`
          : `دليل الصنايعية والشركات في محافظة ${readableParam}`,
        path,
      });
      injectSchema(buildBreadcrumbSchema([
        { name: "الرئيسية", path: "/" },
        { name: isSpecialty ? "التخصصات" : "المحافظات", path: `/${isSpecialty ? "specialties" : "governorates"}` },
        { name: readableParam, path },
      ]));
      trackPageView(path, pageTitle);
    } else {
      updateMetaTags({ path: "/" });
      injectSchema(null);
      trackPageView("/", "الدليل الشامل");
    }
  }, [selectedMember, routeInfo]);
  const handleSplashDone = () => {
    setShowSplash(false);
    // لو داخل من لينك بروفايل مشارك، سيبه يشوفه على طول من غير ما نجبره يسجل دخول
    if (!user && !sharedMemberId) setShowAuth(true);
  };

  const showToast = (msg, type="success") => {
    setToast({message:msg,type});
    setTimeout(()=>setToast(null),3400);
  };

  const navigate = (tab, filters={}) => {
    setActiveTab(tab);
    setSearchFilters(filters);
    trackPageView(`/${tab === "home" ? "" : tab}`, tab); // تتبّع تنقل بين الأقسام الرئيسية للموقع
  };
  const handleMemberClick = (m) => {
    setSelectedMember(m);
    navigateTo(buildMemberPath(m)); // نحدّث رابط المتصفح فعليًا عشان يبقى قابل للفهرسة والمشاركة
  };
  const handleMemberBack = () => {
    setSelectedMember(null);
    navigateTo("/", { replace: true });
  };
  const handleLogin = async (u) => {
    setUser(u);
    setShowAuth(false);
    showToast("أهلاً بك! 👋");
    registerPushToken(u.uid); // نطلب إذن الإشعارات ونسجل الجهاز — بهدوء من غير ما يعطل حاجة لو فشل
    // Check if member has completed profile
    try {
      const snap = await getDoc(doc(db, "members", u.uid));
      if (!snap.exists() || !snap.data().specialty) {
        // New user - redirect to complete profile
        setTimeout(() => setActiveTab("profile"), 800);
      }
    } catch {}
  };
  const handleLogout = () => { DB.signOut(); localStorage.removeItem("daleel_user"); setUser(null); setActiveTab("home"); };
  const handleRegisterSuccess = () => { showToast("🎉 تم حفظ بياناتك بنجاح!"); setActiveTab("profile"); };
  const handlePaySuccess = (plan) => { setShowPayment(false); showToast(`✅ تم تفعيل اشتراك ${PLANS[plan].label} بنجاح!`); };

  const OWNER_WHATSAPP = cfg.whatsapp;

  const isAdmin = user && (
    user.isAdmin ||
    user.phone === cfg.adminPhone ||
    user.phone === (cfg.adminPhone||"").replace(/^0/,"2") ||
    user.phone === "2"+(cfg.adminPhone||"") ||
    user.email === (cfg.adminEmail||"admin@daleel.com")
  );
  const tabs = user ? [
    {id:"home", icon:"🏠", label:"الرئيسية"},
    {id:"search", icon:"🔍", label:"البحث"},
    {id:"saved", icon:"❤️", label:"المحفوظة"},
    {id:"jobs", icon:"💼", label:"الوظائف"},
    {id:"messages", icon:"💬", label:"رسائل"},
    {id:"profile", icon:"👤", label:"حسابي"},
    ...(isAdmin ? [{id:"admin", icon:"👑", label:"الإدارة"}] : []),
  ] : [
    {id:"home", icon:"🏠", label:"الرئيسية"},
    {id:"search", icon:"🔍", label:"البحث"},
    {id:"jobs", icon:"💼", label:"الوظائف"},
  ];

  const noAuth = (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",flexDirection:"column",gap:13,background:darkMode?C.navyDeep:C.offWhite,paddingBottom:80}}>
      <div style={{fontSize:50}}>🔒</div>
      <div style={{fontFamily:"'Cairo'",fontWeight:700,fontSize:17,color:darkMode?"white":C.navy}}>يجب تسجيل الدخول أولاً</div>
      <button className="btn btn-primary" onClick={()=>setShowAuth(true)}>تسجيل الدخول</button>
    </div>
  );

  return (
    <div style={{maxWidth:isDesktop?"none":500,margin:"0 auto",position:"relative",minHeight:"100vh"}}>
      <GlobalStyles/>

      {/* Splash */}
      {showSplash&&<SplashScreen onDone={handleSplashDone}/>}

      {/* Toast */}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}

      {/* Desktop Nav — بديل شريط التابات السفلي وأزرار التحكم العلوية على شاشات الكمبيوتر */}
      {isDesktop && !selectedMember && !showPayment && (
        <DesktopNavBar tabs={tabs} activeTab={activeTab} onNavigate={setActiveTab} user={user} onLogout={handleLogout} onShowAuth={()=>setShowAuth(true)} onShowPayment={()=>setShowPayment(true)} darkMode={darkMode} onToggleDark={()=>setDarkMode(p=>!p)}/>
      )}

      {/* Top Controls — بس جوه تطبيق الأندرويد (native)، على الويب (موبايل أو كمبيوتر) الأزرار دي جوه الـ DesktopNavBar */}
      {!isDesktop && (
      <div style={{position:"fixed",top:10,left:12,zIndex:1500,display:"flex",gap:7,alignItems:"center"}}>
        <div style={{background:"rgba(10,22,40,.82)",borderRadius:18,padding:"4px 9px",backdropFilter:"blur(12px)",border:`1px solid rgba(201,168,76,.2)`,display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:11}}>{darkMode?"🌙":"☀️"}</span>
          <div className={`toggle ${darkMode?"on":""}`} onClick={()=>setDarkMode(p=>!p)}/>
        </div>


        {user&&(
          <button onClick={handleLogout} style={{background:"rgba(239,68,68,.13)",border:`1px solid rgba(239,68,68,.28)`,borderRadius:11,padding:"6px 13px",color:"#EF4444",fontFamily:"'Cairo'",fontWeight:700,fontSize:11.5,cursor:"pointer"}}>خروج</button>
        )}
        {user&&(
          <button onClick={()=>setShowPayment(true)} style={{background:`rgba(201,168,76,.13)`,border:`1px solid rgba(201,168,76,.28)`,borderRadius:11,padding:"6px 9px",color:C.gold,fontSize:14,cursor:"pointer"}}>💳</button>
        )}

      </div>
      )}

      {/* Auth Overlay */}
      {showAuth&&(
        <div style={{position:"fixed",inset:0,zIndex:3000,maxWidth:500,margin:"0 auto"}}>
          <AuthScreen onLogin={handleLogin} darkMode={darkMode} onClose={()=>setShowAuth(false)}/>
          {user===null&&<button onClick={()=>setShowAuth(false)} style={{position:"absolute",top:12,left:14,background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,padding:"6px 11px",color:"white",cursor:"pointer",zIndex:1,fontSize:17,backdropFilter:"blur(10px)"}}>تصفح بدون تسجيل</button>}
        </div>
      )}

      {/* Payment Overlay */}
      {showPayment&&(
        <div style={{position:"fixed",inset:0,zIndex:2500,overflowY:"auto",maxWidth:500,margin:"0 auto"}}>
          <PaymentScreen onBack={()=>setShowPayment(false)} darkMode={darkMode} onSuccess={handlePaySuccess}/>
        </div>
      )}

      {/* Profile Overlay */}
      {selectedMember&&(
        <div style={{position:"fixed",inset:0,zIndex:2000,overflowY:"auto",maxWidth:isDesktop?900:500,margin:"0 auto"}}>
          <ProfileScreen member={selectedMember} onBack={handleMemberBack} darkMode={darkMode} currentUser={user} onRequireAuth={()=>setShowAuth(true)} onShowPayment={()=>setShowPayment(true)} onSaveUpdated={()=>setSavedUpdated(p=>p+1)}/>
        </div>
      )}

      {/* Static Pages Overlay (من نحن / FAQ / سياسات...) */}
      {!selectedMember && routeInfo.page === "static" && STATIC_PAGES_CONTENT[routeInfo.param] && (
        <div style={{position:"fixed",inset:0,zIndex:2000,overflowY:"auto",maxWidth:isDesktop?900:500,margin:"0 auto"}}>
          <StaticPageScreen pageKey={routeInfo.param} onBack={()=>navigateTo("/", {replace:true})} darkMode={darkMode}/>
        </div>
      )}

      {/* Specialty / Governorate Landing Pages (/specialties/كهربائي أو /governorates/القاهرة) */}
      {!selectedMember && (routeInfo.page === "specialty" || routeInfo.page === "governorate") && (
        <div style={{position:"fixed",inset:0,zIndex:2000,overflowY:"auto",maxWidth:isDesktop?900:500,margin:"0 auto"}}>
          <SpecialtyGovScreen mode={routeInfo.page} param={routeInfo.param} onMemberClick={handleMemberClick} onBack={()=>navigateTo("/", {replace:true})} darkMode={darkMode}/>
        </div>
      )}

      {/* Main Screens */}
      {!selectedMember&&!showPayment&&!(routeInfo.page === "static" && STATIC_PAGES_CONTENT[routeInfo.param])&&!(routeInfo.page === "specialty" || routeInfo.page === "governorate")&&(
        <>
          {activeTab==="home"&&<ErrorBoundary><HomeScreen onNavigate={navigate} onMemberClick={handleMemberClick} darkMode={darkMode} user={user} onRequireAuth={()=>setShowAuth(true)}/></ErrorBoundary>}
          {activeTab==="home"&&<StaticPagesFooter darkMode={darkMode}/>}
          <div className={isDesktop?"desktop-container":undefined} style={isDesktop?{paddingTop:22,paddingBottom:50}:undefined}>
            {activeTab==="search"&&<ErrorBoundary><SearchScreen initialFilters={searchFilters} onMemberClick={handleMemberClick} darkMode={darkMode}/></ErrorBoundary>}
            {activeTab==="saved"&&<ErrorBoundary><SavedScreen onMemberClick={handleMemberClick} darkMode={darkMode} currentUser={user} onRequireAuth={()=>setShowAuth(true)} refreshTrigger={savedUpdated}/></ErrorBoundary>}
            {activeTab==="jobs"&&<ErrorBoundary><JobsScreen darkMode={darkMode} currentUser={user} onRequireAuth={()=>setShowAuth(true)}/></ErrorBoundary>}
            {activeTab==="notifications"&&<ErrorBoundary><NotificationsScreen darkMode={darkMode} currentUser={user}/></ErrorBoundary>}
            {activeTab==="messages"&&<ErrorBoundary><DirectMessagesScreen darkMode={darkMode} currentUser={user}/></ErrorBoundary>}
            {activeTab==="profile"&&(user?<ErrorBoundary><MyProfileScreen onSuccess={handleRegisterSuccess} darkMode={darkMode} currentUser={user} onMemberClick={handleMemberClick} onShowPayment={()=>setShowPayment(true)}/></ErrorBoundary>:<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",flexDirection:"column",gap:13,background:darkMode?C.navyDeep:C.offWhite,paddingBottom:80}}><div style={{fontSize:50}}>🔒</div><div style={{fontFamily:"'Cairo'",fontWeight:700,fontSize:17,color:darkMode?"white":C.navy}}>سجّل دخولك أولاً</div><button className="btn btn-primary" onClick={()=>setShowAuth(true)}>دخول / تسجيل</button></div>)}
            {activeTab==="admin"&&<ErrorBoundary><AdminScreen darkMode={darkMode} currentUser={user}/></ErrorBoundary>}
          </div>
        </>
      )}

      {/* Bottom Tab Bar — بس جوه تطبيق الأندرويد (native)، على الويب بنستخدم الـ DesktopNavBar بدلها */}
      {!isDesktop && !selectedMember&&!showPayment&&(
        <div className="tab-bar">
          {tabs.map(tab=>(
            <div key={tab.id} className={`tab-item ${activeTab===tab.id?"active":""}`} onClick={()=>setActiveTab(tab.id)}>
              <div style={{position:"relative"}}>
                <span className="tab-icon">{tab.icon}</span>
                {(tab.badge||0)>0&&<div className="notif-badge">{tab.badge}</div>}
              </div>
              <span>{tab.label}</span>
            </div>
          ))}
          {!user&&(
            <div className="tab-item" onClick={()=>setShowAuth(true)} style={{color:C.gold}}>
              <span className="tab-icon">👤</span>
              <span>دخول / تسجيل</span>
            </div>
          )}
        </div>
      )}

      {/* Quick Request Modal — نافذة اطلب صنايعي */}
      {showQuickRequest && (
        <QuickRequestModal
          darkMode={darkMode}
          currentUser={user}
          onClose={() => setShowQuickRequest(false)}
          onSubmitted={() => {
            setShowQuickRequest(false);
            showToast("✅ تم إرسال طلبك بنجاح! هنتواصل معاك قريب");
          }}
        />
      )}

      {/* Floating Buttons */}
      {!selectedMember&&!showPayment&&(
        <div style={{position:"fixed",bottom:isDesktop?24:88,left:isDesktop?24:14,zIndex:999,display:"flex",flexDirection:"column",gap:10}}>
          {/* WhatsApp Button */}
          <div onClick={()=>window.open(`https://wa.me/${OWNER_WHATSAPP}?text=مرحباً، أريد الاستفسار عن الدليل الشامل`)} style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#25D366,#128C7E)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,cursor:"pointer",boxShadow:"0 4px 18px rgba(37,211,102,.45)",animation:"float 3s ease-in-out infinite",animationDelay:".5s"}}>
            💬
          </div>
        </div>
      )}

      {/* Quick Request Floating Button — على الجنب التاني عشان ميتعارضش مع زرار الواتساب */}
      {!selectedMember&&!showPayment&&!showQuickRequest&&(
        <div
          onClick={()=>setShowQuickRequest(true)}
          style={{
            position:"fixed", bottom:isDesktop?24:88, right:isDesktop?24:14, zIndex:999,
            display:"flex", alignItems:"center", gap:8,
            background:`linear-gradient(135deg,${C.gold},${C.goldDark})`,
            color:C.navyDeep, fontFamily:"'Cairo'", fontWeight:800, fontSize:14,
            padding:"13px 18px", borderRadius:30, cursor:"pointer",
            boxShadow:"0 6px 22px rgba(255,193,7,.5)",
            animation:"float 3s ease-in-out infinite",
          }}
        >
          <span style={{fontSize:19}}>🛠️</span>
          <span>اطلب صنايعي</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ROOT — ConfigProvider + ErrorBoundary يلفوا كل حاجة
// ============================================================
const AppWithProviders = () => (
  <ErrorBoundary>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </ErrorBoundary>
);
export { AppWithProviders as default };
