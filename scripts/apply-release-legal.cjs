'use strict';
const fs=require('node:fs');const {privacy,terms}=require('../src/release-legal.cjs');
let app=fs.readFileSync('src/App.jsx','utf8');
function replaceConstant(name,value){
 const prefix='const '+name+' = ',start=app.indexOf(prefix),valueStart=start+prefix.length;let end=-1;
 if(start<0)throw Error('Missing legal constant: '+name);
 if(app[valueStart]==='`'){const suffix='`.trim();',at=app.indexOf(suffix,valueStart);if(at>=0)end=at+suffix.length;}
 else if(app[valueStart]==='"'){for(let i=valueStart+1;i<app.length;i++){if(app[i]==='\\'){i++;continue;}if(app[i]==='"'){if(app[i+1]===';')end=i+2;break;}}}
 if(end<0)throw Error('Unexpected legal constant format: '+name);
 app=app.slice(0,start)+`const ${name} = ${JSON.stringify(value)};`+app.slice(end);
}
replaceConstant('LEGAL_TERMS',terms);replaceConstant('LEGAL_PRIVACY',privacy);fs.writeFileSync('src/App.jsx',app);
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let page=fs.readFileSync('public/privacy.html','utf8');page=page.replace(/<main>[\s\S]*<\/main>/,()=>'<main><h1>سياسة الخصوصية — الدليل الشامل</h1>'+privacy.split('\n\n').map(p=>'<p>'+escape(p).replace(/\n/g,'<br>')+'</p>').join('')+'<p><a href="/?delete-account=1">طلب حذف الحساب والبيانات</a></p><footer><a href="/">الدليل الشامل والدعم</a></footer></main>');fs.writeFileSync('public/privacy.html',page);console.log('Unified release privacy and terms staged.');
