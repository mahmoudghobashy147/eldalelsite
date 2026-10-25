const fs=require('fs');
const p='src/App.jsx';let s=fs.readFileSync(p,'utf8');
const old='import directoryLogo from "./assets/directory-logo.webp";';
const next='import directoryLogo from "./assets/play-logo.png";';
if(!s.includes(next)){if(s.split(old).length!==2)throw Error('Expected one directory logo import');s=s.replace(old,next);}
fs.writeFileSync(p,s);
console.log('Approved Golden D logo applied to the Android app.');
