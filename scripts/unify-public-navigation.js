const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'HomeLanding.jsx');
let src = fs.readFileSync(file, 'utf8');

const old = '  const goApp=tab=>{ window.location.href=`/?app=1${tab?`#${tab}`:""}`; };';
const replacement = `  const goApp=tab=>{\n    const routes={login:"/login",register:"/register",notifications:"/notifications",menu:"/menu",suppliers:"/suppliers",posts:"/#feed"};\n    window.location.href=routes[tab]||"/";\n  };`;
if (src.includes(old)) src = src.replace(old, replacement);

src = src.replace('const url=`${window.location.origin}/?app=1#posts`;', 'const url=`${window.location.origin}/#feed`;');
src = src.replace('window.location.href="/?app=1#login";', 'window.location.href="/login";');

fs.writeFileSync(file, src);
console.log('Unified public navigation applied');
