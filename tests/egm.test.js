import test from 'node:test';
import assert from 'node:assert/strict';
import { egmPrompt, normalizeEgmMode } from '../lib/egm.js';

test('EGM normalizes known workflows and rejects unknown commands', () => {
  assert.equal(normalizeEgmMode('review-loop'), 'review-loop');
  assert.equal(normalizeEgmMode(' REVIEW '), 'review');
  assert.equal(normalizeEgmMode('untrusted-command'), 'off');
});

test('EGM wraps missions with an explicit installed-plugin command', () => {
  const prompt = egmPrompt('review-loop', 'Audit JARVIS production readiness.');
  assert.match(prompt, /^\/egm:egm-review-loop/);
  assert.match(prompt, /Audit JARVIS production readiness/);
  assert.match(prompt, /Do not claim completion without concrete/);
});

test('EGM off mode preserves the original mission', () => {
  assert.equal(egmPrompt('off', 'Fix the health endpoint.'), 'Fix the health endpoint.');
});
