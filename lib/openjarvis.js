import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';

const execFileAsync = promisify(execFile);

const MAX_PROMPT = 20000;
const MAX_OUTPUT = 2 * 1024 * 1024;
const PROBE_TTL_MS = 30000;

// Only pass through what the OpenJarvis runtime needs. JARVIS_* secrets
// (DATABASE_URL, bridge tokens, owner token) must never reach a subprocess.
const ENV_ALLOWLIST = [
  'PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR',
  'OLLAMA_URL', 'OLLAMA_HOST',
  'OPENJARVIS_HOME', 'OPENJARVIS_CONFIG',
];

function settings() {
  const raw = config.openJarvis || {};
  return {
    enabled: raw.enabled === true,
    bin: String(raw.bin || '').trim(),
    projectDir: String(raw.projectDir || '').trim(),
    model: String(raw.model || '').trim(),
    tools: String(raw.tools || '').trim(),
    timeoutMs: Number(raw.timeoutMs) > 0 ? Number(raw.timeoutMs) : 120000,
  };
}

export function openJarvisSettings() {
  const value = settings();
  return {
    enabled: value.enabled,
    configured: Boolean(value.bin || value.projectDir),
    model: value.model || null,
    tools: value.tools || null,
    timeoutMs: value.timeoutMs,
  };
}

function invocation(value) {
  if (value.bin) return { command: value.bin, prefix: [] };
  if (value.projectDir) return { command: 'uv', prefix: ['run', '--project', value.projectDir, 'jarvis'] };
  return { command: 'jarvis', prefix: [] };
}

export function openJarvisEnv(env = process.env) {
  const result = {};
  for (const key of ENV_ALLOWLIST) {
    if (env[key] !== undefined) result[key] = env[key];
  }
  return result;
}

function firstLine(text) {
  return String(text || '').split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 200) || null;
}

let probeCache = null;

export async function openJarvisStatus({ force = false } = {}) {
  const value = settings();
  if (!value.enabled) {
    return { enabled: false, available: false, configured: Boolean(value.bin || value.projectDir), reason: 'disabled' };
  }
  if (!force && probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) return probeCache.value;

  const { command, prefix } = invocation(value);
  let status;
  try {
    const { stdout } = await execFileAsync(command, [...prefix, '--help'], {
      timeout: 15000,
      maxBuffer: MAX_OUTPUT,
      env: openJarvisEnv(),
    });
    status = { enabled: true, available: true, configured: true, command, model: value.model || null, help: firstLine(stdout) };
  } catch (error) {
    status = {
      enabled: true,
      available: false,
      configured: Boolean(value.bin || value.projectDir),
      command,
      reason: String(error.code || error.message || 'unavailable').slice(0, 200),
    };
  }
  probeCache = { at: Date.now(), value: status };
  return status;
}

export async function askOpenJarvis({ query, model } = {}) {
  const value = settings();
  if (!value.enabled) throw Object.assign(new Error('OpenJarvis runtime is disabled'), { statusCode: 424 });

  const prompt = typeof query === 'string' ? query.trim() : '';
  if (!prompt) throw Object.assign(new Error('query is required'), { statusCode: 400 });
  if (prompt.length > MAX_PROMPT) throw Object.assign(new Error('query exceeds 20000 characters'), { statusCode: 400 });

  const selectedModel = String(model || value.model || '').trim();
  if (selectedModel && !/^[A-Za-z0-9._:/+-]{1,120}$/.test(selectedModel)) {
    throw Object.assign(new Error('model is invalid'), { statusCode: 400 });
  }

  const { command, prefix } = invocation(value);
  if (value.tools && !/^[A-Za-z0-9_,.-]{1,200}$/.test(value.tools)) {
    throw Object.assign(new Error('tools is invalid'), { statusCode: 500 });
  }
  const args = [...prefix, 'ask', '--json', '--no-stream', ...(selectedModel ? ['-m', selectedModel] : []), ...(value.tools ? ['--tools', value.tools] : []), '--', prompt];

  let stdout;
  try {
    ({ stdout } = await execFileAsync(command, args, {
      timeout: value.timeoutMs,
      maxBuffer: MAX_OUTPUT,
      env: openJarvisEnv(),
    }));
  } catch (error) {
    const reason = String(error.stderr || error.message || 'OpenJarvis run failed').slice(0, 500);
    throw Object.assign(new Error(`OpenJarvis run failed: ${reason}`), { statusCode: 502 });
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw Object.assign(new Error('OpenJarvis returned malformed JSON'), { statusCode: 502 });
  }
  if (!parsed || typeof parsed !== 'object') {
    throw Object.assign(new Error('OpenJarvis returned an unexpected payload'), { statusCode: 502 });
  }

  const text = [parsed.content, parsed.response, parsed.text, parsed.output, parsed.answer]
    .find((candidate) => typeof candidate === 'string') ?? null;

  return {
    provider: 'openjarvis',
    model: parsed.model || selectedModel || null,
    text,
    usage: parsed.usage && typeof parsed.usage === 'object' ? parsed.usage : {},
    profile: parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : null,
  };
}
