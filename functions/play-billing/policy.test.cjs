const {test} = require('node:test');
const assert = require('node:assert/strict');
const {accountId,entitlement,PRODUCTS} = require('./policy.cjs');
const now = Date.now();
const purchase = (state='SUBSCRIPTION_STATE_ACTIVE') => ({subscriptionState:state,externalAccountIdentifiers:{obfuscatedExternalAccountId:accountId('a')},lineItems:[{productId:'craftsman_200_yearly',autoRenewingPlan:{},offerDetails:{basePlanId:'annual'},expiryTime:new Date(now+100000).toISOString()}]});
test('eight annual plans map only to known entitlements',()=>assert.equal(Object.keys(PRODUCTS).length,8));
test('purchase is bound to the signed-in account',()=>assert.throws(()=>entitlement(purchase(),'b',now),/account-mismatch/));
test('basic grants correct plan',()=>assert.equal(entitlement(purchase(),'a',now).plan,'basic'));
for (const state of ['SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_EXPIRED']) test(state+' never grants',()=>assert.equal(entitlement(purchase(state),'a',now).active,false));
test('cancelled retains access only until expiry',()=>{const p=purchase('SUBSCRIPTION_STATE_CANCELED');assert.equal(entitlement(p,'a',now).active,true);assert.equal(entitlement(p,'a',now+200000).active,false)});
test('unconfigured base plans cannot grant',()=>{const p=purchase();p.lineItems[0].offerDetails.basePlanId='unexpected';assert.throws(()=>entitlement(p,'a',now))});

test('supplier 600 rejects the monthly base plan and accepts annual-eg', () => {
  const p = purchase();
  p.lineItems[0].productId = 'supplier_600_yearly';
  assert.throws(() => entitlement(p,'a',now), /unexpected-product/);
  p.lineItems[0].offerDetails.basePlanId = 'annual-eg';
  assert.equal(entitlement(p,'a',now).plan, 'vip');
});

test('legacy prepaid purchases remain restorable', () => {
  const p = purchase();
  p.lineItems[0] = {...p.lineItems[0], productId:'eldalel_basic_annual', prepaidPlan:{}, offerDetails:{basePlanId:'annual-prepaid'}};
  assert.equal(entitlement(p,'a',now).active,true);
});
