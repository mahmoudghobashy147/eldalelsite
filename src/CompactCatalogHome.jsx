import {useEffect,useState} from 'react';
import {collection,getDocs,query,where} from 'firebase/firestore';

export default function CompactCatalogHome({db,darkMode,onOpen,defaultCategories=[]}){
 const [categories,setCategories]=useState([]),[count,setCount]=useState(0);
 useEffect(()=>{let live=true;Promise.all(['catalogCategories','catalogBusinesses'].map(name=>getDocs(query(collection(db,name),where('active','==',true))))).then(([cats,businesses])=>{if(live){setCategories(cats.docs.map(d=>({id:d.id,...d.data()})));setCount(businesses.size);}}).catch(()=>{});return()=>{live=false;};},[db]);
 const shown=categories.length?categories.slice(0,8):defaultCategories.slice(0,8).map(([id,icon,name])=>({id,icon,name}));
 return <section className={`compact-catalog-home ${darkMode?'compact-catalog-dark':''}`} aria-label="كتالوج مواد التشطيب">
  <div className="compact-catalog-heading"><span className="compact-catalog-symbol" aria-hidden="true">▦</span><div><h2>كتالوج مواد التشطيب</h2><p>اختار الخامة وشوف المحلات والموردين</p></div><button type="button" className="compact-catalog-open" onClick={onOpen}>افتح الكتالوج ←</button></div>
  <div className="compact-catalog-categories" aria-label="أقسام الكتالوج">{shown.map(cat=><button type="button" key={cat.id} onClick={onOpen}><span aria-hidden="true">{cat.icon||'🧱'}</span><span>{cat.name}</span></button>)}</div>
  <div className="compact-catalog-foot">{count>0?`${count} مورد ومتجر متاح`:'خامات ومنتجات التشطيب في مكان واحد'}<span>اسحب الأقسام أو افتح الكتالوج</span></div>
 </section>;
}
