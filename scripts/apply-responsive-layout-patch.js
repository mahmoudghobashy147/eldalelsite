const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let src = fs.readFileSync(appPath, 'utf8');

const oldBlock = `// بيحدد شكل الواجهة اللي هيظهر: تصميم \"التطبيق المضغوط\" (شريط تابات تحت + شاشات عمود واحد)
// بيفضل مخصوص بس لما البرنامج شغال جوه تطبيق الأندرويد الحقيقي (Capacitor). أي زيارة من متصفح — سواء
// من موبايل أو تابلت أو كمبيوتر — بتاخد نفس تصميم الموقع (نافبار فوق + شبكات وأقسام)، وده بيتظبط
// تلقائيًا بالحجم المناسب لكل شاشة عن طريق الـ CSS، بدل ما يتحول لتصميم تاني تمامًا لما الشاشة تصغر.
// Capacitor بيحقن window.Capacitor جوه التطبيق بس، فمش موجود خالص لما حد يفتح الموقع من متصفح عادي.
const useIsDesktop = () => {
  const [webLayout] = useState(() => {
    if (typeof window === \"undefined\") return true;
    const isNativeApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === \"function\" && window.Capacitor.isNativePlatform());
    return !isNativeApp;
  });
  return webLayout;
};`;

const newBlock = `// Responsive layout: mobile browsers get the compact mobile UI, while wide screens get desktop UI.
// This fixes the old behavior where every browser visit was treated as desktop regardless of screen width.
const DESKTOP_BREAKPOINT = 900;
const useIsDesktop = () => {
  const getIsDesktop = useCallback(() => {
    if (typeof window === \"undefined\") return true;
    const isNativeApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === \"function\" && window.Capacitor.isNativePlatform());
    if (isNativeApp) return false;
    return window.matchMedia(\`(min-width: \${DESKTOP_BREAKPOINT}px)\`).matches;
  }, []);

  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    if (typeof window === \"undefined\") return undefined;
    const mq = window.matchMedia(\`(min-width: \${DESKTOP_BREAKPOINT}px)\`);
    const updateLayout = () => setIsDesktop(getIsDesktop());
    updateLayout();
    if (mq.addEventListener) mq.addEventListener(\"change\", updateLayout);
    else mq.addListener(updateLayout);
    window.addEventListener(\"orientationchange\", updateLayout);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener(\"change\", updateLayout);
      else mq.removeListener(updateLayout);
      window.removeEventListener(\"orientationchange\", updateLayout);
    };
  }, [getIsDesktop]);

  return isDesktop;
};`;

if (src.includes(newBlock)) {
  console.log('responsive layout patch already applied');
  process.exit(0);
}

if (!src.includes(oldBlock)) {
  throw new Error('Could not find the old useIsDesktop block. Refusing to patch blindly.');
}

src = src.replace(oldBlock, newBlock);
fs.writeFileSync(appPath, src);
console.log('responsive layout patch applied');
