import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root");

// ============================================================
// دعم react-snap: لو الصفحة جاية من نسخة HTML مُجهّزة مسبقًا (فيها محتوى فعلي
// جوه #root وليست فاضية)، نستخدم hydrateRoot بدل createRoot، عشان React
// "يتبنى" الـ HTML الموجود بدل ما يمسحه ويعيد بناءه من الصفر. ده اللي بيخلي
// المحتوى ظاهر فورًا لمحركات البحث والبوتات قبل ما الجافاسكريبت حتى يشتغل.
// ============================================================
if (rootElement && rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <App />);
} else {
  createRoot(rootElement).render(<App />);
}
