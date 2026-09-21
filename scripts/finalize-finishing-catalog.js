const fs = require('fs');

const CATALOG = 'src/catalog.jsx';
const APP = 'src/App.jsx';

let catalog = fs.readFileSync(CATALOG, 'utf8');
let app = fs.readFileSync(APP, 'utf8');

function replaceCatalog(from, to, label) {
  if (catalog.includes(to)) return;
  if (!catalog.includes(from)) throw new Error(`Catalog finalization failed: ${label} anchor not found`);
  catalog = catalog.replace(from, to);
}

// First-class optional subcategory/type field. Existing products remain valid because the field is optional.
replaceCatalog(
  '  name:"", code:"", categoryId:"", businessId:"", size:"", color:"", material:"",',
  '  name:"", code:"", categoryId:"", subCategory:"", businessId:"", size:"", color:"", material:"",',
  'product subcategory model'
);

replaceCatalog(
  '  const [search,setSearch]=useState(""),[categoryId,setCategoryId]=useState(""),[businessId,setBusinessId]=useState(""),[gov,setGov]=useState("");',
  '  const [search,setSearch]=useState(""),[categoryId,setCategoryId]=useState(""),[subCategory,setSubCategory]=useState(""),[businessId,setBusinessId]=useState(""),[gov,setGov]=useState("");',
  'subcategory filter state'
);

replaceCatalog(
  '[p.name,p.code,p.description,p.specs,p.size,p.color,p.material,b?.name].join(" ")',
  '[p.name,p.code,p.subCategory,p.description,p.specs,p.size,p.color,p.material,b?.name].join(" ")',
  'subcategory full-text search'
);

replaceCatalog(
  '    if(categoryId&&p.categoryId!==categoryId) return false;\n    if(businessId&&p.businessId!==businessId) return false;',
  '    if(categoryId&&p.categoryId!==categoryId) return false;\n    if(subCategory&&normalize(p.subCategory)!==normalize(subCategory)) return false;\n    if(businessId&&p.businessId!==businessId) return false;',
  'subcategory product filtering'
);

replaceCatalog(
  '  }),[products,businesses,search,categoryId,businessId,gov,size,color,minPrice,maxPrice,dynamic]);',
  '  }),[products,businesses,search,categoryId,subCategory,businessId,gov,size,color,minPrice,maxPrice,dynamic]);',
  'subcategory memo dependencies'
);

replaceCatalog(
  '  const govs=[...new Set(businesses.map(b=>b.governorate).filter(Boolean))];\n  const sizes=[...new Set(products.map(p=>p.size).filter(Boolean))];',
  '  const govs=[...new Set(businesses.map(b=>b.governorate).filter(Boolean))];\n  const subCategories=[...new Set(products.filter(p=>!categoryId||p.categoryId===categoryId).map(p=>p.subCategory).filter(Boolean))];\n  const sizes=[...new Set(products.filter(p=>!categoryId||p.categoryId===categoryId).map(p=>p.size).filter(Boolean))];',
  'subcategory options'
);

replaceCatalog(
  '<select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={filterStyle(c)}><option value="">كل التصنيفات</option>{cats.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>\n          <select value={businessId}',
  '<select value={categoryId} onChange={e=>{setCategoryId(e.target.value);setSubCategory("");}} style={filterStyle(c)}><option value="">كل التصنيفات</option>{cats.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>\n          <select value={subCategory} onChange={e=>setSubCategory(e.target.value)} style={filterStyle(c)}><option value="">كل الأقسام الفرعية</option>{subCategories.map(x=><option key={x} value={x}>{x}</option>)}</select>\n          <select value={businessId}',
  'subcategory select'
);

replaceCatalog(
  '[["المقاس",p.size],["اللون",p.color],["الخامة",p.material],["التوفر",p.availability]]',
  '[["القسم الفرعي",p.subCategory],["المقاس",p.size],["اللون",p.color],["الخامة",p.material],["التوفر",p.availability]]',
  'subcategory product details'
);

replaceCatalog(
  '<Field label="التصنيف" value={product.categoryId} onChange={v=>setProduct(p=>({...p,categoryId:v}))} options={cats.map(x=>({value:x.id,label:x.name}))}/><Field label="الشركة / المورد"',
  '<Field label="التصنيف" value={product.categoryId} onChange={v=>setProduct(p=>({...p,categoryId:v,subCategory:""}))} options={cats.map(x=>({value:x.id,label:x.name}))}/><Field label="القسم الفرعي / نوع المنتج" value={product.subCategory} onChange={v=>setProduct(p=>({...p,subCategory:v}))} placeholder="مثال: أرضيات أو حوائط أو خلاطات"/><Field label="الشركة / المورد"',
  'subcategory admin field'
);

replaceCatalog(
  '[x.name,x.code,x.color,x.size,businesses.find(b=>b.id===x.businessId)?.name].join(" ")',
  '[x.name,x.code,x.subCategory,x.color,x.size,businesses.find(b=>b.id===x.businessId)?.name].join(" ")',
  'subcategory admin search'
);

// Add an explicit top-level directory chooser without replacing any existing homepage content.
if (!app.includes('data-home-main-sections="true"')) {
  const anchor = '      {/* كتالوج مواد التشطيب — إضافة مستقلة بدون تغيير أي قسم حالي */}\n      <CatalogHomeSection db={db} darkMode={darkMode} onOpen={()=>onNavigate("catalog")} />';
  if (!app.includes(anchor)) throw new Error('Catalog finalization failed: homepage catalog anchor not found');
  const block = `      {/* الأقسام الرئيسية — إضافة توضيحية فقط، بدون تغيير الأقسام الحالية */}\n      <div data-home-main-sections="true" className={isDesktop?"desktop-container":"section"} style={{paddingTop:18,paddingBottom:0}}>\n        <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isDesktop?20:17,color:tc,marginBottom:10}}>الأقسام الرئيسية</div>\n        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:isDesktop?12:7}}>\n          {[\n            {label:"الصنايعية",sub:"فنيين وحرفيين",icon:"🔧",go:()=>onNavigate("search",{category:"craftsman"})},\n            {label:"المهندسين والشركات",sub:"مهندسين • شركات • مكاتب",icon:"🏢",go:()=>onNavigate("search")},\n            {label:"كتالوج مواد التشطيب",sub:"محلات • مصانع • توكيلات",icon:"🧱",go:()=>onNavigate("catalog")},\n          ].map(x=><div key={x.label} onClick={x.go} style={{background:card,borderRadius:isDesktop?17:13,padding:isDesktop?18:10,border:\`1px solid \${darkMode?"rgba(201,168,76,.14)":C.grayLight}\`,cursor:"pointer",textAlign:"center",minWidth:0}}>\n            <div style={{fontSize:isDesktop?29:23,marginBottom:6}}>{x.icon}</div>\n            <div style={{fontFamily:"'Cairo'",fontWeight:900,fontSize:isDesktop?14:10.5,color:tc,lineHeight:1.45}}>{x.label}</div>\n            <div style={{fontSize:isDesktop?11:8.5,color:sub,marginTop:3,lineHeight:1.4}}>{x.sub}</div>\n          </div>)}\n        </div>\n      </div>\n\n${anchor}`;
  app = app.replace(anchor, block);
}

fs.writeFileSync(CATALOG, catalog);
fs.writeFileSync(APP, app);
console.log('✅ Catalog hierarchy and homepage main sections finalized');
