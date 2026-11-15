import test, { after } from 'node:test';
after(async () => { const { pool } = await import('../lib/db.js'); await pool.end(); });
import assert from 'node:assert/strict';

test('INTERVIEW_QUESTIONS covers the build plan context blocks', async () => {
  const mod = await import('../lib/business-profile.js');
  assert.ok(mod.INTERVIEW_QUESTIONS.length >= 8);
  for (const q of mod.INTERVIEW_QUESTIONS) {
    assert.ok(q.id && q.question, `question ${q.id} incomplete`);
  }
});

test('resolver rejects empty task and reports blockers when agent ring unset', async () => {
  const mod = await import('../lib/resolver.js');
  const result = await mod.resolveTask({ task: 'run a marketing campaign for HotelsVendors' });
  assert.ok(result.resolved_tools.length > 0, 'resolver should match campaign to tools');
  assert.ok(Object.hasOwn(result, 'owner_context_available'));
  assert.ok(Object.hasOwn(result, 'blockers'));
});

test('agent ring reports not configured when AGENT_RING_URL is unset', async () => {
  const mod = await import('../lib/agent-ring.js');
  const status = await mod.agentRingConfigured();
  if (!process.env.AGENT_RING_URL) {
    assert.equal(status.configured, false);
  } else {
    assert.equal(status.configured, true);
  }
});
