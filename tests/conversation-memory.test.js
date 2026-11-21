import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTranscript, extractiveSummary } = await import('../lib/conversation-memory.js');

test('transcript keeps role prefixes and respects the limit', () => {
  const text = buildTranscript([
    { role: 'user', content: 'Remember the code.' },
    { role: 'assistant', content: 'Noted.' },
  ]);
  assert.match(text, /^user: Remember the code\./);
  assert.match(text, /assistant: Noted\./);
  const capped = buildTranscript([{ role: 'user', content: 'x'.repeat(200) }], 50);
  assert.ok(capped.length <= 50);
});

test('extractive summary includes the first ask and the latest reply', () => {
  const summary = extractiveSummary([
    { role: 'user', content: 'Plan the deployment.' },
    { role: 'assistant', content: 'Deploy after tests pass.' },
  ]);
  assert.match(summary, /Owner asked: Plan the deployment\./);
  assert.match(summary, /JARVIS: Deploy after tests pass\./);
});

test('empty input yields an empty summary', () => {
  assert.equal(extractiveSummary([]), '');
});
