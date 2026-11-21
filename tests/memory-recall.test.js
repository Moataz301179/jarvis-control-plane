import test from 'node:test';
import assert from 'node:assert/strict';

const { shouldRemember, memoryTitle, extractKeywords } = await import('../lib/memory-recall.js');

test('explicit memory requests are captured', () => {
  assert.equal(shouldRemember('Remember that my test code is BLUE-FALCON-42'), true);
  assert.equal(shouldRemember('Please note that the VPS is on Ubuntu 22.04'), true);
  assert.equal(shouldRemember('From now on answer in Arabic'), true);
  assert.equal(shouldRemember('My name is Moataz'), true);
});

test('ordinary questions are not captured', () => {
  assert.equal(shouldRemember('What is the status of the deployment?'), false);
  assert.equal(shouldRemember('OK'), false);
});

test('titles are trimmed', () => {
  assert.equal(memoryTitle('  Remember   that   X  '), 'Remember that X');
  assert.equal(memoryTitle('a'.repeat(300)).length, 120);
});

test('keywords drop stop words and short tokens', () => {
  assert.deepEqual(extractKeywords('What is my deployment status for hotelsvendors?'), ['deployment', 'status', 'hotelsvendors']);
});
