import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAgentModelRoute, resolveAutonomyRule, classifyAction } from '../lib/routing-policy.js';

const global = { provider: 'openrouter', model: 'openrouter/free' };

test('the most specific agent project task route wins', () => {
  const routes = [
    { id: 'global-agent', agent_id: 'hermes', project_code: '*', task_class: 'general', provider: 'inherit', model: '' },
    { id: 'hv-build', agent_id: 'hermes', project_code: 'HV', task_class: 'build', provider: 'ollama', model: 'llama3.2:latest' },
  ];
  const route = resolveAgentModelRoute(routes, global, { agentId: 'hermes', projectCode: 'HV', taskClass: 'build' });
  assert.equal(route.routeId, 'hv-build');
  assert.deepEqual({ provider: route.provider, model: route.model, source: route.source }, { provider: 'ollama', model: 'llama3.2:latest', source: 'agent_route' });
});

test('an inherited route follows the global zero-cost provider', () => {
  const routes = [{ id: 'general', agent_id: 'hermes', project_code: '*', task_class: 'general', provider: 'inherit', model: '' }];
  const route = resolveAgentModelRoute(routes, global, { agentId: 'hermes', projectCode: 'STUDIO', taskClass: 'general' });
  assert.equal(route.source, 'inherit');
  assert.equal(route.provider, 'openrouter');
  assert.equal(route.model, 'openrouter/free');
});

test('safe routines are autonomous while privileged actions need owner approval', () => {
  const rules = [
    { id: 'safe', action_key: 'routine_read', project_code: '*', decision: 'autonomous', risk_level: 'safe', description: 'Read only', enabled: true },
    { id: 'deploy', action_key: 'production_deploy', project_code: '*', decision: 'owner_approval', risk_level: 'danger', description: 'Production', enabled: true },
  ];
  assert.equal(resolveAutonomyRule(rules, { actionKey: 'routine_read', projectCode: 'HV', riskLevel: 'safe' }).decision, 'autonomous');
  assert.equal(resolveAutonomyRule(rules, { actionKey: 'production_deploy', projectCode: 'HV', riskLevel: 'danger' }).decision, 'owner_approval');
});

test('action classification escalates production and credentials', () => {
  assert.equal(classifyAction('Implement the dashboard in a branch'), 'sandbox_build');
  assert.equal(classifyAction('Deploy the release to production'), 'production_deploy');
  assert.equal(classifyAction('Rotate the API key'), 'credential_change');
});

test('authenticated browser writes require an owner decision', () => {
  assert.equal(classifyAction('Open LinkedIn and summarize my notifications'), 'routine_read');
  assert.equal(classifyAction('Update my LinkedIn headline'), 'external_commitment');
  assert.equal(classifyAction('Post the approved update to LinkedIn'), 'external_commitment');
});

test('negative preparation constraints do not become external actions', () => {
  assert.equal(classifyAction('Preparation only. No sending or spend. Do not publish or deploy. Use source-backed facts.'), 'routine_read');
  assert.equal(classifyAction('Preparation only. Paid spend, publishing and sends remain separate approvals.'), 'routine_read');
  assert.equal(classifyAction('Send the approved outreach email after owner approval.'), 'external_commitment');
  assert.equal(classifyAction('Preparation only, then send now.'), 'external_commitment');
});
