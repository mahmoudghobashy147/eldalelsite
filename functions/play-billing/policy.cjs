const crypto = require('node:crypto');
const PACKAGE = 'com.company.eldalelelshamel';
const PRODUCTS = Object.freeze(Object.fromEntries(['starter','basic','premium','vip','company','elite'].map(plan => [`eldalel_${plan}_annual`, plan])));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const accountId = uid => hash(`eldalel-play:${uid}`);
function entitlement(purchase, uid, now = Date.now()) {
  if (purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== accountId(uid)) throw Error('account-mismatch');
  const items = (purchase.lineItems || []).filter(item => PRODUCTS[item.productId] && item.offerDetails?.basePlanId === 'annual-prepaid');
  if (items.length !== 1) throw Error('unexpected-product');
  const item = items[0];
  const expiry = Date.parse(item.expiryTime);
  if (!Number.isFinite(expiry)) throw Error('invalid-expiry');
  const active = ['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(purchase.subscriptionState) && expiry > now;
  return {plan: PRODUCTS[item.productId], productId: item.productId, expiry, active, state: purchase.subscriptionState};
}
module.exports = {PACKAGE, PRODUCTS, hash, accountId, entitlement};
