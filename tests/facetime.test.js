import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeFaceTimeTarget, faceTimeUrl, maskFaceTimeTarget } = await import('../lib/facetime.js');

test('accepts Apple ID emails', () => {
  assert.deepEqual(normalizeFaceTimeTarget('moataz@icloud.com'), { target: 'moataz@icloud.com', type: 'email' });
});

test('accepts international phone numbers', () => {
  assert.deepEqual(normalizeFaceTimeTarget('+20 100 123 4567'), { target: '+201001234567', type: 'phone' });
});

test('rejects local numbers and junk', () => {
  assert.throws(() => normalizeFaceTimeTarget('01001234567'));
  assert.throws(() => normalizeFaceTimeTarget('not-a-target'));
  assert.throws(() => normalizeFaceTimeTarget(''));
});

test('builds audio and video URLs', () => {
  assert.equal(faceTimeUrl('+201001234567', 'audio'), 'facetime-audio://+201001234567');
  assert.equal(faceTimeUrl('+201001234567', 'video'), 'facetime://+201001234567');
  assert.equal(faceTimeUrl('a@b.com', 'audio'), 'facetime-audio://a@b.com');
});

test('masks targets for display', () => {
  assert.match(maskFaceTimeTarget('+201001234567'), /^\+20•+567$/);
  assert.match(maskFaceTimeTarget('moataz@icloud.com'), /^mo•+@icloud\.com$/);
});
