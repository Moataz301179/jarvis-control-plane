import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionPlan } from '../lib/mission-orchestrator.js';

test('supplier campaign missions route through Scout, Campaign, Outreach and Sentinel', () => {
  const plan = createMissionPlan({
    projectCode: 'HV',
    outcome: 'Prepare a supplier acquisition campaign with verified targets and an approval-ready outreach sequence.',
    constraints: ['Preparation only', 'No sending or spend'],
    acceptanceCriteria: ['Verified suppliers', 'Campaign package', 'Outreach sequence', 'Independent review'],
  });
  assert.deepEqual(plan.delegations.map((item) => item.agentRole), ['lead_scout', 'campaign_director', 'outreach_lead', 'quality_sentinel']);
  assert.equal(plan.delegations.at(-1).phase, 'review');
  assert.equal(plan.delegations.some((item) => item.agentRole === 'implementation_lead'), false);
  assert.deepEqual(plan.delegations.map((item) => item.toolsets), [
    ['memory','file','todo','web'],
    ['memory','file','todo'],
    ['memory','file','todo'],
    ['memory','file','todo','web'],
  ]);
});

test('build missions route implementation and independent verification to different specialists', () => {
  const plan = createMissionPlan({ projectCode: 'STUDIO', outcome: 'Implement the API fix and run tests.', acceptanceCriteria: ['Tests pass', 'Diff exists'] });
  assert.deepEqual(plan.delegations.map((item) => item.agentRole), ['implementation_lead', 'quality_sentinel']);
  assert.notEqual(plan.delegations[0].agentRole, plan.delegations[1].agentRole);
});
