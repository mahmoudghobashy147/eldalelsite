const FALLBACK_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
  <rect width="800" height="520" fill="#f3efe6"/>
  <rect x="24" y="24" width="752" height="472" rx="28" fill="#ffffff" stroke="#e3dac7" stroke-width="3"/>
  <g fill="none" stroke="#0b3554" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    <rect x="286" y="140" width="228" height="170" rx="20"/>
    <circle cx="355" cy="199" r="24"/>
    <path d="M306 286l62-65 43 41 36-34 47 58"/>
  </g>
  <text x="400" y="382" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#0b3554">الصورة غير متاحة</text>
  <text x="400" y="426" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#7d8790">الدليل الشامل</text>
</svg>`)}`;

const isFirebaseMedia = (src = "") =>
  /firebasestorage\.googleapis\.com|storage\.googleapis\.com|firebasestorage\.app/i.test(src);

// Keep deleted/expired Firebase images from rendering as broken empty boxes.
// This is display-only and does not change any existing layout or data.
document.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.daleelFallback === "1") return;

    const src = img.currentSrc || img.src || "";
    if (!isFirebaseMedia(src)) return;

    img.dataset.daleelFallback = "1";
    img.removeAttribute("srcset");
    img.src = FALLBACK_SVG;
    img.alt = img.alt || "الصورة غير متاحة";
    img.style.background = "#f3efe6";
    img.style.objectFit = "cover";
  },
  true
);
