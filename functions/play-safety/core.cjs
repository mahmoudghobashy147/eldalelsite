'use strict';
const { createHash } = require('node:crypto');
class SafetyError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function identifier(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 128 || /[\/\u0000-\u001f\u007f]/.test(value) || value === '.' || value === '..') {
    throw new SafetyError('invalid-argument', 'معرّف غير صالح');
  }
  return value;
}
function authenticated(request) {
  if (!request.auth?.uid) throw new SafetyError('unauthenticated', 'سجل الدخول أولًا');
  return identifier(request.auth.uid);
}
function exact(data, allowed) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !allowed.includes(k))) {
    throw new SafetyError('invalid-argument', 'بيانات غير صالحة');
  }
}
function digest(parts) { return createHash('sha256').update(JSON.stringify(parts)).digest('hex'); }
function reportInput(request) {
  const uid = authenticated(request);
  const data = request.data;
  exact(data, ['targetType', 'targetId', 'reason', 'details']);
  if (!['post', 'member'].includes(data.targetType) || !['spam', 'harassment', 'fraud', 'unsafe', 'other'].includes(data.reason)) {
    throw new SafetyError('invalid-argument', 'اختر نوع البلاغ وسببه');
  }
  const targetId = identifier(data.targetId);
  const details = data.details === undefined ? '' : data.details;
  if (typeof details !== 'string' || details.length > 1500 || (data.reason === 'other' && details.trim().length < 5)) {
    throw new SafetyError('invalid-argument', 'تفاصيل البلاغ غير صالحة');
  }
  return { reporterId: uid, targetType: data.targetType, targetId, reason: data.reason, details: details.trim(), id: digest([uid, data.targetType, targetId]) };
}
function blockInput(request) {
  const uid = authenticated(request);
  exact(request.data, ['targetId', 'blocked']);
  const targetId = identifier(request.data.targetId);
  if (targetId === uid || typeof request.data.blocked !== 'boolean') throw new SafetyError('invalid-argument', 'طلب الحظر غير صالح');
  return { uid, targetId, blocked: request.data.blocked, id: digest([uid, targetId]) };
}
function deletionInput(request, nowSeconds) {
  const uid = authenticated(request);
  exact(request.data, ['confirmation']);
  if (request.data.confirmation !== 'DELETE') throw new SafetyError('invalid-argument', 'أكد طلب حذف الحساب');
  const authTime = request.auth.token?.auth_time;
  if (!Number.isFinite(authTime) || authTime > nowSeconds + 60 || nowSeconds - authTime > 300) {
    throw new SafetyError('failed-precondition', 'سجل الدخول من جديد لتأكيد هويتك');
  }
  return { uid };
}
module.exports = { SafetyError, identifier, reportInput, blockInput, deletionInput, digest };
