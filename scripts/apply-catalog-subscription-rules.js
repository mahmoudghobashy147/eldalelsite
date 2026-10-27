const fs=require('fs');
const fire='firestore.rules',storage='storage.rules';
let f=fs.readFileSync(fire,'utf8');
const firebaseFn=`    // A store owner needs an approved, unexpired subscription worth at least 600 EGP.
    function catalogEligible() {
      let member = get(memberDoc(request.auth.uid)).data;
      let plan = member.get('plan', member.get('type', 'starter'));
      let defaults = {'starter':0, 'basic':120, 'premium':250, 'vip':600, 'company':1000, 'elite':1500};
      let settingsPath = /databases/$(database)/documents/config/appSettings;
      let prices = exists(settingsPath) ? get(settingsPath).data.get('planPrices', {}) : {};
      let price = prices.get(plan, defaults.get(plan, 0));
      let end = member.get('subscriptionEnd', null);
      return member.get('status', '') == 'approved'
        && price is number && price >= 600
        && (end == null || (end is timestamp && end > request.time));
    }

`;
if(!f.includes('function catalogEligible()'))f=f.replace('    function onlyChanged(keys) {',firebaseFn+'    function onlyChanged(keys) {');
for(const name of ['catalogCategories','catalogBusinessRequests','catalogBusinesses','catalogProducts']){
 const start=f.indexOf('    match /'+name+'/');if(start<0)throw Error('Missing '+name);
 const next=f.indexOf('\n    match /',start+10),end=next<0?f.length:next;
 let block=f.slice(start,end),write=block.indexOf('      allow create:');if(write<0)throw Error('No write block '+name);
 let prefix=block.slice(0,write),tail=block.slice(write);
 if(!tail.includes('catalogEligible()'))tail=tail.replaceAll('(signedIn()', '(signedIn() && catalogEligible()').replace('allow create: if signedIn()','allow create: if signedIn() && catalogEligible()');
 f=f.slice(0,start)+prefix+tail+f.slice(end);
}
fs.writeFileSync(fire,f);
let s=fs.readFileSync(storage,'utf8');
const storageFn=`    function catalogEligible() {
      let member = firestore.get(/databases/(default)/documents/members/$(request.auth.uid)).data;
      let plan = member.get('plan', member.get('type', 'starter'));
      let defaults = {'starter':0, 'basic':120, 'premium':250, 'vip':600, 'company':1000, 'elite':1500};
      let settingsPath = /databases/(default)/documents/config/appSettings;
      let prices = firestore.exists(settingsPath) ? firestore.get(settingsPath).data.get('planPrices', {}) : {};
      let price = prices.get(plan, defaults.get(plan, 0));
      let end = member.get('subscriptionEnd', null);
      return member.get('status', '') == 'approved' && price is number && price >= 600
        && (end == null || (end is timestamp && end > request.time));
    }

`;
if(!s.includes('function catalogEligible()'))s=s.replace('    function imageUnder8MB() {',storageFn+'    function imageUnder8MB() {');
const start=s.indexOf('    match /catalog/owners/'),end=s.indexOf('\n    }',start);if(start<0||end<0)throw Error('Catalog owner storage rules missing');
let owner=s.slice(start,end);if(!owner.includes('catalogEligible()'))owner=owner.replaceAll('(signedIn() && request.auth.uid == ownerId)','(signedIn() && request.auth.uid == ownerId && catalogEligible())');
s=s.slice(0,start)+owner+s.slice(end);fs.writeFileSync(storage,s);
console.log('Catalog subscription checks staged in Firestore and Storage rules.');
