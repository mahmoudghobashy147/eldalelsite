const fs = require('fs');

const file = 'src/App.jsx';
let src = fs.readFileSync(file, 'utf8');
let changed = false;

const marker = 'MOBILE_BOOT_FAILSAFE_V1';

if (!src.includes(marker)) {
  const splashPattern = /const SplashScreen = \(\{ onDone \}\) => \{\s*const \[fade, setFade\] = useState\(false\);\s*useEffect\(\(\) => \{\s*const t1 = setTimeout\(\(\) => setFade\(true\), 2500\);\s*const t2 = setTimeout\(\(\) => onDone\(\), 3000\);\s*return \(\) => \{ clearTimeout\(t1\); clearTimeout\(t2\); \};\s*\}, \[onDone\]\);/;
  const splashReplacement = `const SplashScreen = ({ onDone }) => {\n  // MOBILE_BOOT_FAILSAFE_V1 — avoid Android/Brave compositor getting stuck on a faded fixed layer.\n  useEffect(() => {\n    const t = setTimeout(() => onDone(), 2200);\n    return () => clearTimeout(t);\n  }, [onDone]);`;

  if (!splashPattern.test(src)) {
    console.error('Could not locate the expected SplashScreen timing block');
    process.exit(1);
  }
  src = src.replace(splashPattern, splashReplacement);

  const fadeStylePattern = /\s*opacity:\s*fade\s*\?\s*0\s*:\s*1,\s*\n\s*transition:\s*["']opacity 0\.5s ease["'],?/;
  if (!fadeStylePattern.test(src)) {
    console.error('Could not locate the expected splash opacity transition');
    process.exit(1);
  }
  src = src.replace(fadeStylePattern, '');

  const appSplashState = '  const [showSplash, setShowSplash] = useState(true);';
  const appFailsafe = `${appSplashState}\n  // Independent fallback: even if the splash child timer is throttled, never leave the app covered.\n  useEffect(() => {\n    const splashFailsafe = setTimeout(() => setShowSplash(false), 2600);\n    return () => clearTimeout(splashFailsafe);\n  }, []);`;
  if (!src.includes(appSplashState)) {
    console.error('Could not locate App showSplash state');
    process.exit(1);
  }
  src = src.replace(appSplashState, appFailsafe);
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, src);
  console.log('✓ applied mobile boot/splash failsafe');
} else {
  console.log('✓ mobile boot/splash failsafe already applied');
}
