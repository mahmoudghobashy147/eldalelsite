const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'HomeLanding.jsx');
let src = fs.readFileSync(file, 'utf8');

const before = 'getDocs(query(collection(db,"members"),limit(160)))';
const after = 'getDocs(query(collection(db,"members"),where("status","==","approved"),limit(160)))';

if (src.includes(before)) {
  src = src.replace(before, after);
}

const typeBefore = 'const t = clean(m.type || m.memberType || m.category).toLowerCase();';
const typeAfter = 'const t = clean(m.type || m.memberType || m.role || m.accountType || m.category).toLowerCase();';
if (src.includes(typeBefore)) src = src.replace(typeBefore, typeAfter);

const imageBefore = 'const memberImage = m => clean(m.coverImage || m.coverImageUrl || m.avatar || m.avatarUrl || m.profileImage || m.profileImageUrl || m.photo || m.photoUrl || m.image || m.imageUrl || firstArrayImage(m.workImages) || firstArrayImage(m.portfolioImages) || firstArrayImage(m.gallery) || firstArrayImage(m.images));';
const imageAfter = 'const memberImage = m => clean(m.coverImage || m.coverImageUrl || m.logoUrl || m.logo || m.avatar || m.avatarUrl || m.profileImage || m.profileImageUrl || m.photo || m.photoUrl || m.image || m.imageUrl || firstArrayImage(m.workImages) || firstArrayImage(m.portfolioImages) || firstArrayImage(m.gallery) || firstArrayImage(m.images));';
if (src.includes(imageBefore)) src = src.replace(imageBefore, imageAfter);

fs.writeFileSync(file, src);
console.log('Home live data patch applied');
