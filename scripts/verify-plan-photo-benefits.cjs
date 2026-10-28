const fs=require('fs'),assert=require('assert/strict');
const app=fs.readFileSync('src/App.jsx','utf8');
for(const key of ['starter','basic','premium','vip','company','elite']){
 const line=app.split('\n').find(x=>new RegExp('^  '+key+':\\s*\\{').test(x));
 assert(line,'Missing plan '+key);
 assert(/maxPhotos:\s*5\b/.test(line),'Work photos should be limited to five for '+key);
 assert(/5 صور/.test(line),'Five-photo benefit must be visible for '+key);
}
assert(app.includes('getPostLimit(key,cfg)'),'Display the configured monthly post limit');
assert(app.includes('صور الأعمال: حتى ${pl.maxPhotos} صور'),'Show photo limits in registration');
console.log('Five work photos and monthly post limits verified.');

assert(app.includes('import planVideoPolicy from "./plan-video-policy.js";'),'Video quota helper must be bundled as JavaScript');
const manifest=JSON.parse(fs.readFileSync('build/asset-manifest.json','utf8'));
assert(!Object.values(manifest.files).some(file=>/plan-video-policy.*\\.cjs$/.test(file)),'Video quota code must not be emitted as a downloadable asset');
