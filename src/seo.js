// ============================================================
// src/seo.js
// أدوات السيو: روابط قابلة للفهرسة + Meta tags ديناميكية + Schema.org
// ============================================================

export const SITE_URL = "https://eldalel-elshamel.online";
export const SITE_NAME = "الدليل الشامل";
export const DEFAULT_DESCRIPTION = "الدليل الشامل - دليلك في عالم المقاولات والتشطيبات والعقارات، ابحث عن أفضل الصنايعية والفنيين والشركات والموردين في مصر";
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`; // حط صورة مناسبة بمقاس 1200x630 في public/

// --- توليد slug عربي/إنجليزي آمن للروابط ---
// بيحول النص لحروف صغيرة، يشيل الرموز الغريبة، ويستبدل المسافات بشرطة
// بيدعم العربي والإنجليزي مع بعض
export function slugify(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "") // شيل أي رمز مش عربي/إنجليزي/رقم
    .replace(/\s+/g, "-") // المسافات تبقى شرطة
    .replace(/-+/g, "-") // شرطات متكررة تبقى واحدة
    .replace(/^-+|-+$/g, ""); // شيل الشرطة من البداية والنهاية
}

// --- بناء رابط قابل للفهرسة لصنايعي/شركة ---
// الشكل: /craftsmen/{اسم-وصفي}-{ID الحقيقي}
// بنحط الـ ID الحقيقي في الآخر عشان نقدر نرجعله ونجيب بياناته من Firestore مباشرة
// من غير ما نحتاج نضيف حقل slug جديد لكل مستند موجود بالفعل
export function buildMemberPath(member) {
  if (!member?.id) return "/";
  const type = member.type === "company" ? "companies" : "craftsmen";
  const parts = [member.name, member.specialty || member.category, member.city || member.governorate]
    .filter(Boolean)
    .map(slugify)
    .filter(Boolean);
  const descriptive = parts.join("-") || "profile";
  return `/${type}/${descriptive}-${member.id}`;
}

export function buildMemberUrl(member) {
  return `${SITE_URL}${buildMemberPath(member)}`;
}

// --- استخراج الـ ID الحقيقي من آخر الرابط ---
// معرّفات Firestore التلقائية (auto-id) دايماً من حروف/أرقام من غير شرطة "-"،
// فآخر جزء بعد آخر شرطة في الرابط هو الـ ID دايماً بشكل مضمون
export function extractIdFromSlug(slugSegment) {
  if (!slugSegment) return null;
  const lastDash = slugSegment.lastIndexOf("-");
  if (lastDash === -1) return slugSegment; // مفيش وصف، الرابط كله ID
  return slugSegment.substring(lastDash + 1);
}

// --- تحليل مسار الصفحة الحالي لمعرفة إيه اللي المفروض يتعرض ---
// بيرجع { page: "member"|"specialty"|"governorate"|"home"|"static", id, param }
export function parseCurrentPath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) return { page: "home" };

  if ((segments[0] === "craftsmen" || segments[0] === "companies") && segments[1]) {
    return { page: "member", id: extractIdFromSlug(segments[1]), memberType: segments[0] };
  }
  if (segments[0] === "specialties" && segments[1]) {
    return { page: "specialty", param: decodeURIComponent(segments[1]) };
  }
  if (segments[0] === "governorates" && segments[1]) {
    return { page: "governorate", param: decodeURIComponent(segments[1]) };
  }
  const staticPages = ["about", "how-it-works", "faq", "privacy", "terms", "craftsmen", "companies"];
  if (staticPages.includes(segments[0]) && !segments[1]) {
    return { page: "static", param: segments[0] };
  }

  // فولباك: دعم الرابط القديم ?member=ID لحد ما كل الروابط القديمة المشاركة تتجدد لوحدها
  const qsMember = new URLSearchParams(window.location.search).get("member");
  if (qsMember) return { page: "member", id: qsMember, memberType: "craftsmen" };

  return { page: "home" };
}

// --- تنقل بدون إعادة تحميل الصفحة (زي react-router بس بدون المكتبة) ---
export function navigateTo(path, { replace = false } = {}) {
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  // نبعت حدث يدوي عشان الكومبوننتات اللي مستنية تتغيير المسار تعرف تتحدث
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// --- تحديث الـ Meta Tags ديناميكياً (Title, Description, Canonical, Open Graph) ---
export function updateMetaTags({ title, description, path, image, type = "website" } = {}) {
  const finalTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - دليلك في عالم المقاولات والتشطيبات والعقارات`;
  const finalDescription = description || DEFAULT_DESCRIPTION;
  const finalUrl = `${SITE_URL}${path || window.location.pathname}`;
  const finalImage = image || DEFAULT_IMAGE;

  document.title = finalTitle;

  setMetaTag("name", "description", finalDescription);
  setMetaTag("property", "og:title", finalTitle);
  setMetaTag("property", "og:description", finalDescription);
  setMetaTag("property", "og:url", finalUrl);
  setMetaTag("property", "og:image", finalImage);
  setMetaTag("property", "og:type", type);
  setMetaTag("property", "og:site_name", SITE_NAME);
  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", finalTitle);
  setMetaTag("name", "twitter:description", finalDescription);
  setMetaTag("name", "twitter:image", finalImage);

  setCanonical(finalUrl);
}

