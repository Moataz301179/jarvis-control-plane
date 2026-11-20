import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATABASE_URL ||= 'postgres://127.0.0.1:1/jarvis_test_offline';
process.env.JARVIS_OWNER_TOKEN ||= 'test-owner-token';
process.env.JARVIS_WORKER_ID ||= 'test-worker';
process.env.JARVIS_WORKER_SECRET ||= 'test-worker-secret';

const stub = path.join(os.tmpdir(), `jarvis-openjarvis-stub-${process.pid}.sh`);
fs.writeFileSync(
  stub,
  [
    '#!/bin/sh',
    'if [ "$1" = "--help" ]; then echo "Usage: jarvis [OPTIONS]"; exit 0; fi',
    'for a in "$@"; do',
    '  if [ "$a" = "ask" ]; then',
    '    echo \'{"response":"hello from openjarvis","model":"qwen2.5-coder:7b","usage":{"cost":0}}\'',
    '    exit 0',
    '  fi',
    'done',
    'echo \'{"response":"ok"}\'',
    '',
  ].join('\n'),
);
fs.chmodSync(stub, 0o755);

process.env.JARVIS_OPENJARVIS_ENABLED = 'true';
process.env.JARVIS_OPENJARVIS_BIN = stub;
process.env.JARVIS_OPENJARVIS_MODEL = 'qwen2.5-coder:7b';
process.env.JARVIS_OPENJARVIS_TOOLS = 'browser,http_request';

const { askOpenJarvis, openJarvisStatus, openJarvisEnv, openJarvisSettings } = await import('../lib/openjarvis.js');

test('settings expose the configured tool list', () => {
  assert.equal(openJarvisSettings().tools, 'browser,http_request');
});

test('status reports the configured runtime as available', async () => {
  const status = await openJarvisStatus({ force: true });
  assert.equal(status.enabled, true);
  assert.equal(status.available, true);
});

test('ask returns the parsed response and usage', async () => {
  const result = await askOpenJarvis({ query: 'hello' });
  assert.equal(result.provider, 'openjarvis');
  assert.equal(result.text, 'hello from openjarvis');
  assert.equal(result.model, 'qwen2.5-coder:7b');
  assert.equal(result.usage.cost, 0);
});

test('ask rejects an empty query', async () => {
  await assert.rejects(() => askOpenJarvis({ query: '   ' }), (error) => error.statusCode === 400);
});

test('ask rejects an invalid model name', async () => {
  await assert.rejects(
    () => askOpenJarvis({ query: 'hi', model: 'bad model; rm -rf /' }),
    (error) => error.statusCode === 400,
  );
});

test('subprocess environment never forwards JARVIS secrets', () => {
  const env = openJarvisEnv({
    PATH: '/bin',
    DATABASE_URL: 'postgres://secret',
    JARVIS_OWNER_TOKEN: 'secret',
    OLLAMA_URL: 'http://127.0.0.1:11434',
  });
  assert.deepEqual(env, { PATH: '/bin', OLLAMA_URL: 'http://127.0.0.1:11434' });
});
