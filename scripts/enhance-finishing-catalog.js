const fs = require('fs');

const FILE = 'src/catalog.jsx';
let text = fs.readFileSync(FILE, 'utf8');

function replaceOnce(from, to, label) {
  if (text.includes(to)) return;
  if (!text.includes(from)) throw new Error(`Catalog enhancement failed: ${label} anchor not found`);
  text = text.replace(from, to);
}

if (!text.includes('async function downloadCatalogQr')) {
  const anchor = 'const qrUrl = id => `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=${encodeURIComponent(catalogUrl(id))}`;\n';
  const addition = `${anchor}\nasync function downloadCatalogQr(id, name) {\n  const url = qrUrl(id);\n  try {\n    const response = await fetch(url);\n    if (!response.ok) throw new Error('QR download failed');\n    const blob = await response.blob();\n    const objectUrl = URL.createObjectURL(blob);\n    const a = document.createElement('a');\n    a.href = objectUrl;\n    a.download = \`QR-\${String(name || id).replace(/[^\\p{L}\\p{N}._-]+/gu, '_')}.png\`;\n    document.body.appendChild(a);\n    a.click();\n    a.remove();\n    URL.revokeObjectURL(objectUrl);\n  } catch {\n    window.open(url, '_blank', 'noopener,noreferrer');\n  }\n}\n\nfunction printCatalogQr(id, name) {\n  const popup = window.open('', '_blank', 'width=620,height=760');\n  if (!popup) return;\n  const safeName = String(name || 'الدليل الشامل').replace(/[&<>\"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[ch]));\n  const url = qrUrl(id);\n  const pageUrl = catalogUrl(id);\n  popup.document.open();\n  popup.document.write(\`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR - \${safeName}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:35px;color:#0A1F44}img{width:360px;height:360px;max-width:90vw}.name{font-size:24px;font-weight:800;margin:15px}.url{font-size:12px;direction:ltr;word-break:break-all;margin:15px auto;max-width:520px}.brand{color:#9E7B28;font-weight:700;margin-top:18px}@media print{button{display:none}}</style></head><body><div class="brand">الدليل الشامل</div><div class="name">\${safeName}</div><img src="\${url}" alt="QR"><div class="url">\${pageUrl}</div><button onclick="window.print()">طباعة</button><script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>\`);\n  popup.document.close();\n}\n`;
  if (!text.includes(anchor)) throw new Error('Catalog enhancement failed: QR helper anchor not found');
  text = text.replace(anchor, addition);
}

if (!text.includes('const productUrl = (productId)')) {
  const anchor = 'const catalogUrl = (businessId) => {\n  const origin = typeof window !== "undefined" ? window.location.origin : "https://eldalel-elshamel.online";\n  return `${origin}/?catalog=business&businessId=${encodeURIComponent(businessId)}`;\n};\n';
  const replacement = `${anchor}const productUrl = (productId) => {\n  const origin = typeof window !== "undefined" ? window.location.origin : "https://eldalel-elshamel.online";\n  return \`\${origin}/?catalog=product&productId=\${encodeURIComponent(productId)}\`;\n};\n`;
  replaceOnce(anchor, replacement, 'product URL helper');
}

// Remove a no-longer-needed local color object from the homepage teaser.
text = text.replace(
  'export function CatalogHomeSection({db,darkMode,onOpen}){\n  const c=cardColors(darkMode), mobile=useMobile();',
  'export function CatalogHomeSection({db,darkMode,onOpen}){\n  const mobile=useMobile();'
);

if (!text.includes('const shareUrl=productUrl(p.id);')) {
  const anchor = '  const share=async()=>{\n    const data={title:p.name,text:`${p.name}${business?.name?` - ${business.name}`:""}`,url:window.location.href};\n    if(navigator.share) await navigator.share(data).catch(()=>{});\n    else { await navigator.clipboard?.writeText(window.location.href); alert("تم نسخ رابط المنتج"); }\n  };';
  const replacement = '  const share=async()=>{\n    const shareUrl=productUrl(p.id);\n    const data={title:p.name,text:`${p.name}${business?.name?` - ${business.name}`:""}`,url:shareUrl};\n    if(navigator.share) await navigator.share(data).catch(()=>{});\n    else { await navigator.clipboard?.writeText(shareUrl); alert("تم نسخ رابط المنتج"); }\n  };';
  replaceOnce(anchor, replacement, 'product share URL');
}

