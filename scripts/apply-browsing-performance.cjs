const fs = require("node:fs");
const file = "src/App.jsx";
let app = fs.readFileSync(file, "utf8");
if (app.includes("const memberQueryCache =")) process.exit(0);

function replace(from, to) {
  if (app.split(from).length !== 2) throw new Error("Browsing performance anchor: " + from.slice(0, 80));
  app = app.replace(from, () => to);
}

replace("const POSTS_PAGE_SIZE = 20;", `const POSTS_PAGE_SIZE = 20;
const SEARCH_RENDER_PAGE_SIZE = 24;
const memberQueryCache = new Map();

async function getCachedApprovedMembers(constraints) {
  const key = JSON.stringify(constraints.cacheKey);
  const existing = memberQueryCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.promise;
  if (memberQueryCache.size >= 16) memberQueryCache.delete(memberQueryCache.keys().next().value);
  const entry = { expiresAt: Infinity, promise: null };
  entry.promise = getDocs(query(collection(db,"members"), ...constraints.filters))
    .then(snapshot => {
      entry.expiresAt = Date.now() + 20000;
      return snapshot.docs.map(doc => ({id:doc.id,...doc.data()}));
    })
    .catch(error => {
      if (memberQueryCache.get(key) === entry) memberQueryCache.delete(key);
      throw error;
    });
  memberQueryCache.set(key, entry);
  return entry.promise;
}`);

replace('const snap = await getDocs(query(collection(db,"members"), ...constraints));\n      let results = snap.docs.map(d => ({ id:d.id, ...d.data() }));',
  'const members = await getCachedApprovedMembers({ cacheKey:[filters.gov || "", filters.category || ""], filters:constraints });\n      let results = members.map(m => ({...m, followers:m.followersCount || 0}));');
replace('      for (let m of results) m.followers = m.followersCount || 0;\n', '');
replace('  // SMART_SEARCH_FILTERS_V1',
  '  const [visibleCount,setVisibleCount] = useState(SEARCH_RENDER_PAGE_SIZE);\n  const searchRequest = useRef(0);\n  // SMART_SEARCH_FILTERS_V1');
replace('  const doSearch = useCallback(async () => {\n    setLoading(true);',
  '  const doSearch = useCallback(async () => {\n    const request = ++searchRequest.current;\n    setLoading(true);');
replace('    setResults(filtered);', '    if (request !== searchRequest.current) return;\n    setVisibleCount(SEARCH_RENDER_PAGE_SIZE);\n    setResults(filtered);');
app = app.replaceAll('{results.map(m=><MemberCard', '{results.slice(0,visibleCount).map(m=><MemberCard');
const searchStart = app.indexOf('const SearchScreen =');
const searchEnd = app.indexOf('\nconst ',searchStart+1);
const search = app.slice(searchStart,searchEnd);
const more = '<button type="button" className="btn btn-outline" style={{marginTop:14}} onClick={()=>setVisibleCount(count=>count+SEARCH_RENDER_PAGE_SIZE)}>عرض المزيد من النتائج</button>';
if (search.split('{results.length===0&&(').length !== 3) throw new Error("Expected two result layouts");
app = app.slice(0,searchStart) + search.replaceAll('{results.length===0&&(', '{visibleCount<results.length&&'+more+'}\n              {results.length===0&&(') + app.slice(searchEnd);
app = app.replaceAll('<video src={post.video} controls', '<video src={post.video} preload="none" controls');
replace('<img src={src} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />',
  '<img src={src} alt="" loading="lazy" decoding="async" style={{ width:"100%",height:"100%",objectFit:"cover" }} />');
replace('if(pullD>50){setRefreshing(true);await loadData();', 'if(pullD>50){memberQueryCache.clear();setRefreshing(true);await loadData();');
replace('if(pullDist>50){setRefreshing(true);await doSearch();', 'if(pullDist>50){memberQueryCache.clear();setRefreshing(true);await doSearch();');
fs.writeFileSync(file, app);
