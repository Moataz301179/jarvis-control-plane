import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';

process.env.DATABASE_URL ||= 'postgres://127.0.0.1:1/jarvis_test_offline';
process.env.JARVIS_OWNER_TOKEN ||= 'test-owner-token';
process.env.JARVIS_WORKER_ID ||= 'test-worker';
process.env.JARVIS_WORKER_SECRET ||= 'test-worker-secret';

const { assertTerminalCommand, terminalCommandViolation, resolveTerminalCwd } = await import('../lib/terminal-guard.js');

test('normal commands are allowed', () => {
  assert.equal(terminalCommandViolation('ls -la && npm test'), null);
  assert.equal(assertTerminalCommand('git status --short'), 'git status --short');
});

test('catastrophic commands are blocked', () => {
  for (const command of ['rm -rf /', 'rm -rf ~', 'mkfs.ext4 /dev/sda1', 'dd if=/dev/zero of=/dev/sda', 'diskutil eraseDisk JHFS+ X disk0', 'shutdown -h now', ':(){ :|:& };:']) {
    assert.notEqual(terminalCommandViolation(command), null, command);
  }
});

test('deleting the home tree is blocked', () => {
  assert.notEqual(terminalCommandViolation(`rm -rf ${os.homedir()}`), null);
});

test('empty and oversized commands are rejected', () => {
  assert.notEqual(terminalCommandViolation('   '), null);
  assert.notEqual(terminalCommandViolation('a'.repeat(4001)), null);
});

test('cwd is confined to home or /tmp', () => {
  const home = '/Users/tester';
  assert.equal(resolveTerminalCwd('~/work', home), '/Users/tester/work');
  assert.equal(resolveTerminalCwd('/tmp/job', home), '/tmp/job');
  assert.throws(() => resolveTerminalCwd('/etc', home));
  assert.throws(() => resolveTerminalCwd('relative/path', home));
});
