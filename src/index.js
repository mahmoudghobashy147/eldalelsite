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

// توحيد الموقع على مسارات واضحة ومنع فتح الواجهة القديمة عبر ?app=1.
(function normalizeLegacyNavigation() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("app") !== "1") return;
    const legacyHash = (url.hash || "").replace(/^#/, "").toLowerCase();
    const map = {
      login: "/login",
      signin: "/login",
      register: "/register",
      notifications: "/notifications",
      suppliers: "/suppliers",
      posts: "/#feed",
      menu: "/#sections"
    };
    const target = map[legacyHash] || "/";
    window.history.replaceState(null, "", target);
  } catch (e) {}
})();

const rootElement = document.getElementById("root");
const path = window.location.pathname.replace(/\/+$/, "") || "/";

const loading = <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f7f3eb",color:"#06243b",fontFamily:"Cairo, sans-serif",fontWeight:800}}>جاري التحميل...</div>;

let view;
if (path === "/") {
  view = <HomeLanding />;
} else if (path === "/login" || path === "/signin") {
  // صفحة دخول مستقلة وخفيفة؛ التطبيق الكبير لا يتم تحميله هنا.
  view = <AuthPage />;
} else {
  // باقي الصفحات الوظيفية تُحمّل عند الحاجة فقط لتقليل زمن وحجم التحميل الأول.
  view = <Suspense fallback={loading}><App /></Suspense>;
}

if (rootElement && rootElement.hasChildNodes() && path !== "/" && path !== "/login" && path !== "/signin") {
  hydrateRoot(rootElement, view);
} else {
  if (rootElement) rootElement.innerHTML = "";
  createRoot(rootElement).render(view);
}
