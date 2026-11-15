import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExecutionPreflight } from '../lib/execution-preflight.js';

const now = Date.parse('2026-11-12T12:00:00.000Z');

test('Hermes preflight passes only with an online bridge, fresh heartbeat and connected toolsets', () => {
  const result = evaluateExecutionPreflight({
    runtime: 'hermes',
    projectCode: 'STUDIO',
    bridge: { gateway_status: 'online', last_seen: '2026-11-12T11:59:30.000Z' },
    capabilities: [
      { capability_type: 'toolset', capability_key: 'browser', status: 'connected' },
      { capability_type: 'toolset', capability_key: 'web', status: 'connected' },
    ],
    requiredToolsets: ['browser', 'web'],
    now,
  });
  assert.equal(result.ready, true);
  assert.equal(result.blockers.length, 0);
  assert.match(result.receipt_id, /^[a-f0-9]{64}$/);
});

test('Hermes preflight reports every first-step blocker before dispatch', () => {
  const result = evaluateExecutionPreflight({
    runtime: 'hermes',
    projectCode: 'STUDIO',
    bridge: { gateway_status: 'offline', last_seen: '2026-11-12T11:55:00.000Z' },
    capabilities: [{ capability_type: 'toolset', capability_key: 'web', status: 'connected' }],
    requiredToolsets: ['browser', 'web'],
    requiredAccountConnections: [{ service: 'LinkedIn', account_alias: 'personal' }],
    accountConnections: [{ service: 'LinkedIn', account_alias: 'personal', status: 'failed', expires_at: '2026-11-12T13:00:00.000Z' }],
    now,
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers.map((item) => item.id), ['bridge_online', 'heartbeat_fresh', 'toolset:browser', 'account:linkedin:personal']);
});

test('Mac preflight verifies the exact advertised action', () => {
  const result = evaluateExecutionPreflight({
    runtime: 'mac',
    projectCode: 'STUDIO',
    bridge: { status: 'online', last_seen: '2026-11-12T11:59:55.000Z' },
    capabilities: ['browser_profile_login', 'codex_agent'],
    requiredMacActions: ['browser_profile_login'],
    now,
  });
  assert.equal(result.ready, true);
});
