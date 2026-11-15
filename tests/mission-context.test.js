import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactDigest, buildMissionHandoff } from '../lib/mission-context.js';

test('long specialist artifacts become bounded, source-linked handoffs', () => {
  const text = `START\n${'supplier evidence '.repeat(1200)}\nEND`;
  const context = buildMissionHandoff({
    memories: [{title:'Verified suppliers',content:'source-backed data',confidence:'verified',source_ref:'memory:1'}],
    artifacts: [{id:'job-1',runtime:'hermes',profile:'scout',role:'lead_scout',text}],
    maxChars: 3000,
  });
  assert.ok(context.length <= 3000);
  const parsed = JSON.parse(context);
  assert.equal(parsed.previousResults[0].digest, artifactDigest(text));
  assert.equal(parsed.previousResults[0].full_text_source_ref, 'hermes_job:job-1');
  assert.equal(parsed.previousResults[0].truncated, true);
  assert.match(parsed.previousResults[0].text_preview, /START/);
  assert.match(parsed.previousResults[0].text_preview, /END/);
});

test('short work products are preserved without truncation', () => {
  const parsed = JSON.parse(buildMissionHandoff({ artifacts: [{id:'job-2',runtime:'hermes',role:'outreach_lead',text:'complete sequence'}] }));
  assert.equal(parsed.previousResults[0].truncated, false);
  assert.equal(parsed.previousResults[0].text_preview, 'complete sequence');
});
