const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const parser=require('@babel/parser');
const role=require('../src/account-role.js');const source=fs.readFileSync('src/App.jsx','utf8');const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const functions=new Map();function walk(node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator'&&['approveMember','renewMemberSubscription','changeMemberType','cancelSubscription'].includes(node.id?.name))functions.set(node.id.name,source.slice(node.init.start,node.init.end));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value)}walk(ast);
for(const name of ['approveMember','renewMemberSubscription','changeMemberType','cancelSubscription'])test(name+' does not create charges or write subscriptions for a customer',async()=>{
 for(const member of [{id:'customer',accountKind:'customer',plan:'starter'},{id:'customer',accountKind:'customer',plan:'vip'},{id:'customer',type:'customer'}]){
  let writes=0,notice='';const unexpected=()=>{writes++;throw Error('Unexpected paid operation')};
  const fn=vm.runInNewContext('('+functions.get(name)+')',{members:[member],needsPaidActivation:role.needsPaidActivation,setConfirmModal:()=>{},alert:text=>{notice=text},updateDoc:unexpected,addDoc:unexpected,window:{confirm:unexpected}});
  await fn('customer',name==='changeMemberType'?'basic':365);assert.equal(writes,0);assert.match(notice,/باقة العميل مجانية/);
 }
});
