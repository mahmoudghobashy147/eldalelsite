const fs=require('fs'),assert=require('assert/strict');
const app=fs.readFileSync('src/App.jsx','utf8');
for(const [key,photos] of Object.entries({starter:5,basic:15,premium:10,vip:30,company:60,elite:100})){
 const line=app.split('\n').find(x=>new RegExp('^  '+key+':\\s*\\{').test(x));
 assert(line,'Missing plan '+key);
 assert(new RegExp('maxPhotos:\\s*'+photos+'\\b').test(line),'Incorrect photo count for '+key);
 assert(/صور|صورة/.test(line),'Missing photo benefit for '+key);
}
assert(app.includes('صور الأعمال: حتى ${pl.maxPhotos} صورة'),'Registration must show each plan photo limit');
console.log('Plan photo benefits and limits verified.');