function setMetaTag(attrName, attrValue, content) {
  let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

// --- تتبّع تغيير الصفحة يدويًا لـ Google Analytics 4 ---
// لازم نعمل ده لأن الموقع SPA (صفحة واحدة بترندر كل حاجة)، فـ gtag.js
// بيسجل زيارة أول تحميل بس تلقائيًا، وأي تنقل بعد كده (فتح بروفايل، تخصص، إلخ)
// لازم نبعته يدويًا وإلا GA4 هيفتكر إن الزائر فتح صفحة واحدة بس طول الوقت
export function trackPageView(path, title) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: `${SITE_URL}${path}`,
      page_title: title,
    });
  }
}

// --- حقن Schema.org JSON-LD جوه <head> ---
// بيمسح أي schema قديم متحقن قبل كده وبيحط الجديد بدله (لازم نعمل كده عند كل تغيير صفحة)
export function injectSchema(schemaObject) {
  const existing = document.getElementById("dynamic-schema");
  if (existing) existing.remove();
  if (!schemaObject) return;
  const script = document.createElement("script");
  script.id = "dynamic-schema";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schemaObject);
  document.head.appendChild(script);
}

// --- بناء Schema لصفحة صنايعي/شركة (LocalBusiness) ---
// بيستخدم بس البيانات الموجودة فعلاً، من غير ما يخترع تقييمات أو معلومات وهمية
export function buildLocalBusinessSchema(member) {
  if (!member) return null;
  const schema = {
    "@context": "https://schema.org",
    "@type": member.type === "company" ? "Organization" : "LocalBusiness",
    name: member.name,
    url: buildMemberUrl(member),
    description: member.bio || member.about || `${member.name} - ${member.specialty || ""} في ${member.city || "مصر"}`,
  };
  if (member.avatar) schema.image = member.avatar;
  if (member.phone) schema.telephone = member.phone;
  if (member.city || member.governorate) {
    schema.address = {
      "@type": "PostalAddress",
      addressLocality: member.city || "",
      addressRegion: member.governorate || "",
      addressCountry: "EG",
    };
  }
  if (member.specialty) schema.knowsAbout = member.specialty;
  // نضيف التقييم بس لو فعلاً موجود عدد مراجعات حقيقي أكبر من صفر
  if (member.rating && member.reviews > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: member.rating,
      reviewCount: member.reviews,
    };
  }
  return schema;
}

// --- بناء Schema لمسار التنقل (Breadcrumbs) ---
// items: [{ name: "الرئيسية", path: "/" }, { name: "كهربائيين", path: "/specialties/كهربائي" }, ...]
export function buildBreadcrumbSchema(items) {
  if (!items?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
