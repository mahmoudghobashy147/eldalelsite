const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'HomeLanding.jsx');
if (!fs.existsSync(file)) process.exit(0);
let s = fs.readFileSync(file, 'utf8');

// Load the premium skin as a normal stylesheet so the build stays stable.
if (!s.includes('import "./premium-3d-home.css";')) {
  s = s.replace(
    'import { buildMemberPath } from "./seo";',
    'import { buildMemberPath } from "./seo";\nimport "./premium-3d-home.css";'
  );
}

// 3D avatar placeholder for members without photos.
s = s.replace(
  /<span><Icon name="craftsman" size=\{39\}\/><\/span>/g,
  '<span className="dl-avatar-3d" aria-label="صورة افتراضية"><i/><b/></span>'
);
s = s.replace(
  /<span><Icon name=\{supplier\?"supplier":"company"\} size=\{42\}\/><\/span>/g,
  '<span className="dl-avatar-3d" aria-label="صورة افتراضية"><i/><b/></span>'
);

// Premium panels around the main content sections.
s = s.replace(
  '<section className="dl-featured">',
  '<section className="dl-featured dl-premium-panel">'
);
s = s.replace(
  '<section id="feed" className="dl-feed-section">',
  '<section id="feed" className="dl-feed-section dl-premium-panel">'
);

fs.writeFileSync(file, s);
console.log('Premium 3D homepage skin applied.');
