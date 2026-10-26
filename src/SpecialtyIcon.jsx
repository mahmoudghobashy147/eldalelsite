import sheet from './assets/specialties-3d-sheet.webp';
import './specialty-icons.css';
const order=['plumbing','electrical','tiling','painting','carpentry','engineering','contracting','finishing','gypsum','ac','supplier','developer','marble','aluminum','steel','waterproofing'];
export default function SpecialtyIcon({id,fallback}){
 const index=order.indexOf(id);
 if(index<0)return <span aria-hidden="true">{fallback||'🔧'}</span>;
 const x=(index%4)*100/3,y=Math.floor(index/4)*100/3;
 return <span className="specialty-icon-3d" aria-hidden="true" style={{backgroundImage:`url(${sheet})`,backgroundPosition:`${x}% ${y}%`}}/>;
}