if (!text.includes('const pid=q.get("productId")')) {
  const anchor = '        const q=new URLSearchParams(window.location.search), bid=q.get("businessId");\n        if(q.get("catalog")==="business"&&bid){\n          const found=b.find(x=>x.id===bid);\n          if(found) setSelectedBusiness(found);\n          else try{const s=await getDoc(doc(db,"catalogBusinesses",bid));if(s.exists()&&s.data().active===true)setSelectedBusiness({id:s.id,...s.data()});}catch{}\n        }';
  const replacement = '        const q=new URLSearchParams(window.location.search), type=q.get("catalog"), bid=q.get("businessId"), pid=q.get("productId");\n        if(type==="business"&&bid){\n          const found=b.find(x=>x.id===bid);\n          if(found) setSelectedBusiness(found);\n          else try{const s=await getDoc(doc(db,"catalogBusinesses",bid));if(s.exists()&&s.data().active===true)setSelectedBusiness({id:s.id,...s.data()});}catch{}\n        } else if(type==="product"&&pid){\n          const found=p.find(x=>x.id===pid);\n          if(found) setSelectedProduct(found);\n          else try{const s=await getDoc(doc(db,"catalogProducts",pid));if(s.exists()&&s.data().active===true)setSelectedProduct({id:s.id,...s.data()});}catch{}\n        }';
  replaceOnce(anchor, replacement, 'product deep-link loader');
}

if (!text.includes('const openProduct=p=>')) {
  const anchor = '  const openBusiness=b=>{setSelectedProduct(null);setSelectedBusiness(b);window.history.pushState({catalog:true},"",`?catalog=business&businessId=${encodeURIComponent(b.id)}`);window.scrollTo(0,0);};\n  const back=()=>{setSelectedBusiness(null);setSelectedProduct(null);window.history.replaceState({},"",window.location.pathname);window.scrollTo(0,0);};';
  const replacement = '  const openBusiness=b=>{setSelectedProduct(null);setSelectedBusiness(b);window.history.pushState({catalog:true},"",`?catalog=business&businessId=${encodeURIComponent(b.id)}`);window.scrollTo(0,0);};\n  const openProduct=p=>{setSelectedProduct(p);window.history.pushState({catalog:true},"",`?catalog=product&productId=${encodeURIComponent(p.id)}`);window.scrollTo(0,0);};\n  const closeProduct=()=>{setSelectedProduct(null);if(selectedBusiness)window.history.replaceState({catalog:true},"",`?catalog=business&businessId=${encodeURIComponent(selectedBusiness.id)}`);else window.history.replaceState({catalog:true},"",`?catalog=1`);window.scrollTo(0,0);};\n  const back=()=>{setSelectedBusiness(null);setSelectedProduct(null);window.history.replaceState({},"",window.location.pathname);window.scrollTo(0,0);};';
  replaceOnce(anchor, replacement, 'product open/back handlers');
}

text = text.replace('onBack={()=>setSelectedProduct(null)} darkMode={darkMode}', 'onBack={closeProduct} darkMode={darkMode}');
text = text.replace('onProduct={setSelectedProduct} darkMode={darkMode}', 'onProduct={openProduct} darkMode={darkMode}');
text = text.replace(/onOpen=\{setSelectedProduct\}/g, 'onOpen={openProduct}');

if (!text.includes('title="أحدث المنتجات والعروض"')) {
  const anchor = '<SectionTitle darkMode={darkMode} title="ابحث وفلتر المنتجات" sub="يمكنك الوصول للمنتج نفسه بالمواصفات"/>';
  const block = `<SectionTitle darkMode={darkMode} title="أحدث المنتجات والعروض" sub="أحدث ما تم إضافته إلى الكتالوج"/>\n        {latest.length?<div style={{display:"grid",gridTemplateColumns:\`repeat(\${mobile?2:4},minmax(0,1fr))\`,gap:11,marginBottom:28}}>{latest.map(p=><ProductCard key={p.id} p={p} business={businesses.find(b=>b.id===p.businessId)} category={cats.find(x=>x.id===p.categoryId)} onOpen={openProduct} darkMode={darkMode}/>)}</div>:<div style={{padding:20,color:c.sub,textAlign:"center",marginBottom:20}}>سيتم عرض أحدث المنتجات هنا بعد إضافتها من الإدارة</div>}\n        ${anchor}`;
  replaceOnce(anchor, block, 'latest products section');
}

if (!text.includes('تحميل QR')) {
  const anchor = '<Btn secondary onClick={()=>window.open(qrUrl(x.id))}>QR</Btn><button onClick={()=>remove("businesses",x.id,x.name)} style={dangerBtn}>حذف</button>';
  const replacement = '<Btn secondary onClick={()=>window.open(qrUrl(x.id),"_blank","noopener,noreferrer")}>مشاهدة QR</Btn><Btn secondary onClick={()=>downloadCatalogQr(x.id,x.name)}>تحميل QR</Btn><Btn secondary onClick={()=>printCatalogQr(x.id,x.name)}>طباعة QR</Btn><button onClick={()=>remove("businesses",x.id,x.name)} style={dangerBtn}>حذف</button>';
  replaceOnce(anchor, replacement, 'admin QR actions');
}

fs.writeFileSync(FILE, text);
console.log('✅ Catalog QR, product sharing, and latest-product enhancements applied');
