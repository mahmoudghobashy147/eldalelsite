import React, { Suspense, lazy } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import HomeLanding from "./HomeLanding";
import AuthPage from "./AuthPage";
import "./global-polish.css";

const App = lazy(() => import("./App"));

(function restoreDeepLinkPath() {
  try {
    const redirect = sessionStorage.getItem("daleel_redirect_path");
    if (redirect) {
      sessionStorage.removeItem("daleel_redirect_path");
      window.history.replaceState(null, "", redirect);
    }
  } catch (e) {}
})();

const rootElement = document.getElementById("root");
const path = window.location.pathname.replace(/\/+$/, "") || "/";

const loading = <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f7f3eb",color:"#06243b",fontFamily:"Cairo, sans-serif",fontWeight:800}}>جاري التحميل...</div>;

let view;
if (path === "/") {
  // مسار رئيسي واحد فقط: لا يوجد وضع قديم بـ ?app=1 بعد الآن.
  view = <HomeLanding />;
} else if (path === "/login" || path === "/signin") {
  // صفحة دخول مستقلة وخفيفة لا تحمل التطبيق القديم بالكامل.
  view = <AuthPage />;
} else {
  // الصفحات الوظيفية القديمة تُحمّل فقط عند الحاجة لتقليل حجم الصفحة الرئيسية.
  view = <Suspense fallback={loading}><App /></Suspense>;
}

if (rootElement && rootElement.hasChildNodes() && path !== "/" && path !== "/login" && path !== "/signin") {
  hydrateRoot(rootElement, view);
} else {
  if (rootElement) rootElement.innerHTML = "";
  createRoot(rootElement).render(view);
}
