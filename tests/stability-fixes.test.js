import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://127.0.0.1:1/jarvis_test_offline';
process.env.JARVIS_OWNER_TOKEN ||= 'test-owner-token';
process.env.JARVIS_WORKER_ID ||= 'test-worker';
process.env.JARVIS_WORKER_SECRET ||= 'test-worker-secret';

const { parseCookies } = await import('../lib/auth.js');

test('malformed cookie escaping does not turn a valid request into a server error', () => {
  const cookies = parseCookies({ headers: { cookie: 'good=hello%20world; broken=%E0%A4%A; plain=value' } });
  assert.equal(cookies.good, 'hello world');
  assert.equal(cookies.broken, '%E0%A4%A');
  assert.equal(cookies.plain, 'value');
});
