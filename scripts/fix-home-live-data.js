const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'HomeLanding.jsx');
let src = fs.readFileSync(file, 'utf8');

const replaceOnce = (before, after) => {
  if (src.includes(after)) return;
  if (src.includes(before)) src = src.replace(before, after);
};

// Public visitors are only allowed to list approved members by Firestore rules.
replaceOnce(
  'getDocs(query(collection(db,"members"),limit(160)))',
  'getDocs(query(collection(db,"members"),where("status","==","approved"),limit(160)))'
);

// Support the different field names that already exist across old/new member records.
replaceOnce(
  'const t = clean(m.type || m.memberType || m.category).toLowerCase();',
  'const t = clean(m.type || m.memberType || m.role || m.accountType || m.category).toLowerCase();'
);

replaceOnce(
  'const memberImage = m => clean(m.coverImage || m.coverImageUrl || m.avatar || m.avatarUrl || m.profileImage || m.profileImageUrl || m.photo || m.photoUrl || m.image || m.imageUrl || firstArrayImage(m.workImages) || firstArrayImage(m.portfolioImages) || firstArrayImage(m.gallery) || firstArrayImage(m.images));',
  'const memberImage = m => clean(m.coverImage || m.coverImageUrl || m.logoUrl || m.logo || m.avatar || m.avatarUrl || m.profileImage || m.profileImageUrl || m.photo || m.photoUrl || m.image || m.imageUrl || firstArrayImage(m.workImages) || firstArrayImage(m.portfolioImages) || firstArrayImage(m.gallery) || firstArrayImage(m.images));'
);

replaceOnce(
  'const locationText = m => [m.governorate || m.gov, m.city, m.area].filter(Boolean).join(" • ") || "مصر";',
  'const locationText = m => [m.governorate || m.gov || m.province, m.city || m.district, m.area || m.region].filter(Boolean).join(" • ") || "مصر";'
);

replaceOnce(
  'function CraftCard({m,onClick}){ const img=memberImage(m), r=ratingValue(m); return <button className="dl-person-card" onClick={onClick}><div className="dl-person-img">{img?<img src={img} alt={m.name||"صنايعي"}/>:<span><Icon name="craftsman" size={39}/></span>}</div><div className="dl-person-info"><div className="dl-name-row"><b>{m.name||"عضو الدليل"}</b>{r>0&&<em><Icon name="star" size={13}/> {r.toFixed(1)}</em>}</div><small>{m.specialty||m.category||"تشطيبات ومقاولات"}</small><span><Icon name="location" size={14}/> {locationText(m)}</span></div><strong className="dl-card-cta">عرض الملف</strong></button>; }',
  'function CraftCard({m,onClick}){ const img=memberImage(m), r=ratingValue(m), name=m.name||m.fullName||m.displayName||"عضو الدليل", specialty=m.specialty||m.profession||m.job||m.specialization||m.category||"تشطيبات ومقاولات"; return <button className="dl-person-card" onClick={onClick}><div className="dl-person-img">{img?<img src={img} alt={name}/>:<span><Icon name="craftsman" size={39}/></span>}</div><div className="dl-person-info"><div className="dl-name-row"><b>{name}</b>{r>0&&<em><Icon name="star" size={13}/> {r.toFixed(1)}</em>}</div><small>{specialty}</small><span><Icon name="location" size={14}/> {locationText(m)}</span></div><strong className="dl-card-cta">عرض الملف</strong></button>; }'
);

replaceOnce(
  'function CompanyCard({m,onClick,supplier}){ const img=memberImage(m), r=ratingValue(m); return <button className="dl-company-card" onClick={onClick}><div className="dl-company-img">{img?<img src={img} alt={m.name||"شركة"}/>:<span><Icon name={supplier?"supplier":"company"} size={42}/></span>}</div><div className="dl-company-info"><div className="dl-name-row"><b>{m.name||"عضو الدليل"}</b>{r>0&&<em><Icon name="star" size={13}/> {r.toFixed(1)}</em>}</div><small>{m.specialty||m.category||(supplier?"مورد مواد تشطيب":"مقاولات وتشطيبات")}</small><span><Icon name="location" size={14}/> {locationText(m)}</span></div></button>; }',
  'function CompanyCard({m,onClick,supplier}){ const img=memberImage(m), r=ratingValue(m), name=m.name||m.companyName||m.storeName||m.fullName||m.displayName||"عضو الدليل", specialty=m.specialty||m.profession||m.businessType||m.activity||m.category||(supplier?"مورد مواد تشطيب":"مقاولات وتشطيبات"); return <button className="dl-company-card" onClick={onClick}><div className="dl-company-img">{img?<img src={img} alt={name}/>:<span><Icon name={supplier?"supplier":"company"} size={42}/></span>}</div><div className="dl-company-info"><div className="dl-name-row"><b>{name}</b>{r>0&&<em><Icon name="star" size={13}/> {r.toFixed(1)}</em>}</div><small>{specialty}</small><span><Icon name="location" size={14}/> {locationText(m)}</span></div></button>; }'
);

fs.writeFileSync(file, src);
console.log('Home live data patch applied');
