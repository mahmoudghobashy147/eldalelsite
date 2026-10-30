const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const parser=require('@babel/parser');
const source=fs.readFileSync('src/App.jsx','utf8');const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});let body;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='ObjectMethod'&&n.key?.name==='signUp')body=source.slice(n.body.start,n.body.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}walk(ast);
function fixture({duplicate=false,partial=false}={}){
 const calls=[];const auth={currentUser:partial?{uid:'same',email:'01012345678@daleel.app'}:null};
 const fn=vm.runInNewContext('(async function(email,password,data)'+body+')',{
 auth,functions:{},db:{},doc:()=>({}),getDoc:async()=>({exists:()=>false}),
 httpsCallable:(_,name)=>async data=>{calls.push(name);if(name==='assertMemberPhoneAvailable'&&duplicate){const e=Error('duplicate');e.code='functions/already-exists';throw e}},
 createUserWithEmailAndPassword:async()=>{calls.push('createAuth');return {user:{uid:'new',email:'01012345678@daleel.app'}}},
 updateProfile:async()=>{calls.push('displayName')},reauthenticateWithCredential:async()=>{calls.push('reauthenticate')},EmailAuthProvider:{credential:()=>({})},setDoc:()=>{throw Error('Direct profile write bypassed the server')}
 });return {fn,calls};
}
for(const accountKind of ['customer','craftsman'])test('duplicate '+accountKind+' signup stops before creating Auth',async()=>{const f=fixture({duplicate:true});await assert.rejects(f.fn('01012345678@daleel.app','secret123',{name:'اسم',phone:'01012345678',accountKind}),{code:'functions/already-exists'});assert.deepEqual(f.calls,['assertMemberPhoneAvailable'])});
test('new registration uses server completion instead of client profile writes',async()=>{const f=fixture();const result=await f.fn('01012345678@daleel.app','secret123',{name:'اسم',phone:'01012345678',accountKind:'customer'});assert.equal(result.user.uid,'new');assert.deepEqual(f.calls,['assertMemberPhoneAvailable','createAuth','displayName','completeMemberRegistration'])});
test('incomplete signed-in registration reauthenticates and resumes same UID',async()=>{const f=fixture({partial:true});const result=await f.fn('01012345678@daleel.app','secret123',{name:'اسم',phone:'01012345678',accountKind:'customer'});assert.equal(result.user.uid,'same');assert.equal(f.calls.includes('createAuth'),false);assert.equal(f.calls.includes('reauthenticate'),true);assert.equal(f.calls.at(-1),'completeMemberRegistration')});
