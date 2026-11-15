import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAgentDefinition, buildAgentAcceptance } from '../lib/agent-factory.js';

const valid = {
  slug: 'market-research', name: 'Market Research', project_code: 'STUDIO',
  model_provider: 'ollama-cloud', model: 'deepseek-v4.1-flash', hermes_profile: 'analyst',
  policy_profile: 'standard', approval_policy: 'require_owner', memory_scope: ['STUDIO'],
  tool_allowlist: ['web','browser','memory','todo'], skill_allowlist: [],
};

test('agent factory defaults to the configured Ollama Cloud route and returns activation criteria', () => {
  const result = validateAgentDefinition(valid);
  assert.equal(result.valid, true);
  assert.equal(result.definition.model_provider, 'ollama-cloud');
  assert.equal(buildAgentAcceptance(result.definition).length, 5);
});

test('agent factory rejects unknown tools, unsupported providers and cross-project memory', () => {
  assert.equal(validateAgentDefinition({ ...valid, tool_allowlist: ['shell'] }).valid, false);
  assert.equal(validateAgentDefinition({ ...valid, model_provider: 'claude' }).valid, false);
  assert.equal(validateAgentDefinition({ ...valid, model_provider: 'ollama' }).valid, false);
  assert.equal(validateAgentDefinition({ ...valid, memory_scope: ['HV'] }).valid, false);
});

test('privileged execution toolsets require owner approval', () => {
  const result = validateAgentDefinition({ ...valid, tool_allowlist: ['terminal'], approval_policy: 'standing_safe' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.includes('require owner approval')));
});

test('strict policy cannot enable filesystem or external-interaction toolsets', () => {
  const result = validateAgentDefinition({ ...valid, tool_allowlist: ['file','web'], policy_profile: 'strict', approval_policy: 'require_owner' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.includes('strict policy')));
});

test('workspace-mutating toolsets require an explicit authorized workspace', () => {
  const missing = validateAgentDefinition({ ...valid, tool_allowlist: ['file'] });
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((item) => item.includes('exact authorized workspace')));
  const scoped = validateAgentDefinition({ ...valid, tool_allowlist: ['file'], workspace: '/Users/Moatazi/Documents/ChatGPT/Jarvis' });
  assert.equal(scoped.valid, true);
});
