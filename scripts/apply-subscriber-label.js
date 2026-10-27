const fs=require('fs');
const file='src/App.jsx';let s=fs.readFileSync(file,'utf8');
const old='تسجيل كصنايعي', next='تسجيل كمشترك';
const count=s.split(old).length-1;
if(count===2){s=s.split(old).join(next);fs.writeFileSync(file,s);}
else if(count===0 && s.split(next).length-1>=2){} else throw Error('Unexpected subscriber registration labels: '+count);
console.log('Subscriber registration labels ready.');
