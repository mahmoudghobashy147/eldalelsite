import { getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getFirestore } from "firebase/firestore";

// Hotfix: Firebase Storage quota must never block publishing the text itself.
// The existing UI still tries media upload normally. If Storage returns quota-exceeded,
// this fallback saves the text-only post to Firestore and refreshes the feed.
const POST_TEXT_SELECTOR = 'textarea[placeholder*="شارك خبرتك"]';
let lastPostText = "";
let fallbackInFlight = false;

const getServices = () => {
  const app = getApps()[0];
  if (!app) return null;
  return { auth: getAuth(app), db: getFirestore(app) };
};

const capturePostText = () => {
  const el = document.querySelector(POST_TEXT_SELECTOR);
  const value = String(el?.value || "").trim();
  if (value) lastPostText = value;
};

document.addEventListener("input", (event) => {
  if (event.target?.matches?.(POST_TEXT_SELECTOR)) capturePostText();
}, true);

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("button");
  if (button && /نشر/.test(String(button.textContent || ""))) capturePostText();
}, true);

const originalAlert = window.alert.bind(window);
window.alert = (message) => {
  const text = String(message || "");
  const storageQuotaError = /حدث خطأ أثناء النشر/i.test(text)
    && /(quota|storage|exceeded|firebase storage)/i.test(text);

  if (!storageQuotaError || fallbackInFlight) {
    originalAlert(message);
    return;
  }

  const services = getServices();
  const user = services?.auth?.currentUser;
  const postText = String(document.querySelector(POST_TEXT_SELECTOR)?.value || lastPostText || "").trim();

  if (!services || !user || !postText) {
    originalAlert(message);
    return;
  }

  fallbackInFlight = true;
  (async () => {
    try {
      let memberInfo = null;
      try {
        const memberSnap = await getDoc(doc(services.db, "members", user.uid));
        if (memberSnap.exists()) memberInfo = memberSnap.data();
      } catch (_) {}

      const now = new Date();
      const authorName = memberInfo?.name || user.displayName || "مستخدم";
      await addDoc(collection(services.db, "posts"), {
        authorId: user.uid,
        author: authorName,
        avatar: String(authorName || "م").charAt(0) || "م",
        specialty: memberInfo?.specialty || "عضو",
        time: now,
        createdAt: now,
        content: postText,
        likes: 0,
        likedBy: [],
        comments: 0,
        shares: 0,
        type: memberInfo?.type || memberInfo?.memberType || "craftsman",
        images: [],
        video: null,
        mediaUploadSkipped: true,
      });

      originalAlert("✅ تم نشر المنشور بنجاح بدون صورة مؤقتًا لأن مساحة Firebase Storage ممتلئة.");
      setTimeout(() => window.location.reload(), 450);
    } catch (err) {
      console.error("post storage fallback failed:", err);
      originalAlert("❌ تعذر رفع الصورة وتعذر نشر النص أيضًا: " + (err?.message || err));
    } finally {
      fallbackInFlight = false;
    }
  })();
};
