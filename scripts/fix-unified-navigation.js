const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'HomeLanding.jsx');
if (!fs.existsSync(file)) process.exit(0);
let s = fs.readFileSync(file, 'utf8');
const before = s;

s = s.replace(
  /const goApp=tab=>\{ window\.location\.href=`\/\?app=1\$\{tab\?`#\$\{tab\}`:""\}`; \};/,
  `const goApp=tab=>{\n    const routes={login:"/login",signin:"/login",register:"/register",notifications:"/notifications",suppliers:"/suppliers",posts:"/#feed",menu:"/#sections"};\n    window.location.href=routes[tab]||"/";\n  };`
);

s = s.replace(
  'const url=`${window.location.origin}/?app=1#posts`;',
  'const url=`${window.location.origin}/#feed`;'
);

s = s.replace(
  'if(!user){ window.location.href="/?app=1#login"; return; }',
  'if(!user){ window.location.href="/login"; return; }'
);

s = s.replace(
  '<section className="dl-shortcuts">',
  '<section id="sections" className="dl-shortcuts">'
);

if (s !== before) {
  fs.writeFileSync(file, s);
  console.log('Unified navigation patch applied');
} else {
  console.log('Unified navigation patch already applied');
}
