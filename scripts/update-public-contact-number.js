const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let src = fs.readFileSync(appPath, 'utf8');
let changed = false;

const ADMIN_LOGIN_PHONE = '01110001986';
const PUBLIC_CONTACT_PHONE = '01039195832';
const PUBLIC_WHATSAPP = '201039195832';

function replaceAllExact(from, to) {
  if (!src.includes(from)) return;
  src = src.split(from).join(to);
  changed = true;
}

// Keep the admin login number untouched, but split public contact from admin auth.
if (!src.includes(`contactPhone: "${PUBLIC_CONTACT_PHONE}"`)) {
  const anchor = `whatsapp: "201110001986",\n  adminPhone: "${ADMIN_LOGIN_PHONE}",`;
  const replacement = `whatsapp: "${PUBLIC_WHATSAPP}",\n  contactPhone: "${PUBLIC_CONTACT_PHONE}",\n  adminPhone: "${ADMIN_LOGIN_PHONE}",`;
  if (!src.includes(anchor)) throw new Error('Public contact patch: DEFAULT_CONFIG anchor not found');
  src = src.replace(anchor, replacement);
  changed = true;
} else {
  replaceAllExact('whatsapp: "201110001986",', `whatsapp: "${PUBLIC_WHATSAPP}",`);
}

// The desktop topbar used adminPhone as a public contact number; use the public contact instead.
replaceAllExact(`📞 {cfg.adminPhone || "${ADMIN_LOGIN_PHONE}"}`, `📞 {cfg.contactPhone || "${PUBLIC_CONTACT_PHONE}"}`);

// Demo/home-ad public contact numbers only.
const adsStart = src.indexOf('const MOCK_ADS = [');
if (adsStart !== -1) {
  const adsEnd = src.indexOf('];', adsStart);
  if (adsEnd !== -1) {
    const before = src.slice(adsStart, adsEnd + 2);
    const after = before.split(`phone:"${ADMIN_LOGIN_PHONE}"`).join(`phone:"${PUBLIC_CONTACT_PHONE}"`);
    if (after !== before) {
      src = src.slice(0, adsStart) + after + src.slice(adsEnd + 2);
      changed = true;
    }
  }
}

// Public ad click fallbacks must dial the new contact number, never the admin login number.
replaceAllExact('ad.phone||"201110001986"', `ad.phone||"${PUBLIC_CONTACT_PHONE}"`);

// Admin settings state: add the public contact field while keeping adminPhone unchanged.
if (!src.includes(`contactPhone: "${PUBLIC_CONTACT_PHONE}",\n    facebook:`)) {
  const settingsAnchor = `whatsapp: "201110001986",\n    facebook:`;
  const settingsReplacement = `whatsapp: "${PUBLIC_WHATSAPP}",\n    contactPhone: "${PUBLIC_CONTACT_PHONE}",\n    facebook:`;
  if (src.includes(settingsAnchor)) {
    src = src.replace(settingsAnchor, settingsReplacement);
    changed = true;
  } else {
    // It may already have the new WhatsApp value from DEFAULT_CONFIG replacement on another copy.
    const altAnchor = `whatsapp: "${PUBLIC_WHATSAPP}",\n    facebook:`;
    if (src.includes(altAnchor)) {
      src = src.replace(altAnchor, settingsReplacement);
      changed = true;
    }
  }
}

// WhatsApp placeholder shown in admin settings.
replaceAllExact('k==="whatsapp"?"201110001986"', `k==="whatsapp"?"${PUBLIC_WHATSAPP}"`);

// Safety assertions: auth identity must not change.
if (!src.includes(`adminPhone: "${ADMIN_LOGIN_PHONE}"`)) {
  throw new Error('Public contact patch would remove/change adminPhone');
}
if (!src.includes(`const ADMIN_PHONE = "${ADMIN_LOGIN_PHONE}"`)) {
  throw new Error('Public contact patch would remove/change ADMIN_PHONE login constant');
}
if (!src.includes(`whatsapp: "${PUBLIC_WHATSAPP}"`)) {
  throw new Error('Public WhatsApp number was not applied');
}
if (!src.includes(`contactPhone: "${PUBLIC_CONTACT_PHONE}"`)) {
  throw new Error('Public contactPhone was not applied');
}

if (changed) {
  fs.writeFileSync(appPath, src, 'utf8');
  console.log('✅ Public contact changed to 01039195832; admin login remains 01110001986');
} else {
  console.log('✓ Public contact number already up to date');
}
