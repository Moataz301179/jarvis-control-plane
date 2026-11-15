import test from 'node:test';
import assert from 'node:assert/strict';
import { HERMES_TEAM, routeHermesTask, teamMember } from '../lib/hermes-team.js';

test('Hermes Office has distinct specialist profiles with field ownership', () => {
  assert.equal(HERMES_TEAM.length, 16);
  assert.equal(new Set(HERMES_TEAM.map((member) => member.profile)).size, 16);
  assert.ok(HERMES_TEAM.every((member) => member.expertise.length >= 3));
  assert.ok(HERMES_TEAM.every((member) => member.toolsets.length >= 5));
  assert.equal(teamMember('sentinel').role, 'quality_sentinel');
});

test('business outcomes route to the specialist rather than a generic agent', () => {
  assert.equal(routeHermesTask({ instruction: 'Find and verify Egyptian hotel suppliers' }).profile, 'scout');
  assert.equal(routeHermesTask({ instruction: 'Write an email outreach sequence for qualified suppliers' }).profile, 'outreach');
  assert.equal(routeHermesTask({ instruction: 'Create the full campaign launch and optimization plan' }).profile, 'campaign');
  assert.equal(routeHermesTask({ instruction: 'Implement the API change and run tests' }).profile, 'builder');
  assert.equal(routeHermesTask({ instruction: 'Report revenue and diagnose campaign conversion' }).profile, 'analyst');
  assert.equal(routeHermesTask({ instruction: 'Verify every acceptance criterion independently' }).profile, 'sentinel');
  assert.equal(routeHermesTask({ instruction: 'Deploy the approved release and verify health' }).profile, 'release');
  assert.equal(routeHermesTask({ instruction: 'Recover from an offline VPS incident' }).profile, 'recovery');
  assert.equal(routeHermesTask({ instruction: 'Build a business intelligence dashboard and metric pipeline' }).profile, 'bi');
  assert.equal(routeHermesTask({ instruction: 'Normalize the supplier master registry and preserve source provenance' }).profile, 'data');
  assert.equal(routeHermesTask({ instruction: 'Review ETA integration and e-invoicing compliance' }).profile, 'compliance');
});
