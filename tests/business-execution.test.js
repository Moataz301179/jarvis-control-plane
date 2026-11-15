import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignPackage, diagnosePerformance } from '../lib/business-execution.js';

test('campaign package contains the complete launch and rollback package', () => {
  const campaign = buildCampaignPackage({ project_code: 'HV', name: 'Hospitality pilot', recipients: ['buyer@example.com'] });
  assert.equal(campaign.project_code, 'HV');
  assert.equal(campaign.email_sequence.length, 3);
  assert.ok(campaign.assets.some((asset) => asset.type === 'landing_page'));
  assert.ok(campaign.kpis.some((kpi) => kpi.metric === 'attributed_revenue'));
  assert.ok(campaign.rollback.length >= 4);
  assert.equal(campaign.external_execution_possible, true);
});

test('diagnosis blocks an empty reporting source', () => {
  const diagnosis = diagnosePerformance([]);
  assert.equal(diagnosis.status, 'blocked');
  assert.match(diagnosis.diagnosis, /No measured performance source/);
});

test('diagnosis identifies weak outreach economics with measured snapshots', () => {
  const diagnosis = diagnosePerformance([{ revenue_amount: 100, cost_amount: 250, metrics: { emails_sent: 100, replies: 2, meetings: 1, conversions: 0 } }]);
  assert.equal(diagnosis.status, 'degraded');
  assert.equal(diagnosis.totals.profit, -150);
  assert.ok(diagnosis.issues.some((issue) => issue.includes('Reply rate')));
  assert.ok(diagnosis.actions.length > 0);
});

test('healthy diagnosis still returns a concrete scale action', () => {
  const diagnosis = diagnosePerformance([{ revenue_amount: 2000, cost_amount: 500, metrics: { emails_sent: 100, replies: 10, meetings: 4, conversions: 2 } }]);
  assert.equal(diagnosis.status, 'healthy');
  assert.match(diagnosis.actions[0], /scale/i);
});
