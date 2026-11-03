'use strict';
const fs=require('node:fs'),path=require('node:path');
function verify(dir='build'){
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'asset-manifest.json'),'utf8'));
 if(Object.values(manifest.files||{}).some(v=>/registration-policy[^/]*\.cjs(?:$|\?)/.test(v)))throw Error('Registration helper was emitted as a downloadable asset instead of executable JavaScript');
 const app=fs.readFileSync('src/App.jsx','utf8');
 if(app.includes('./registration-policy.cjs'))throw Error('Admin screen still imports the unsupported .cjs browser helper');
 for(const file of ['src/RegistrationDetails.jsx','src/PendingPhoneViewer.jsx'])if(fs.readFileSync(file,'utf8').includes('./registration-policy.cjs'))throw Error(file+' imports the unsupported browser extension');
 if(typeof require(path.resolve('src/registration-policy.js')).indexRegistrations!=='function')throw Error('Browser registration helper does not export executable functions');
 console.log('Registration helper is executable code; no registration .cjs asset in the production build.');
}
if(require.main===module)verify();module.exports={verify};
