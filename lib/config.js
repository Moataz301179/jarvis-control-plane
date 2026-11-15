import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.resolve(process.env.JARVIS_ENV_FILE || '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const config = {
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379/2',
  ownerToken: required('JARVIS_OWNER_TOKEN'),
  workerId: required('JARVIS_WORKER_ID'),
  workerSecret: required('JARVIS_WORKER_SECRET'),
  port: Number(process.env.PORT || 3100),
  apiBaseUrl: process.env.JARVIS_API_URL || `http://127.0.0.1:${Number(process.env.PORT || 3100)}`,
  publicUiUrl: process.env.JARVIS_PUBLIC_URL || 'http://127.0.0.1:13100',
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  ollamaCloudUrl: process.env.OLLAMA_CLOUD_URL || 'https://ollama.com',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  openRouterUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  openRouterKey: process.env.OPENROUTER_API_KEY || '',
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
  macBridgeToken: process.env.JARVIS_MAC_BRIDGE_TOKEN || '',
  hermesBridgeToken: process.env.JARVIS_HERMES_BRIDGE_TOKEN || '',
  hermesCloudBridgeToken: process.env.JARVIS_HERMES_CLOUD_BRIDGE_TOKEN || '',
  agentRingUrl: process.env.AGENT_RING_URL ? String(process.env.AGENT_RING_URL).trim().replace(/\/+$/, '') : '',
  jarvisHealthUrl: process.env.JARVIS_HEALTH_URL || `http://127.0.0.1:${Number(process.env.PORT || 3100)}/health`,
  hotelsVendorsHealthUrl: process.env.HOTELS_VENDORS_HEALTH_URL || 'https://hotelsvendors.com/api/health',
  workerPollSeconds: Number(process.env.WORKER_POLL_SECONDS || 10),
  verifierPollSeconds: Number(process.env.VERIFIER_POLL_SECONDS || 3),
  operationsPollSeconds: Number(process.env.OPERATIONS_POLL_SECONDS || 15),
  backupDir: process.env.JARVIS_BACKUP_DIR || '/srv/jarvis/backups',
  zeroCostRequired: process.env.JARVIS_ZERO_COST_REQUIRED !== 'false',
};
