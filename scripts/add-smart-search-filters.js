const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let src = fs.readFileSync(appPath, 'utf8');

const MARKER = '// SMART_SEARCH_FILTERS_V1';
if (src.includes(MARKER)) {
  console.log('Smart search filters already applied');
  process.exit(0);
}

function replaceOnce(find, replacement, label) {
  if (!src.includes(find)) {
    throw new Error(`Smart search patch failed: ${label}`);
  }
  src = src.replace(find, replacement);
}

replaceOnce(
  '  const [minRating, setMinRating] = useState(0);\n  const [results, setResults] = useState([]);',
  `  const [minRating, setMinRating] = useState(0);\n  const [minExperience, setMinExperience] = useState(0);\n  const [availableOnly, setAvailableOnly] = useState(false);\n  const [results, setResults] = useState([]);\n  ${MARKER}`,
  'search state'
);

replaceOnce(
  '    let filtered = minRating>0 ? data.filter(m=>m.rating>=minRating) : data;\n    if (city) filtered = filtered.filter(m=>m.city===city);\n    setResults(filtered);\n    setLoading(false);\n  }, [dq, gov, specialty, category, mtype, sort, minRating, city]);',
  `    let filtered = minRating>0 ? data.filter(m=>Number(m.rating||0)>=minRating) : data;\n    if (city) filtered = filtered.filter(m=>m.city===city);\n    if (minExperience>0) filtered = filtered.filter(m=>Number(m.experience||0)>=minExperience);\n    if (availableOnly) filtered = filtered.filter(m=>m.available===true);\n    setResults(filtered);\n    setLoading(false);\n  }, [dq, gov, specialty, category, mtype, sort, minRating, city, minExperience, availableOnly]);`,
  'search filtering logic'
);

const mobileRating = `            <div>\n              <div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginBottom:5}}>أدنى تقييم: {minRating>0?\`${'${minRating}'}★\`:"الكل"}</div>\n              <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={e=>setMinRating(+e.target.value)} style={{width:"100%",accentColor:C.gold}}/>\n            </div>`;
const mobileEnhanced = `            <div style={{marginBottom:10}}>\n              <div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginBottom:5}}>أدنى تقييم: {minRating>0?\`${'${minRating}'}★\`:"الكل"}</div>\n              <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={e=>setMinRating(+e.target.value)} style={{width:"100%",accentColor:C.gold}}/>\n            </div>\n            <div style={{marginBottom:10}}>\n              <div style={{color:"rgba(255,255,255,.55)",fontSize:11.5,marginBottom:6}}>سنوات الخبرة</div>\n              <select className="select select-dark" style={{width:"100%"}} value={minExperience} onChange={e=>setMinExperience(+e.target.value)}>\n                <option value={0}>كل مستويات الخبرة</option>\n                <option value={1}>سنة فأكثر</option>\n                <option value={3}>3 سنوات فأكثر</option>\n                <option value={5}>5 سنوات فأكثر</option>\n                <option value={10}>10 سنوات فأكثر</option>\n                <option value={15}>15 سنة فأكثر</option>\n                <option value={20}>20 سنة فأكثر</option>\n              </select>\n            </div>\n            <label style={{display:"flex",alignItems:"center",gap:8,color:"white",fontSize:12,cursor:"pointer"}}>\n              <input type="checkbox" checked={availableOnly} onChange={e=>setAvailableOnly(e.target.checked)} style={{accentColor:C.gold}}/>\n              متاح للعمل الآن فقط\n            </label>`;
replaceOnce(mobileRating, mobileEnhanced, 'mobile advanced filters');

const desktopRating = `              <div>\n                <div className="form-label" style={{color:tc,marginBottom:5}}>أدنى تقييم: {minRating>0?\`${'${minRating}'}★\`:"الكل"}</div>\n                <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={e=>setMinRating(+e.target.value)} style={{width:"100%",accentColor:C.gold}}/>\n              </div>`;
const desktopEnhanced = `              <div style={{marginBottom:14}}>\n                <div className="form-label" style={{color:tc,marginBottom:5}}>أدنى تقييم: {minRating>0?\`${'${minRating}'}★\`:"الكل"}</div>\n                <input type="range" min={0} max={5} step={0.5} value={minRating} onChange={e=>setMinRating(+e.target.value)} style={{width:"100%",accentColor:C.gold}}/>\n              </div>\n              <div className="form-group">\n                <div className="form-label" style={{color:tc}}>سنوات الخبرة</div>\n                <select className={\`select${'${darkMode?" select-dark":""}'}\`} value={minExperience} onChange={e=>setMinExperience(+e.target.value)}>\n                  <option value={0}>كل مستويات الخبرة</option>\n                  <option value={1}>سنة فأكثر</option>\n                  <option value={3}>3 سنوات فأكثر</option>\n                  <option value={5}>5 سنوات فأكثر</option>\n                  <option value={10}>10 سنوات فأكثر</option>\n                  <option value={15}>15 سنة فأكثر</option>\n                  <option value={20}>20 سنة فأكثر</option>\n                </select>\n              </div>\n              <label style={{display:"flex",alignItems:"center",gap:8,color:tc,fontSize:12,cursor:"pointer",paddingTop:2}}>\n                <input type="checkbox" checked={availableOnly} onChange={e=>setAvailableOnly(e.target.checked)} style={{accentColor:C.gold}}/>\n                متاح للعمل الآن فقط\n              </label>`;
replaceOnce(desktopRating, desktopEnhanced, 'desktop advanced filters');

fs.writeFileSync(appPath, src);
console.log('Smart search filters added successfully');
