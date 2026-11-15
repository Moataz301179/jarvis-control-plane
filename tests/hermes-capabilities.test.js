import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_HERMES_BROWSER_TOOLSETS, normalizeHermesToolsets } from '../lib/hermes-capabilities.js';

test('authenticated browser work allows the Hermes browser and account toolsets', () => {
  assert.deepEqual(normalizeHermesToolsets(['browser', 'connections', 'skills', 'browser', 'not-real']), ['browser', 'connections', 'skills']);
  assert.ok(DEFAULT_HERMES_BROWSER_TOOLSETS.includes('browser'));
  assert.ok(DEFAULT_HERMES_BROWSER_TOOLSETS.includes('connections'));
});

test('unsafe or unknown Hermes toolsets are rejected', () => {
  assert.deepEqual(normalizeHermesToolsets(['unknown', 'shell']), []);
  assert.deepEqual(normalizeHermesToolsets(['cronjob', 'a2a']), ['cronjob', 'a2a']);
});
