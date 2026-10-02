import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";

// ============================================================
// استرجاع المسار الأصلي بعد التحويل من صفحة 404.html
// ============================================================
// لو المستخدم فتح رابط زي /craftsmen/ahmed-xyz مباشرة، GitHub Pages بيرجّعله
// 404.html اللي بيحفظ المسار الأصلي في sessionStorage وبيحوّله لرابط "/"
// النضيف. لازم نرجّع المسار ده لشريط العنوان *هنا* في index.js (مش في
// public/index.html) لأنه هنا بيتنفذ بعد ما ملف main.js يكون خلص تحميله
// بنجاح بالفعل — لو رجّعناه قبل كده في <head>، المتصفح كان هيحسب مسار
// main.js نفسه بشكل غلط (نسبي للمسار الجديد بدل الجذر) ويفشل تحميله.
(function restoreDeepLinkPath() {
  try {
    const redirect = sessionStorage.getItem("daleel_redirect_path");
    if (redirect) {
      sessionStorage.removeItem("daleel_redirect_path");
      window.history.replaceState(null, "", redirect);
    }
  } catch (e) {
    // sessionStorage ممكن يكون معطّل في بعض المتصفحات/الأوضاع الخاصة، تجاهل بأمان
  }
})();

const rootElement = document.getElementById("root");

// ============================================================
// دعم react-snap
// ============================================================
if (rootElement && rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <App />);
} else {
  createRoot(rootElement).render(<App />);
}

// Hotfix منفصل لا يغيّر أي تصميم: لو Firebase Storage ممتلئ،
// المنشور النصي يظل قابلًا للنشر بدل فشل العملية كلها.
setTimeout(() => {
  import("./post-storage-hotfix").catch((e) => console.warn("post hotfix load failed", e));
}, 0);
