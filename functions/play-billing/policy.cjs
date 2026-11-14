const crypto = require('node:crypto');
const catalog = require('./catalog.json');
const PACKAGE = catalog.packageName;
const PRODUCTS = Object.freeze(Object.fromEntries(catalog.products.map(product => [product.id, product])));
const LEGACY_PRODUCTS = Object.freeze(Object.fromEntries(
  ['starter','basic','premium','vip','company','elite','supplier_banner'].map(plan => [`eldalel_${plan}_annual`, {plan}])
));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const accountId = uid => hash(`eldalel-play:${uid}`);

function accountRole(member) {
  if (member.accountKind === 'customer' || (!member.accountKind && [member.type, member.plan].includes('customer'))) return 'customer';
  const legacy = !member.accountKind || member.accountKind === 'craftsman';
  return member.accountKind === 'supplier' || (legacy && ['supplier','company'].includes(member.type))
    ? 'supplier' : 'technician';
}

function allowsProduct(member, product) {
  const role = accountRole(member);
  return role !== 'customer' && (product.role
    ? product.role === role
    : catalog.products.some(entry => entry.role === role && entry.plan === product.plan));
}

function entitlement(purchase, uid, now = Date.now()) {
  if (purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== accountId(uid)) throw Error('account-mismatch');
  const items = (purchase.lineItems || []).filter(item => {
    const base = item.offerDetails?.basePlanId;
    return (Object.hasOwn(PRODUCTS, item.productId) && base === (PRODUCTS[item.productId].basePlanId || catalog.basePlanId) && item.autoRenewingPlan)
      || (Object.hasOwn(LEGACY_PRODUCTS, item.productId) && base === 'annual-prepaid' && item.prepaidPlan);
  });
  if (items.length !== 1) throw Error('unexpected-product');
  const item = items[0];
  const product = PRODUCTS[item.productId] || LEGACY_PRODUCTS[item.productId];
  const state = purchase.subscriptionState;
  const eligible = ['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(state);
  const expiry = Date.parse(item.expiryTime);
  if (eligible && !Number.isFinite(expiry)) throw Error('invalid-expiry');
  return {product, plan: product.plan, productId: item.productId, expiry: Number.isFinite(expiry) ? expiry : null, active: eligible && expiry > now, state};
}

module.exports = {PACKAGE, PRODUCTS, hash, accountId, accountRole, allowsProduct, entitlement};
