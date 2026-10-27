const fs = require('fs');
const file = 'src/App.jsx';
let source = fs.readFileSync(file, 'utf8');
function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (source.split(before).length !== 2) throw new Error(`${label}: unexpected source`);
  source = source.replace(before, after);
}
if (!source.includes('import MobileNavIcon from "./MobileNavIcon";')) source = 'import MobileNavIcon from "./MobileNavIcon";\n' + source;
replaceOnce('<div className="tab-bar">\n          {tabs.map(tab=>(', '<nav className="tab-bar mobile-nav-modern" aria-label="التنقل الرئيسي">\n          {tabs.map(tab=>(', 'navigation start');
replaceOnce('<div key={tab.id} className={`tab-item ${activeTab===tab.id?"active":""}`} onClick={()=>setActiveTab(tab.id)}>\n              <div style={{position:"relative"}}>\n                <span className="tab-icon">{tab.icon}</span>', '<button type="button" key={tab.id} className={`tab-item ${activeTab===tab.id?"active":""}`} aria-current={activeTab===tab.id?"page":undefined} onClick={()=>setActiveTab(tab.id)}>\n              <div style={{position:"relative"}}>\n                <MobileNavIcon id={tab.id}/>', 'navigation buttons');
replaceOnce('              <span>{tab.label}</span>\n            </div>\n          ))}', '              <span>{tab.label}</span>\n            </button>\n          ))}', 'navigation button end');
replaceOnce('<div className="tab-item" onClick={()=>setShowAuth(true)} style={{color:C.gold}}>\n              <span className="tab-icon">👤</span>\n              <span>دخول / تسجيل</span>\n            </div>\n          )}\n        </div>', '<button type="button" className="tab-item" onClick={()=>setShowAuth(true)}>\n              <MobileNavIcon id="profile"/>\n              <span>دخول / تسجيل</span>\n            </button>\n          )}\n        </nav>', 'guest login');
fs.writeFileSync(file, source);
console.log('Modern mobile navigation integrated.');
