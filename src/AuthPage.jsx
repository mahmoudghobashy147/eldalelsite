import React, { useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signInWithCustomToken } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyA8Xrrp0N0CnDyI-0yvEYFVnh7HYCmH_PQ",
  authDomain: "eldalel-elshamel.firebaseapp.com",
  projectId: "eldalel-elshamel",
  storageBucket: "eldalel-elshamel.firebasestorage.app",
  messagingSenderId: "355717459859",
  appId: "1:355717459859:web:50ef5d6db4fe5a7425c266",
  measurementId: "G-P9BNJJSHVB"
};

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

const normalizePhone = value => String(value || "").replace(/\s+/g, "").replace(/^(\+2|2)/, "");
const phoneToEmail = phone => `${normalizePhone(phone)}@daleel.app`;

export default function AuthPage(){
  const [phone,setPhone]=useState("");
  const [pin,setPin]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const persistUser = async (cred, enteredPhone, isAdmin=false) => {
    let member = null;
    try {
      const snap = await getDoc(doc(db,"members",cred.user.uid));
      if (snap.exists()) member = snap.data();
    } catch {}
    const session = {
      uid: cred.user.uid,
      email: cred.user.email || phoneToEmail(enteredPhone),
      phone: member?.phone || enteredPhone,
      displayName: member?.name || cred.user.displayName || enteredPhone,
      ...(isAdmin || member?.isAdmin ? {isAdmin:true} : {})
    };
    localStorage.setItem("daleel_user", JSON.stringify(session));
  };

  const submit=async(e)=>{
    e.preventDefault();
    setError("");
    const cleanPhone = normalizePhone(phone);
    if(!cleanPhone || !pin){ setError("اكتب رقم الموبايل والرقم السري"); return; }
    if(!/^01\d{9}$/.test(cleanPhone)){ setError("اكتب رقم موبايل مصري صحيح مثل 01xxxxxxxxx"); return; }
    if(pin.length < 4){ setError("الرقم السري 4 أرقام على الأقل"); return; }

    setLoading(true);
    try{
      let cred;
      let adminLogin = false;

      try {
        const cfgSnap = await getDoc(doc(db,"config","appSettings"));
        const adminPhone = normalizePhone(cfgSnap.exists() ? cfgSnap.data()?.adminPhone : "");
        if (adminPhone && adminPhone === cleanPhone) {
          const secureLogin = httpsCallable(functions,"secureAdminLogin");
          const result = await secureLogin({phone:cleanPhone,pin});
          if (result?.data?.token) {
            cred = await signInWithCustomToken(auth,result.data.token);
            adminLogin = true;
          }
        }
      } catch {}

      if (!cred) {
        cred = await signInWithEmailAndPassword(auth,phoneToEmail(cleanPhone),pin);
      }

      await persistUser(cred,cleanPhone,adminLogin);
      window.location.replace("/");
    }catch(err){
      const code=err?.code||"";
      if(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found")) setError("رقم الموبايل أو الرقم السري غير صحيح");
      else if(code.includes("network-request-failed")) setError("تعذر الاتصال بالإنترنت. حاول مرة أخرى");
      else setError("تعذر تسجيل الدخول. راجع البيانات وحاول مرة أخرى");
    }finally{ setLoading(false); }
  };

  return <div className="auth-page" dir="rtl">
    <style>{styles}</style>
    <header className="auth-head"><button className="auth-brand" onClick={()=>window.location.href="/"}><span className="auth-logo">▥</span><span><b>الدليل الشامل</b><small>للصنايعية والتشطيبات والمقاولات</small></span></button><button className="back-home" onClick={()=>window.location.href="/"}>الصفحة الرئيسية</button></header>
    <main className="auth-main">
      <section className="auth-card">
        <div className="auth-title"><span>تسجيل الدخول</span><h1>أهلاً بيك في الدليل الشامل</h1><p>سجّل دخولك برقم الموبايل والرقم السري المسجلين في حسابك.</p></div>
        <form onSubmit={submit}>
          <label>رقم الموبايل<input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01xxxxxxxxx"/></label>
          <label>الرقم السري<input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="أدخل الرقم السري"/></label>
          {error&&<div className="auth-alert error">{error}</div>}
          <button className="auth-submit" disabled={loading}>{loading?"جاري الدخول...":"تسجيل الدخول"}</button>
        </form>
        <button className="forgot" type="button" onClick={()=>window.location.href="/register"}>ليس لديك حساب؟ أنشئ حسابًا</button>
      </section>
    </main>
  </div>;
}

const styles=`
.auth-page{min-height:100vh;background:#f7f3eb;color:#10283d;font-family:'Cairo',sans-serif}.auth-head{height:82px;background:linear-gradient(135deg,#06243b,#0b3554);display:flex;align-items:center;justify-content:space-between;padding:0 max(20px,calc((100vw - 1180px)/2));border-bottom:1px solid rgba(215,170,67,.45)}.auth-brand{display:flex;align-items:center;gap:11px;border:0;background:transparent;color:#fff;cursor:pointer;text-align:right}.auth-logo{width:48px;height:48px;border:1px solid rgba(240,207,122,.65);border-radius:14px;display:grid;place-items:center;color:#f0cf7a;font-size:27px}.auth-brand b{display:block;color:#f0cf7a;font-size:22px;line-height:1.1}.auth-brand small{display:block;color:rgba(255,255,255,.68);font-size:10px;margin-top:5px}.back-home{border:1px solid rgba(240,207,122,.65);background:rgba(255,255,255,.04);color:#fff;border-radius:11px;padding:10px 16px;font-weight:800;cursor:pointer}.auth-main{min-height:calc(100vh - 82px);display:grid;place-items:center;padding:32px 18px}.auth-card{width:min(100%,470px);background:#fff;border:1px solid #e8e2d7;border-radius:24px;padding:30px;box-shadow:0 18px 50px rgba(6,36,59,.11)}.auth-title>span{display:inline-block;background:#fbf4df;border:1px solid #efdfaa;color:#8f6a1c;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:900}.auth-title h1{font-size:26px;color:#06243b;margin:12px 0 6px}.auth-title p{margin:0 0 22px;color:#71808b;font-size:13px;line-height:1.8}.auth-card form{display:grid;gap:14px}.auth-card label{font-size:12px;font-weight:800;color:#18364c}.auth-card input{display:block;width:100%;height:50px;margin-top:7px;border:1px solid #dfe4e8;border-radius:12px;padding:0 14px;font-size:15px;direction:ltr;text-align:right}.auth-submit{height:50px;border:0;border-radius:12px;background:linear-gradient(135deg,#d7aa43,#f0cf7a);color:#06243b;font-size:15px;font-weight:900;cursor:pointer}.auth-alert{border-radius:10px;padding:10px 12px;font-size:12px}.auth-alert.error{background:#fff1f1;color:#a52b2b;border:1px solid #f3cccc}.forgot{width:100%;margin-top:13px;border:0;background:transparent;color:#8b681e;font-weight:800;cursor:pointer;padding:9px}.auth-submit:disabled{opacity:.65;cursor:wait}@media(max-width:600px){.auth-head{height:72px;padding:0 14px}.auth-brand small{display:none}.auth-brand b{font-size:19px}.auth-logo{width:42px;height:42px}.back-home{padding:8px 10px;font-size:11px}.auth-main{min-height:calc(100vh - 72px);padding:20px 12px;align-items:start}.auth-card{margin-top:26px;border-radius:20px;padding:22px 17px}.auth-title h1{font-size:22px}}
`;