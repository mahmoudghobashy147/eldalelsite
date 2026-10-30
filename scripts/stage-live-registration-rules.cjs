const fs=require('node:fs');
const live='/tmp/production-firestore.rules';let s=fs.readFileSync(live,'utf8');
if(!s.includes('function uniqueLoginPhone(data)')){
 const start=s.indexOf('    function memberProtectedFieldsUnchanged() {');if(start<0)throw Error('Live protected member fields helper missing');s=s.slice(0,start)+fs.readFileSync('functions/phone-registration/legacy-rule.txt','utf8')+'\n'+s.slice(start);
}
if(!s.includes('self(memberId) && uniqueLoginPhone(request.resource.data)')){
 if(s.split('allow create: if self(memberId)').length!==2)throw Error('Live creation rule differs; review required');
 s=s.replace('allow create: if self(memberId)','allow create: if self(memberId) && uniqueLoginPhone(request.resource.data)');
}
const start=s.indexOf('    function memberProtectedFieldsUnchanged() {'),end=s.indexOf('\n    }',start);let block=s.slice(start,end);
if(!block.includes("'phoneNormalized'"))block=block.replace("'uid',","'uid',\n        'phone', 'phoneNormalized',");
if(!block.includes("'billingProvider'"))block=block.replace("'uid',","'uid',\n        'billingProvider', 'playTokenHash',");
s=s.slice(0,start)+block+s.slice(end);
// New billing attribution is server controlled on creation as well.
const member=s.indexOf('match /members/{memberId}'),create=s.indexOf('allow create:',member),update=s.indexOf('allow update:',create);let creation=s.slice(create,update);
if(!creation.includes("'billingProvider'"))creation=creation.replace("'isAdmin',","'isAdmin',\n          'billingProvider', 'playTokenHash',");
s=s.slice(0,create)+creation+s.slice(update);
fs.writeFileSync('firestore.rules',s);console.log('Prepared additive phone/billing protection against the current live Firestore rules; Storage unchanged.');
