import craft from './assets/category-craft-3d.webp';
import engineering from './assets/category-engineering-3d.webp';
import materials from './assets/category-materials-3d.webp';
import './main-categories.css';

const items=[
 {id:'craft',title:'الصنايعية',subtitle:'فنيين وحرفيين',image:craft,description:'شوف التخصصات وصور الأعمال',tab:'search',filters:{category:'craftsman'}},
 {id:'engineering',title:'المهندسين والشركات',subtitle:'مهندسين • شركات • مكاتب',image:engineering,description:'اكتشف الملفات والخدمات',tab:'search'},
 {id:'materials',title:'كتالوج مواد التشطيب',subtitle:'محلات • مصانع • توكيلات',image:materials,description:'تصفح الخامات والموردين',tab:'catalog'}
];
function reset(event){const s=event.currentTarget.style;for(const [key,value] of [['--tilt-x','0deg'],['--tilt-y','0deg'],['--shine-x','50%'],['--shine-y','20%']])s.setProperty(key,value);}
function tilt(event){
 if(event.pointerType!=='mouse'||!window.matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches)return;
 const el=event.currentTarget,r=el.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(event.clientY-r.top)/r.height));
 el.style.setProperty('--tilt-x',`${(0.5-y)*8}deg`);el.style.setProperty('--tilt-y',`${(x-0.5)*10}deg`);el.style.setProperty('--shine-x',`${x*100}%`);el.style.setProperty('--shine-y',`${y*100}%`);
}
export default function MainCategories({onNavigate,darkMode}){
 return <section className={'main-categories'+(darkMode?' main-categories-dark':'')} data-home-main-sections="true" aria-labelledby="main-categories-title" dir="rtl">
  <h2 id="main-categories-title">الأقسام الرئيسية</h2>
  <div className="main-categories-grid">{items.map(item=><button key={item.id} type="button" className="main-category-card" onPointerMove={tilt} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset} onClick={()=>onNavigate(item.tab,item.filters)}>
   <span className="category-card-shine" aria-hidden="true"/>
   <span className="category-card-art"><img src={item.image} alt="" width="320" height="240" loading="lazy" decoding="async"/></span>
   <strong>{item.title}</strong><span className="category-card-subtitle">{item.subtitle}</span>
   <span className="category-card-detail">{item.description}<span aria-hidden="true"> ←</span></span>
  </button>)}</div>
 </section>;
}
