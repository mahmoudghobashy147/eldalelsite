// Account roles are independent of subscription tiers and legacy profile types.
const isCustomerAccount = member => member?.accountKind === 'customer' || (!member?.accountKind && (member?.type === 'customer' || member?.plan === 'customer'));
const isLegacyProfessional = member => !!member && !isCustomerAccount(member) && (!member.accountKind || member.accountKind === 'craftsman');
const accountRole = member => {
  if (isCustomerAccount(member)) return 'customer';
  if (member?.accountKind === 'supplier' || (isLegacyProfessional(member) && ['company', 'supplier'].includes(member.type))) return 'supplier';
  return 'technician';
};
const accountRoleLabel = member => {
  if (isLegacyProfessional(member)) {
    return ({company:'مشترك / شركة',engineer:'مشترك / مهندس',supplier:'مشترك / مورد',contractor:'مشترك / مقاول'}[member.type] || 'مشترك / صنايعي');
  }
  return ({customer:'عميل',technician:'صنايعي / فني',supplier:'مورد / شركة'})[accountRole(member)];
};
const canManageCatalog = member => !!member && (member.isAdmin === true || member.accountKind === 'supplier' || isLegacyProfessional(member));
const accountPlanLabel = (member, plans) => isCustomerAccount(member) ? 'باقة العميل — مجانية' : (plans?.[member?.plan || member?.type || 'starter']?.label || 'مبتدئ');
const needsPaidActivation = member => !!member && !isCustomerAccount(member);

module.exports = {isCustomerAccount, accountRole, accountRoleLabel, canManageCatalog, accountPlanLabel, needsPaidActivation};
