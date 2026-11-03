import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import {parse} from '@babel/parser';
import {transformSync} from '@babel/core';
import registrationPolicy from './registration-policy.js';
import RegistrationDetails,{RecentRegistrationFilter} from './RegistrationDetails';
import role from './account-role';
const source=fs.readFileSync(path.join(process.cwd(),'src/App.jsx'),'utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const declaration=ast.program.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='AdminScreen'));
if(!declaration)throw Error('Actual staged admin component missing');
const actual=source.slice(declaration.start,declaration.end);
function component(policy=registrationPolicy,section='dashboard',members=[]){
 const code=transformSync(actual.replace('useState("dashboard")','useState(initialSection)').replace('const [members, setMembers] = useState([]);','const [members, setMembers] = useState(fixtureMembers);'),{presets:[require.resolve('@babel/preset-react')],babelrc:false,configFile:false}).code;
 const cfg={adminPhone:'01000000000',planPrices:{starter:100,basic:200,vip:600}};
 const context={React,...React,useConfig:()=>cfg,C:new Proxy({},{get:()=> '#173e2d'}),registrationPolicy:policy,RegistrationDetails,RecentRegistrationFilter,...role,SafetyModeration:()=>null,initialSection:section,fixtureMembers:members,Av:({text})=><span>{text}</span>,getMemberPlan:m=>m.plan||m.type||'starter',getPlanPrice:()=>200,PLANS:{starter:{label:'مبتدئ'},basic:{label:'أساسي'},vip:{label:'VIP'}},GOVS:['القاهرة'],GOVERNORATES:['القاهرة']};
 return new Function('context',`with(context){${code};return AdminScreen;}`)(context);
}
function render(policy,section,members,darkMode=true){const Admin=component(policy,section,members);return renderToStaticMarkup(<Admin darkMode={darkMode} currentUser={{uid:'test-admin',isAdmin:true}}/>);}
test('reproduces the deployed crash when the bundler supplies the .cjs asset URL',()=>{expect(()=>render('/static/media/registration-policy.hash.cjs')).toThrow(/indexRegistrations.*not a function/);});
test.each([true,false])('actual admin dashboard opens with executable helper, dark=%s',dark=>{expect(render(registrationPolicy,'dashboard',[],dark)).toContain('لوحة إدارة الدليل الشامل');});
test('actual member and pending sections render registration details and preserve customer classification',()=>{const members=[{id:'old',name:'مشترك قديم',plan:'basic',type:'craftsman',status:'approved',createdAt:new Date(Date.now()-5*86400000),phone:'01000000001'},{id:'new',name:'مشترك جديد',plan:'starter',accountKind:'craftsman',status:'pending',createdAt:new Date(),phone:'01000000002'},{id:'client',name:'عميل مجاني',plan:'customer',type:'customer',accountKind:'customer',createdAt:new Date(),phone:'01000000003'}];expect(render(registrationPolicy,'members',members)).toContain('تاريخ التسجيل:');const pending=render(registrationPolicy,'pending',members);expect(pending).toContain('مشترك جديد');expect(pending).not.toContain('عميل مجاني');expect(pending).toContain('رقم التسجيل');});
