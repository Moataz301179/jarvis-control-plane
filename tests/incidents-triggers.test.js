import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIncident, incidentDedupeKey } from '../lib/incident-policy.js';
import { triggerHandlerFor } from '../lib/trigger-policy.js';

test('evidence failures fail closed as critical', () => {
  const incident = classifyIncident('Verification failed: commit claim not found', { projectCode: 'HV', sourceType: 'hermes_job', sourceId: 'job-1' });
  assert.equal(incident.failureClass, 'evidence');
  assert.equal(incident.severity, 'critical');
  assert.equal(incident.repairAction, 'independent_recheck');
  assert.equal(incidentDedupeKey(incident), 'HV:evidence:hermes_job:job-1');
});

test('policy failures require an owner decision', () => {
  const incident = classifyIncident('permission required: deployment:approve', { projectCode: 'HV' });
  assert.equal(incident.failureClass, 'policy');
  assert.equal(incident.repairAction, 'owner_decision');
});

test('unknown triggers are rejected and known triggers have one handler', () => {
  assert.equal(triggerHandlerFor('task.verification_failed'), 'incident');
  assert.equal(triggerHandlerFor('deployment.requested'), 'notify');
  assert.equal(triggerHandlerFor('made.up.event'), null);
});
