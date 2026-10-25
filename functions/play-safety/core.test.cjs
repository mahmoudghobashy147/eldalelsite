'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reportInput, blockInput, deletionInput, identifier, digest } = require('./core.cjs');
const request = data => ({ auth: { uid: 'alice', token: { auth_time: 1000 } }, data });
const valid = { targetType: 'post', targetId: 'post-1', reason: 'spam' };
test('anonymous actions fail before validation', () => {
  for (const fn of [reportInput, blockInput, deletionInput]) assert.throws(() => fn({ data: {} }, 1000), { code: 'unauthenticated' });
});
test('report identity and status cannot be supplied by client', () => {
  for (const field of ['reporterId', 'status', 'createdAt']) assert.throws(() => reportInput(request({ ...valid, [field]: 'attacker' })), { code: 'invalid-argument' });
  assert.equal(reportInput(request(valid)).reporterId, 'alice');
});
test('duplicate reports retain one id regardless of changed reason', () => {
  assert.equal(reportInput(request(valid)).id, reportInput(request({ ...valid, reason: 'fraud' })).id);
  assert.notEqual(reportInput(request(valid)).id, reportInput({ auth: { uid: 'bob' }, data: valid }).id);
});
test('reject document traversal, malformed ids and unbounded text', () => {
  for (const id of ['', '../members', '.', '..', 'x/y', 'x\n', ' x', 'x'.repeat(129), {}, 12]) assert.throws(() => identifier(id), { code: 'invalid-argument' });
  for (const data of [{ ...valid, details: 'x'.repeat(1501) }, { ...valid, reason: 'other' }, { ...valid, targetType: 'chat' }, { ...valid, reason: 'invented' }]) assert.throws(() => reportInput(request(data)), { code: 'invalid-argument' });
});
test('blocking cannot impersonate another user or block self', () => {
  for (const data of [{ targetId: 'alice', blocked: true }, { targetId: 'bob', blocked: 'true' }, { targetId: 'bob', blocked: true, uid: 'eve' }]) assert.throws(() => blockInput(request(data)), { code: 'invalid-argument' });
  assert.equal(blockInput(request({ targetId: 'bob', blocked: false })).blocked, false);
  assert.notEqual(digest(['a_b', 'c']), digest(['a', 'b_c']));
});
test('deletion requires recent server auth time and explicit confirmation', () => {
  assert.deepEqual(deletionInput(request({ confirmation: 'DELETE' }), 1100), { uid: 'alice' });
  for (const now of [1301, 900]) assert.throws(() => deletionInput(request({ confirmation: 'DELETE' }), now), { code: 'failed-precondition' });
  assert.throws(() => deletionInput(request({ confirmation: 'yes' }), 1100), { code: 'invalid-argument' });
  assert.throws(() => deletionInput({ auth: { uid: 'alice' }, data: { confirmation: 'DELETE' } }, 1100), { code: 'failed-precondition' });
});
