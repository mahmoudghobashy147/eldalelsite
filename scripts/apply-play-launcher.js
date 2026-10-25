const fs=require('fs'),path=require('path'),crypto=require('crypto');
const res='android/app/src/main/res';
const original=fs.readFileSync('src/assets/play-logo.png');
if(crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${original.length}\0`),original])).digest('hex')!=='dcce59f331ecf161a4be1c9879fc8776521b3165')throw Error('Approved logo integrity mismatch');
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
write(`${res}/drawable-nodpi/approved_directory_logo.png`,original);
// Replace generated launcher resources only; keep the supplied artwork unchanged.
for(const d of fs.readdirSync(res)){if(!d.startsWith('mipmap'))continue;for(const f of fs.readdirSync(path.join(res,d))){if(/^ic_launcher(?:_round|_foreground|_background)?\.(?:png|webp|xml)$/.test(f))fs.unlinkSync(path.join(res,d,f));}}
const legacy='<?xml version="1.0" encoding="utf-8"?><bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@drawable/approved_directory_logo" android:gravity="fill" android:filter="true"/>';
for(const n of ['ic_launcher','ic_launcher_round'])write(`${res}/mipmap-anydpi/${n}.xml`,legacy);
write(`${res}/drawable/approved_launcher_foreground.xml`,'<?xml version="1.0" encoding="utf-8"?><inset xmlns:android="http://schemas.android.com/apk/res/android" android:inset="20%"><bitmap android:src="@drawable/approved_directory_logo" android:gravity="fill" android:filter="true"/></inset>');
for(const n of ['ic_launcher','ic_launcher_round'])write(`${res}/mipmap-anydpi-v26/${n}.xml`,'<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/approved_logo_background"/><foreground android:drawable="@drawable/approved_launcher_foreground"/></adaptive-icon>');
write(`${res}/values/approved_logo.xml`,'<?xml version="1.0" encoding="utf-8"?><resources><color name="approved_logo_background">#041124</color></resources>');
console.log('Approved original logo installed for legacy and adaptive Android launchers.');
