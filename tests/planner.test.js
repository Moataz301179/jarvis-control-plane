import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicPlan } from '../lib/planner.js';

test('health objectives probe JARVIS and HotelsVendors only', () => {
  const plan = deterministicPlan('Daily health', 'Check JARVIS and HotelsVendors status');
  assert.deepEqual(plan.tasks.map((task) => task.input.target), ['jarvis', 'hotelsvendors']);
});

test('unknown objectives use the safe baseline probe', () => {
  const plan = deterministicPlan('Other', 'Review a document');
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].tool, 'database_health');
});

test('runtime inventory objectives exercise independent safe tools', () => {
  const plan = deterministicPlan('Runtime audit', 'Inspect database health, runtime status and release inventory');
  assert.deepEqual(plan.tasks.map((task) => task.tool), ['database_health', 'release_inventory', 'service_status']);
});

test('backup objectives verify restore proof', () => {
  const plan = deterministicPlan('Backup gate', 'Verify backup and restore proof');
  assert.equal(plan.tasks[0].tool, 'backup_verify');
});
