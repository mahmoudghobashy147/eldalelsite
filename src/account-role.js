// Account role is separate from the paid subscription tier. Keep legacy data intact.
const isCustomerAccount = member => member?.accountKind === 'customer' || (!member?.accountKind && (member?.type === 'customer' || member?.plan === 'customer'));
const accountRole = member => isCustomerAccount(member) ? 'customer' : 'professional';
const accountRoleLabel = member => isCustomerAccount(member) ? 'عميل' : ({company:'مشترك / شركة',engineer:'مشترك / مهندس',supplier:'مشترك / مورد',contractor:'مشترك / مقاول'}[member?.type] || 'مشترك / صنايعي');
const accountPlanLabel = (member, plans) => isCustomerAccount(member) ? 'باقة العميل — مجانية' : (plans?.[member?.plan || member?.type || 'starter']?.label || 'مبتدئ');
const needsPaidActivation = member => !!member && !isCustomerAccount(member);
module.exports = {isCustomerAccount, accountRole, accountRoleLabel, accountPlanLabel, needsPaidActivation};
