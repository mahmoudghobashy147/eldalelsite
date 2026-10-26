const fs=require('fs');const file='src/App.jsx';let s=fs.readFileSync(file,'utf8');
const imp='import MainCategories from "./MainCategories";';
if(!s.includes(imp))s=imp+'\n'+s;
if(!s.includes('<MainCategories onNavigate=')){
 const start=s.indexOf('      <div data-home-main-sections="true"');
 const end=s.indexOf('      {/* كتالوج مواد التشطيب —',start);
 if(start<0||end<0)throw Error('Expected one original homepage main-category block');
 s=s.slice(0,start)+'      <div className={isDesktop?"desktop-container":"section"}><MainCategories onNavigate={onNavigate} darkMode={darkMode}/></div>\n\n'+s.slice(end);
}
fs.writeFileSync(file,s);console.log('Realistic category cards integrated; original navigation preserved.');
