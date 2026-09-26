import React, { useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

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

export default function AuthPage(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const submit=async(e)=>{
    e.preventDefault();
    setError(""); setMessage("");
    if(!email.trim()||!password){ setError("اكتب البريد الإلكتروني وكلمة المرور"); return; }
    setLoading(true);
    try{
      await signInWithEmailAndPassword(auth,email.trim(),password);
      window.location.replace("/");
    }catch(err){
      const code=err?.code||"";
      setError(code.includes("invalid-credential")||code.includes("wrong-password")?"بيانات الدخول غير صحيحة":"تعذر تسجيل الدخول. راجع البيانات وحاول مرة أخرى");
    }finally{ setLoading(false); }
  };

  const reset=async()=>{
    setError(""); setMessage("");
    if(!email.trim()){ setError("اكتب البريد الإلكتروني الأول"); return; }
    try{ await sendPasswordResetEmail(auth,email.trim()); setMessage("تم إرسال رابط استعادة كلمة المرور"); }
    catch{ setError("تعذر إرسال رابط الاستعادة لهذا البريد"); }
  };

  return <div className="auth-page" dir="rtl">
    <style>{styles}</style>
    <header className="auth-head"><button className="auth-brand" onClick={()=>window.location.href="/"}><span className="auth-logo">▥</span><span><b>الدليل الشامل</b><small>للصنايعية والتشطيبات والمقاولات</small></span></button><button className="back-home" onClick={()=>window.location.href="/"}>الصفحة الرئيسية</button></header>
    <main className="auth-main">
      <section className="auth-card">
        <div className="auth-title"><span>تسجيل الدخول</span><h1>أهلاً بيك في الدليل الشامل</h1><p>ادخل لحسابك من هنا فقط بدون فتح الصفحة القديمة أو أي أقسام إضافية.</p></div>
        <form onSubmit={submit}>
          <label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com"/></label>
          <label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
          {error&&<div className="auth-alert error">{error}</div>}
          {message&&<div className="auth-alert ok">{message}</div>}
          <button className="auth-submit" disabled={loading}>{loading?"جاري الدخول...":"تسجيل الدخول"}</button>
        </form>
        <button className="forgot" onClick={reset}>نسيت كلمة المرور؟</button>
      </section>
    </main>
  </div>;
}

const styles=`
.auth-page{min-height:100vh;background:#f7f3eb;color:#10283d;font-family:'Cairo',sans-serif}.auth-head{height:82px;background:linear-gradient(135deg,#06243b,#0b3554);display:flex;align-items:center;justify-content:space-between;padding:0 max(20px,calc((100vw - 1180px)/2));border-bottom:1px solid rgba(215,170,67,.45)}.auth-brand{display:flex;align-items:center;gap:11px;border:0;background:transparent;color:#fff;cursor:pointer;text-align:right}.auth-logo{width:48px;height:48px;border:1px solid rgba(240,207,122,.65);border-radius:14px;display:grid;place-items:center;color:#f0cf7a;font-size:27px}.auth-brand b{display:block;color:#f0cf7a;font-size:22px;line-height:1.1}.auth-brand small{display:block;color:rgba(255,255,255,.68);font-size:10px;margin-top:5px}.back-home{border:1px solid rgba(240,207,122,.65);background:rgba(255,255,255,.04);color:#fff;border-radius:11px;padding:10px 16px;font-weight:800;cursor:pointer}.auth-main{min-height:calc(100vh - 82px);display:grid;place-items:center;padding:32px 18px}.auth-card{width:min(100%,470px);background:#fff;border:1px solid #e8e2d7;border-radius:24px;padding:30px;box-shadow:0 18px 50px rgba(6,36,59,.11)}.auth-title>span{display:inline-block;background:#fbf4df;border:1px solid #efdfaa;color:#8f6a1c;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:900}.auth-title h1{font-size:26px;color:#06243b;margin:12px 0 6px}.auth-title p{margin:0 0 22px;color:#71808b;font-size:13px;line-height:1.8}.auth-card form{display:grid;gap:14px}.auth-card label{font-size:12px;font-weight:800;color:#18364c}.auth-card input{display:block;width:100%;height:50px;margin-top:7px;border:1px solid #dfe4e8;border-radius:12px;padding:0 14px;font-size:15px}.auth-submit{height:50px;border:0;border-radius:12px;background:linear-gradient(135deg,#d7aa43,#f0cf7a);color:#06243b;font-size:15px;font-weight:900;cursor:pointer}.auth-alert{border-radius:10px;padding:10px 12px;font-size:12px}.auth-alert.error{background:#fff1f1;color:#a52b2b;border:1px solid #f3cccc}.auth-alert.ok{background:#effaf3;color:#1e7a43;border:1px solid #cfead9}.forgot{width:100%;margin-top:13px;border:0;background:transparent;color:#8b681e;font-weight:800;cursor:pointer;padding:9px}.auth-submit:disabled{opacity:.65;cursor:wait}@media(max-width:600px){.auth-head{height:72px;padding:0 14px}.auth-brand small{display:none}.auth-brand b{font-size:19px}.auth-logo{width:42px;height:42px}.back-home{padding:8px 10px;font-size:11px}.auth-main{min-height:calc(100vh - 72px);padding:20px 12px;align-items:start}.auth-card{margin-top:26px;border-radius:20px;padding:22px 17px}.auth-title h1{font-size:22px}}
`;
