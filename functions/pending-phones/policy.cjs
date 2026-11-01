'use strict';
const crypto=require('node:crypto');
const {normalizePhone}=require('../phone-registration/policy.cjs');
const customer=m=>m.accountKind==='customer'||(!m.accountKind&&(m.type==='customer'||m.plan==='customer'));
const pending=m=>!!m&&!customer(m)&&m.isAdmin!==true&&(!m.status||m.status==='pending');
function phoneOnly(m){return pending(m)?normalizePhone(m.phoneNormalized)||normalizePhone(m.phone)||null:null;}
function permitted(role){return role?.active===true&&role.pendingPhoneViewer===true&&/^[a-f0-9]{64}$/.test(role.cursorKey||'');}
function seal(lastId,key,uid,now=Date.now()){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);cipher.setAAD(Buffer.from(uid));
 const content=Buffer.concat([cipher.update(JSON.stringify({lastId,expires:now+900000}),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),content]).toString('base64url');
}
function unseal(token,key,uid,now=Date.now()){
 if(typeof token!=='string'||token.length>2048||!token.match(/^[A-Za-z0-9_-]+$/))throw Error('cursor');
 const b=Buffer.from(token,'base64url');if(b.length<30)throw Error('cursor');
 const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),b.subarray(0,12));decipher.setAAD(Buffer.from(uid));decipher.setAuthTag(b.subarray(12,28));
 const data=JSON.parse(Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString());
 if(typeof data.lastId!=='string'||!data.lastId||data.lastId.includes('/')||data.lastId.length>1500||!Number.isFinite(data.expires)||data.expires<=now)throw Error('cursor');
 return data.lastId;
}
module.exports={pending,phoneOnly,permitted,seal,unseal};
