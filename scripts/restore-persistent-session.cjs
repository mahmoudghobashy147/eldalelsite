const fs = require("node:fs");
const path = "src/App.jsx";
let source = fs.readFileSync(path, "utf8");
for (const [before, after] of [["  const [user, setUser] = useState(() => {\n    try { const s = localStorage.getItem(\"daleel_user\"); return s ? JSON.parse(s) : null; } catch { return null; }\n  });\n", "  const [user, setUser] = useState(null);\n  useEffect(() => {\n    let active = true;\n    auth.authStateReady().then(() => {\n      if (!active) return;\n      try {\n        const saved = JSON.parse(localStorage.getItem(\"daleel_user\") || \"null\");\n        const session = auth.currentUser;\n        if (session && saved?.uid === session.uid) {\n          // The cached profile is display data; Firebase owns the session.\n          setUser(current => current ?? { ...saved, email: session.email });\n        } else if (saved) {\n          localStorage.removeItem(\"daleel_user\");\n        }\n      } catch {\n        // A blocked or malformed local cache must not prevent sign-in.\n      }\n    }).catch(() => {});\n    return () => { active = false; };\n  }, []);\n"], ["  const handleLogout = () => { DB.signOut(); localStorage.removeItem(\"daleel_user\"); setUser(null); setActiveTab(\"home\"); };\n", "  const handleLogout = async () => {\n    try {\n      await fbSignOut(auth);\n      localStorage.removeItem(\"daleel_user\");\n      setUser(null);\n      setActiveTab(\"home\");\n    } catch {\n      showToast(\"تعذّر تسجيل الخروج. حاول مرة تانية.\");\n    }\n  };\n"]]) {
  if (source.includes(after)) continue;
  if (source.split(before).length !== 2) throw new Error("Session patch anchor not found");
  source = source.replace(before, () => after);
}
fs.writeFileSync(path, source);
