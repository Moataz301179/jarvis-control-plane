import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://127.0.0.1:1/jarvis_test_offline';
process.env.JARVIS_OWNER_TOKEN ||= 'test-owner-token';
process.env.JARVIS_WORKER_ID ||= 'test-worker';
process.env.JARVIS_WORKER_SECRET ||= 'test-worker-secret';

const { targetAllowed, validateToolRequest, isPrivateAddress, extractHost } = await import('../lib/linux-tools.js');

const scope = { domains: ['hotelsvendors.com'], ips: ['203.0.113.10'], cidrs: [] };

test('private and loopback targets are allowed', () => {
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('192.168.1.5'), true);
  assert.equal(targetAllowed('localhost', scope), true);
  assert.equal(targetAllowed('10.0.0.5', scope), true);
});

test('allowlisted domains and IPs are allowed, subdomains included', () => {
  assert.equal(targetAllowed('hotelsvendors.com', scope), true);
  assert.equal(targetAllowed('api.hotelsvendors.com', scope), true);
  assert.equal(targetAllowed('203.0.113.10', scope), true);
});

test('external targets outside scope are denied', () => {
  assert.equal(targetAllowed('example.com', scope), false);
  assert.equal(targetAllowed('8.8.8.8', scope), false);
});

test('URL hosts are extracted and validated', () => {
  assert.equal(extractHost('https://api.hotelsvendors.com/path'), 'api.hotelsvendors.com');
  assert.equal(targetAllowed('https://api.hotelsvendors.com/path', scope), true);
});

test('tool requests build allowlisted arguments', () => {
  const request = validateToolRequest({ tool: 'nmap', target: '127.0.0.1', options: ['-sV', '-F'] }, scope);
  assert.equal(request.bin, 'nmap');
  assert.deepEqual(request.args, ['-sV', '-F', '127.0.0.1']);
  const dig = validateToolRequest({ tool: 'dig', target: 'localhost', options: ['+short'] }, scope);
  assert.deepEqual(dig.args, ['localhost', '+short']);
});

test('non-allowlisted flags and tools are rejected', () => {
  assert.throws(() => validateToolRequest({ tool: 'nmap', target: '127.0.0.1', options: ['--script=all'] }, scope));
  assert.throws(() => validateToolRequest({ tool: 'metasploit', target: '127.0.0.1' }, scope));
});

test('out-of-scope targets are rejected before execution', () => {
  assert.throws(() => validateToolRequest({ tool: 'nmap', target: '8.8.8.8' }, scope), (error) => error.statusCode === 403);
});
