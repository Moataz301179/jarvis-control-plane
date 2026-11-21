import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://127.0.0.1:1/jarvis_test_offline';
process.env.JARVIS_OWNER_TOKEN ||= 'test-owner-token';
process.env.JARVIS_WORKER_ID ||= 'test-worker';
process.env.JARVIS_WORKER_SECRET ||= 'test-worker-secret';

const { normalizePhone, twimlEscape } = await import('../lib/agent-ring.js');

test('phone numbers normalize to E.164', () => {
  assert.equal(normalizePhone('+20 100 123 4567'), '+201001234567');
  assert.equal(normalizePhone('+1 (555) 123-4567'), '+15551234567');
});

test('invalid phone numbers are rejected', () => {
  assert.throws(() => normalizePhone('01001234567'));
  assert.throws(() => normalizePhone('+1'));
  assert.throws(() => normalizePhone(''));
});

test('TwiML escaping prevents markup injection', () => {
  assert.equal(twimlEscape('<b>Hi & "you"</b>'), '&lt;b&gt;Hi &amp; &quot;you&quot;&lt;/b&gt;');
});
