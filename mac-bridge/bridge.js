import { installProcessGuards } from '../lib/process-guard.js';
installProcessGuards('mac-bridge');
import { terminalCommandViolation, resolveTerminalCwd } from '../lib/terminal-guard.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const home = os.homedir();
const envPath = path.join(home, 'Library', 'Application Support', 'JarvisMacBridge', '.env');
const CODEX_BINARY = process.env.CODEX_BINARY || path.join(home, '.local', 'bin', 'codex');
const CLAUDE_BINARY = process.env.CLAUDE_BINARY || path.join(home, '.local', 'bin', 'claude');
const AGENT_BROWSER_BINARY = process.env.AGENT_BROWSER_BINARY || path.join(home, '.hermes', 'tools', 'agent-browser-0.26.0-darwin-arm64', 'bin', 'agent-browser.js');
const JARVIS_BROWSER_PROFILE = process.env.JARVIS_BROWSER_PROFILE || path.join(home, '.hermes', 'browser-profile', 'chrome');
const PROJECT_WORKSPACE_ROOTS = {
  STUDIO: path.join(home, 'Documents', 'ChatGPT'),
  HV: path.join(home, 'hotels-vendors-new'),
};

async function loadEnv() {
  try {
    for (const line of (await fs.readFile(envPath, 'utf8')).split(/\r?\n/)) {
      const index = line.indexOf('=');
      if (index > 0) process.env[line.slice(0, index).trim()] ||= line.slice(index + 1).trim();
    }
  } catch {}
}
await loadEnv();

const token = process.env.JARVIS_MAC_BRIDGE_TOKEN;
const baseUrl = process.env.JARVIS_BASE_URL || 'http://127.0.0.1:13100';
if (!token) throw new Error('JARVIS_MAC_BRIDGE_TOKEN is required');

const capabilities = ['open_terminal','list_files','disk_inventory','create_folder','arrange_photos','move_files','clean_temp_files','trash_file','cursor_status','cursor_open','cursor_agent','codex_agent','claude_agent','openjarvis_ask','terminal_command','scan_network','organize_folder','delete_old_files','facetime_call','remote_desktop_device','browser_profile_login','browser_profile_probe'];
let stopping = false;

function withinHome(target) {
  const resolved = path.resolve(String(target));
  if (resolved !== home && !resolved.startsWith(home + path.sep)) throw new Error('Target must be inside the current user home directory');
  return resolved;
}

function withinProjectWorkspace(target, projectCode) {
  const project = String(projectCode || '').toUpperCase();
  const root = PROJECT_WORKSPACE_ROOTS[project];
  if (!root) throw new Error('Unknown project workspace');
  const resolved = path.resolve(String(target));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Workspace is outside project ${project}`);
  return resolved;
}

async function gitValue(cwd, args) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], { timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
    return String(stdout || '').trim();
  } catch {
    return null;
  }
}

async function workspaceEvidence(cwd) {
  const [commit, branch, status, changedFiles, diffStat] = await Promise.all([
    gitValue(cwd, ['rev-parse', 'HEAD']),
    gitValue(cwd, ['branch', '--show-current']),
    gitValue(cwd, ['status', '--porcelain=v1']),
    gitValue(cwd, ['diff', '--name-only', 'HEAD']),
    gitValue(cwd, ['diff', '--stat', 'HEAD']),
  ]);
  return {
    cwd,
    commit,
    branch,
    dirty: Boolean(status),
    status: status || '',
    changedFiles: changedFiles ? changedFiles.split('\n').filter(Boolean).slice(0, 500) : [],
    diffStat: diffStat || '',
    capturedAt: new Date().toISOString(),
  };
}

async function openRouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const { stdout } = await execFileAsync('/usr/bin/security', ['find-generic-password', '-s', 'jarvis-openrouter', '-w'], { timeout: 5000 });
    return String(stdout || '').trim();
  } catch {
    return '';
  }
}

function runWithInput(command, args, { cwd, env, timeout = 10 * 60 * 1000, maxBuffer = 12 * 1024 * 1024, input = '' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) child.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${timeout}ms`));
      settled = true;
    }, timeout);
    const append = (current, chunk) => {
      const next = current + chunk.toString();
      if (Buffer.byteLength(next) > maxBuffer) {
        child.kill('SIGTERM');
        throw new Error(`${command} output exceeded ${maxBuffer} bytes`);
      }
      return next;
    };
    child.stdout.on('data', (chunk) => { try { stdout = append(stdout, chunk); } catch (error) { reject(error); } });
    child.stderr.on('data', (chunk) => { try { stderr = append(stderr, chunk); } catch (error) { reject(error); } });
    child.on('error', (error) => { clearTimeout(timer); if (!settled) reject(error); settled = true; });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ stdout, stderr, code, signal });
      else reject(Object.assign(new Error(`${command} exited ${code ?? signal}: ${stderr.slice(-4000)}`), { code, signal, stdout, stderr }));
    });
    child.stdin.end(input);
  });
}

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

async function heartbeat() {
  let idleSeconds = null;
  try {
    const { stdout } = await execFileAsync('/usr/sbin/ioreg', ['-c', 'IOHIDSystem']);
    const match = stdout.match(/"HIDIdleTime"\s*=\s*(\d+)/);
    if (match) idleSeconds = Math.floor(Number(match[1]) / 1_000_000_000);
  } catch {}
  await api('/v1/mac/bridge/heartbeat', { method: 'POST', body: JSON.stringify({ hostname: os.hostname(), capabilities, metadata: { platform: process.platform, release: os.release(), home, idle_seconds: idleSeconds, likely_away: idleSeconds !== null && idleSeconds > 1800, remote_desktop_device_id: process.env.JARVIS_RDC_DEVICE_ID || null, cursor_binary: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor' } }) });
}

async function cursorAgent(params) {
  const workspace = withinHome(params.path || path.join(home, 'Documents', 'ChatGPT'));
  const prompt = String(params.prompt || '').trim();
  if (!prompt || prompt.length > 12000) throw new Error('Cursor prompt is required and must be <= 12000 characters');
  const mode = ['plan','ask'].includes(params.mode) ? params.mode : null;
  const args = ['agent','--print','--output-format','json','--workspace',workspace];
  if (mode) args.push('--mode',mode);
  if (params.model) args.push('--model',String(params.model).slice(0,120));
  args.push(prompt);
  const { stdout, stderr } = await execFileAsync('/Applications/Cursor.app/Contents/Resources/app/bin/cursor',args,{cwd:workspace,timeout:10*60*1000,maxBuffer:8*1024*1024});
  return { workspace, mode: mode || 'execute', output: String(stdout || '').slice(0,100000), stderr: String(stderr || '').slice(-8000) };
}

async function listFiles(target, recursive = false) {
  const root = withinHome(target || path.join(home, 'Desktop'));
  const entries = await fs.readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries.slice(0, 1000)) {
    const full = path.join(root, entry.name);
    const stat = await fs.lstat(full);
    result.push({ name: entry.name, path: full, type: entry.isDirectory() ? 'directory' : 'file', size: stat.size, modified: stat.mtime.toISOString() });
  }
  return { path: root, entries: result, truncated: entries.length > result.length, recursive };
}

async function diskInventory() {
  const commands = [];
  for (const target of ['Desktop','Downloads','Pictures','Documents']) {
    const full = path.join(home, target);
    try {
      const { stdout } = await execFileAsync('/usr/bin/du', ['-sh', full]);
      commands.push({ path: full, usage: stdout.trim().split(/\s+/)[0] });
    } catch {}
  }
  const { stdout } = await execFileAsync('/bin/df', ['-h', home]);
  return { home, folders: commands, disk: stdout.trim() };
}

async function arrangePhotos(params) {
  const root = withinHome(params.path || path.join(home, 'Pictures'));
  const destination = path.join(root, 'Arranged by date');
  await fs.mkdir(destination, { recursive: true });
  const imageExt = new Set(['.jpg','.jpeg','.png','.heic','.webp','.gif','.tiff','.bmp']);
  const moved = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !imageExt.has(path.extname(entry.name).toLowerCase())) continue;
    const source = path.join(root, entry.name);
    const stat = await fs.stat(source);
    const month = `${stat.mtime.getFullYear()}-${String(stat.mtime.getMonth() + 1).padStart(2, '0')}`;
    const folder = path.join(destination, month);
    await fs.mkdir(folder, { recursive: true });
    const target = path.join(folder, entry.name);
    await fs.rename(source, target);
    moved.push({ from: source, to: target });
  }
  return { root, destination, moved: moved.length, files: moved.slice(0, 200) };
}

async function cleanTempFiles(params) {
  const target = withinHome(params.path || path.join(home, 'Library', 'Caches'));
  const maxAgeDays = Math.max(1, Math.min(365, Number(params.max_age_days || 7)));
  const cutoff = Date.now() - maxAgeDays * 86400000;
  const removed = [];
  const entries = await fs.readdir(target, { withFileTypes: true });
  for (const entry of entries.slice(0, 5000)) {
    const full = path.join(target, entry.name);
    const stat = await fs.lstat(full);
    if (stat.mtimeMs >= cutoff) continue;
    await fs.rm(full, { recursive: true, force: false });
    removed.push(full);
  }
  return { target, removed: removed.length, files: removed.slice(0, 200) };
}

async function codexAgent(params) {
  const workspace = withinProjectWorkspace(params.workspace || params.path, params.project_code);
  const prompt = String(params.prompt || '').trim();
  if (!prompt || prompt.length > 12000) throw new Error('Codex prompt is required and must be <= 12000 characters');
  const provider = String(params.model_provider || 'ollama');
  const model = String(params.model || 'llama3.2:latest');
  if (params.use_user_config === true) throw new Error('Codex user configuration is disabled by JARVIS policy');
  const args = ['exec'];
  args.push('--ignore-user-config', '--cd', workspace, '--sandbox', 'workspace-write', '--json', '-c', 'approval_policy="never"');
  const env = { ...process.env };
  if (provider === 'ollama') {
    args.push('--oss', '--local-provider', 'ollama', '-m', model);
  } else if (provider === 'openrouter') {
    env.OPENROUTER_API_KEY = await openRouterKey();
    if (!env.OPENROUTER_API_KEY) throw new Error('OpenRouter key is not available in the environment or macOS Keychain item jarvis-openrouter');
    args.push('-c', 'model_provider="openrouter"', '-c', `model="${model}"`, '-c', 'model_providers.openrouter.name="OpenRouter"', '-c', 'model_providers.openrouter.base_url="https://openrouter.ai/api/v1"', '-c', 'model_providers.openrouter.wire_api="responses"', '-c', 'model_providers.openrouter.env_key="OPENROUTER_API_KEY"');
  } else {
    throw new Error(`Codex bridge does not support provider ${provider}`);
  }
  args.push('-');
  const before = await workspaceEvidence(workspace);
  const { stdout, stderr } = await runWithInput(CODEX_BINARY, args, { cwd: workspace, env, input: prompt });
  const after = await workspaceEvidence(workspace);
  return { workspace, provider, model, output: String(stdout || '').slice(0, 100000), stderr: String(stderr || '').slice(-8000), evidence: { workspace: { before, after } } };
}

async function claudeAgent(params) {
  const workspace = withinProjectWorkspace(params.workspace || params.path, params.project_code);
  const prompt = String(params.prompt || '').trim();
  if (!prompt || prompt.length > 12000) throw new Error('Claude prompt is required and must be <= 12000 characters');
  const provider = String(params.model_provider || 'openrouter');
  const model = String(params.model || 'openrouter/free');
  const mode = ['plan','acceptEdits','auto'].includes(params.permission_mode) ? params.permission_mode : 'plan';
  const env = { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: '1' };
  if (provider === 'openrouter') {
    env.OPENROUTER_API_KEY = await openRouterKey();
    if (!env.OPENROUTER_API_KEY) throw new Error('OpenRouter key is not available in the environment or macOS Keychain item jarvis-openrouter');
    Object.assign(env, {
      ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
      ANTHROPIC_AUTH_TOKEN: env.OPENROUTER_API_KEY,
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_MODEL: model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: model,
    });
  } else if (provider === 'anthropic') {
    Object.assign(env, { ANTHROPIC_BASE_URL: 'https://api.anthropic.com', ANTHROPIC_MODEL: model });
    if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) throw new Error('Anthropic credentials are not available to the Mac bridge');
  } else {
    throw new Error(`Claude Code bridge does not support provider ${provider}`);
  }
  const before = await workspaceEvidence(workspace);
  const args = ['-p', '--output-format', 'json', '--permission-mode', mode, '--permission-prompts', 'none', '--add-dir', workspace, '--model', model, prompt];
  const { stdout, stderr } = await execFileAsync(CLAUDE_BINARY, args, { cwd: workspace, env, timeout: 10 * 60 * 1000, maxBuffer: 12 * 1024 * 1024 });
  const after = await workspaceEvidence(workspace);
  return { workspace, provider, model, permission_mode: mode, output: String(stdout || '').slice(0, 100000), stderr: String(stderr || '').slice(-8000), evidence: { workspace: { before, after } } };
}

async function browserProfileLogin(params) {
  const url = new URL(String(params.url || ''));
  if (url.protocol !== 'https:') throw new Error('Browser login URLs must use HTTPS');
  await execFileAsync(process.execPath, [AGENT_BROWSER_BINARY, 'close', '--all'], { timeout: 15000, maxBuffer: 1024 * 1024, env: process.env }).catch(() => {});
  const child = spawn(process.execPath, [AGENT_BROWSER_BINARY, '--profile', JARVIS_BROWSER_PROFILE, '--session-name', 'jarvis-owner-accounts', '--allowed-domains', url.hostname, '--headed', 'open', url.href], { detached: true, stdio: 'ignore', env: process.env });
  child.unref();
  return { opened: true, profile: JARVIS_BROWSER_PROFILE, url: url.href, session: 'jarvis-owner-accounts' };
}

async function browserProfileProbe(params) {
  const target = new URL(String(params.url || ''));
  if (target.protocol !== 'https:') throw new Error('Browser probe URLs must use HTTPS');
  const expectedHosts = (Array.isArray(params.expected_hosts) && params.expected_hosts.length ? params.expected_hosts : [target.hostname]).map((value) => String(value).toLowerCase());
  await execFileAsync(process.execPath, [AGENT_BROWSER_BINARY, 'close', '--all'], { timeout: 15000, maxBuffer: 1024 * 1024, env: process.env }).catch(() => {});
  const { stdout } = await execFileAsync(process.execPath, [AGENT_BROWSER_BINARY, '--profile', JARVIS_BROWSER_PROFILE, '--session-name', 'jarvis-account-verification', 'open', target.href, '--json'], { timeout: 60000, maxBuffer: 4 * 1024 * 1024, env: process.env });
  const parsed = JSON.parse(String(stdout || '{}'));
  const data = parsed.data || {};
  const finalUrl = new URL(data.url || target.href);
  const hostname = finalUrl.hostname.toLowerCase();
  const challenge = /login|uas\/login|checkpoint|challenge|authwall/i.test(finalUrl.pathname) || /just a moment|sign in|log in/i.test(String(data.title || ''));
  const verified = parsed.success === true && expectedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)) && !challenge;
  return { verified, signed_in: verified, final_url: finalUrl.href, page_title: data.title || '', expected_hosts: expectedHosts, challenge, profile_session: 'jarvis-account-verification' };
}

async function openJarvisAsk(params) {
  const project = String(process.env.JARVIS_OPENJARVIS_PROJECT || path.join(home, 'Documents', 'ChatGPT', 'OpenJarvis')).trim();
  const query = String(params.query || '').trim();
  if (!query) throw new Error('query is required');
  if (query.length > 20000) throw new Error('query must be <= 20000 characters');
  const model = String(params.model || process.env.JARVIS_OPENJARVIS_MODEL || '').trim();
  if (model && !/^[A-Za-z0-9._:/+-]{1,120}$/.test(model)) throw new Error('model is invalid');
  const args = ['run', '--project', project, 'jarvis', 'ask', '--json', '--no-stream', ...(model ? ['-m', model] : []), '--', query];
  const candidates = [process.env.JARVIS_UV_BIN, path.join(home, '.local', 'bin', 'uv'), '/opt/homebrew/bin/uv'].filter(Boolean);
  let lastError = null;
  for (const uv of candidates) {
    try {
      const { stdout } = await execFileAsync(uv, args, { timeout: 180000, maxBuffer: 8 * 1024 * 1024, env: process.env });
      return { ...JSON.parse(String(stdout || '{}')), runtime: 'openjarvis', project, uv };
    } catch (error) {
      lastError = error;
      if (error.code !== 'ENOENT') break;
    }
  }
  throw new Error(`OpenJarvis could not run on the Mac bridge: ${String(lastError?.stderr || lastError?.message || 'uv not found').slice(-2000)}`);
}

async function localPrivateSubnet() {
  const { stdout } = await execFileAsync('/sbin/ifconfig', [], { timeout: 10000, maxBuffer: 1024 * 1024 });
  const candidates = [...stdout.matchAll(/inet (\d+\.\d+\.\d+\.\d+) netmask (0x[0-9a-fA-F]+)/g)]
    .map((match) => ({ ip: match[1], mask: parseInt(match[2], 16) >>> 0 }))
    .filter((entry) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.ip));
  if (!candidates.length) return null;
  const octets = candidates[0].ip.split('.').map(Number);
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

async function scanNetwork(params) {
  const subnet = String(params.subnet || '').trim() || await localPrivateSubnet();
  if (!subnet) throw new Error('No private local subnet found');
  if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(subnet)) throw new Error('Only private RFC1918 subnets can be scanned');
  if (!/\/(2[4-9]|3[0-2])$/.test(subnet)) throw new Error('Scan size must be /24 or smaller');
  const arp = await runWithInput('/usr/sbin/arp', ['-a'], { timeout: 10000 }).then((result) => result.stdout).catch(() => '');
  let nmapAvailable = false;
  let nmap = '';
  for (const binary of ['/opt/homebrew/bin/nmap', '/usr/local/bin/nmap']) {
    try {
      await fs.access(binary);
      nmapAvailable = true;
      nmap = (await runWithInput(binary, ['-sn', subnet], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 })).stdout;
      break;
    } catch { /* try next */ }
  }
  return { subnet, nmap_available: nmapAvailable, nmap: String(nmap).slice(0, 20000), arp: String(arp).slice(0, 20000) };
}

async function organizeFolder(params) {
  const target = withinHome(params.path || home);
  const mode = params.mode === 'date' ? 'date' : 'type';
  const entries = await fs.readdir(target, { withFileTypes: true });
  const sample = [];
  let moved = 0;
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const full = path.join(target, entry.name);
    const stat = await fs.stat(full);
    const bucket = mode === 'date'
      ? `${stat.getFullYear()}-${String(stat.getMonth() + 1).padStart(2, '0')}`
      : (path.extname(entry.name).slice(1).toLowerCase() || 'no-extension');
    const destination = path.join(target, bucket);
    await fs.mkdir(destination, { recursive: true });
    await fs.rename(full, path.join(destination, entry.name));
    moved += 1;
    if (sample.length < 20) sample.push(`${entry.name} -> ${bucket}/`);
  }
  return { folder: target, mode, moved, sample };
}

async function deleteOldFiles(params) {
  if (!params.path) throw new Error('path is required');
  const target = withinHome(params.path);
  const days = Math.min(Math.max(Number(params.days) || 30, 1), 3650);
  const dryRun = params.dry_run === true;
  const cutoff = Date.now() - days * 86400000;
  const entries = await fs.readdir(target, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(target, entry.name);
    const stat = await fs.stat(full);
    if (stat.mtimeMs < cutoff) candidates.push({ full, name: entry.name });
  }
  if (dryRun) return { folder: target, days, dry_run: true, count: candidates.length, sample: candidates.slice(0, 20).map((item) => item.name) };
  const trash = path.join(home, '.Trash');
  await fs.mkdir(trash, { recursive: true });
  const moved = [];
  for (const candidate of candidates) {
    let destination = path.join(trash, candidate.name);
    try { await fs.access(destination); destination = path.join(trash, `${candidate.name}-${Date.now()}`); } catch { /* free name */ }
    await fs.rename(candidate.full, destination);
    moved.push(candidate.name);
    if (moved.length >= 500) break;
  }
  return { folder: target, days, dry_run: false, moved: moved.length, sample: moved.slice(0, 20) };
}

async function faceTimeCall(params) {
  const raw = String(params.target || '').trim();
  if (!raw) throw new Error('A FaceTime target is required');
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw);
  const digits = raw.replace(/[^\d+]/g, '');
  if (!email && !/^\+[1-9]\d{7,14}$/.test(digits)) throw new Error('Use an Apple ID email or an international phone number such as +201234567890');
  const target = email ? raw : digits;
  const kind = ['audio','cellular'].includes(params.kind) ? params.kind : 'video';
  const scheme = kind === 'audio' ? 'facetime-audio' : kind === 'cellular' ? 'tel' : 'facetime';
  await execFileAsync('/usr/bin/open', [`${scheme}://${target}`], { timeout: 15000 });
  const masked = email ? target.replace(/^(.).*(@.*)$/, '$1•••$2') : target.replace(/^(\+?\d{2}).*(\d{3})$/, '$1•••$2');
  const handler = kind === 'video' ? 'FaceTime' : kind === 'audio' ? 'Phone app (Continuity)' : 'Phone app (cellular)';
  return { opened: true, kind, handler, target_masked: masked };
}

function terminalCommand(params) {
  const command = String(params.command || '').trim();
  const violation = terminalCommandViolation(command);
  if (violation) throw new Error(violation);
  const cwd = resolveTerminalCwd(params.cwd, home);
  const timeout = Math.min(Math.max(Number(params.timeout_ms) || 120000, 1000), 600000);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn('/bin/zsh', ['-lc', command], { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const cap = 1024 * 1024;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, timeout);
    child.stdout.on('data', (chunk) => { if (stdout.length < cap) stdout += chunk.toString().slice(0, cap - stdout.length); });
    child.stderr.on('data', (chunk) => { if (stderr.length < cap) stderr += chunk.toString().slice(0, cap - stderr.length); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ exit_code: code, signal: signal || null, stdout, stderr, timed_out: timedOut, duration_ms: Date.now() - started, cwd });
    });
  });
}

async function execute(job) {
  const params = job.params || {};
  switch (job.action) {
    case 'open_terminal': {
      await execFileAsync('/usr/bin/open', ['-a', 'Terminal']);
      return { opened: 'Terminal' };
    }
    case 'cursor_status': {
      const { stdout, stderr } = await execFileAsync('/Applications/Cursor.app/Contents/Resources/app/bin/cursor',['agent','status','--output-format','json'],{timeout:30000,maxBuffer:1024*1024});
      return { status: String(stdout || '').trim(), stderr: String(stderr || '').trim() };
    }
    case 'cursor_open': {
      const target = withinHome(params.path || path.join(home, 'Documents', 'ChatGPT'));
      await execFileAsync('/usr/bin/open',['-a','Cursor',target]);
      return { opened: 'Cursor', path: target, remote_desktop_device_id: process.env.JARVIS_RDC_DEVICE_ID || null };
    }
    case 'cursor_agent': return cursorAgent(params);
    case 'codex_agent': return codexAgent(params);
    case 'claude_agent': return claudeAgent(params);
    case 'openjarvis_ask': return openJarvisAsk(params);
    case 'terminal_command': return terminalCommand(params);
    case 'scan_network': return scanNetwork(params);
    case 'organize_folder': return organizeFolder(params);
    case 'delete_old_files': return deleteOldFiles(params);
    case 'facetime_call': return faceTimeCall(params);
    case 'browser_profile_login': return browserProfileLogin(params);
    case 'browser_profile_probe': return browserProfileProbe(params);
    case 'remote_desktop_device': return { device_id: process.env.JARVIS_RDC_DEVICE_ID || null, hostname: os.hostname() };
    case 'list_files': return listFiles(params.path, Boolean(params.recursive));
    case 'disk_inventory': return diskInventory();
    case 'create_folder': {
      const target = withinHome(params.path);
      await fs.mkdir(target, { recursive: false });
      return { created: target };
    }
    case 'arrange_photos': return arrangePhotos(params);
    case 'move_files': {
      const destination = withinHome(params.destination);
      await fs.mkdir(destination, { recursive: true });
      const moved = [];
      for (const source of Array.isArray(params.files) ? params.files.slice(0, 500) : []) {
        const from = withinHome(source);
        const to = path.join(destination, path.basename(from));
        await fs.rename(from, to);
        moved.push({ from, to });
      }
      return { destination, moved: moved.length, files: moved };
    }
    case 'trash_file': {
      const from = withinHome(params.path);
      const trash = path.join(home, '.Trash');
      await fs.mkdir(trash, { recursive: true });
      let to = path.join(trash, path.basename(from));
      try { await fs.access(to); to = path.join(trash, `${path.basename(from)}-${Date.now()}`); } catch {}
      await fs.rename(from, to);
      return { from, to };
    }
    case 'clean_temp_files': return cleanTempFiles(params);
    default: throw new Error(`Unsupported action: ${job.action}`);
  }
}

async function commandOutput(command, args, timeout = 30000) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout, maxBuffer: 8 * 1024 * 1024, env: process.env });
    return String(stdout || '');
  } catch (error) {
    return String(error.stdout || '');
  }
}

function cliServerCapabilities(output, source) {
  const capabilities = [];
  for (const line of String(output || '').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.:-]+)\s+.*\b(enabled|disabled|Not logged in|OAuth|Bearer token)\b/);
    if (!match) continue;
    const name = match[1].replace(/:$/, '');
    const enabled = ['enabled', 'OAuth', 'Bearer token'].includes(match[2]);
    capabilities.push({ capability_key: name.toLowerCase(), capability_type: 'mcp', display_name: name, description: `${source} ${match[2]}`, source_ref: source, status: enabled ? 'connected' : 'unavailable', autonomy_class: 'read', metadata: { raw_status: match[2] } });
  }
  return capabilities;
}

async function codexPluginCapabilities() {
  const text = await fs.readFile(path.join(home, '.codex', 'config.toml'), 'utf8').catch(() => '');
  return [...text.matchAll(/\[plugins\."([^"]+)"\]\s*\nenabled\s*=\s*(true|false)/g)].map((match) => ({ capability_key: match[1].toLowerCase(), capability_type: 'plugin', display_name: match[1], description: 'Codex plugin', source_ref: '~/.codex/config.toml', status: match[2] === 'true' ? 'connected' : 'unavailable', autonomy_class: 'read', metadata: { enabled: match[2] === 'true' } }));
}

let capabilitySyncPromise = null;
async function syncCapabilities() {
  if (capabilitySyncPromise) return capabilitySyncPromise;
  capabilitySyncPromise = (async () => {
    const [codexMcp, claudeMcp, codexPlugins] = await Promise.all([
      commandOutput(CODEX_BINARY, ['mcp', 'list']),
      commandOutput(CLAUDE_BINARY, ['mcp', 'list']),
      codexPluginCapabilities(),
    ]);
    const codex = [...cliServerCapabilities(codexMcp, 'codex-mcp'), ...codexPlugins, { capability_key: 'code-implementation', capability_type: 'expertise', display_name: 'Code implementation and debugging', description: 'Implement, fix and test code in an authorized workspace.', source_ref: 'codex-runtime', status: 'connected', autonomy_class: 'sandbox', metadata: {} }];
    const claude = [...cliServerCapabilities(claudeMcp, 'claude-mcp'), { capability_key: 'architecture-security-review', capability_type: 'expertise', display_name: 'Architecture and security review', description: 'Independent architecture, security and code review.', source_ref: 'claude-runtime', status: 'connected', autonomy_class: 'read', metadata: {} }];
    for (const batch of [{ agent_id: 'codex', source: 'codex-runtime-inventory', capabilities: codex }, { agent_id: 'claude', source: 'claude-runtime-inventory', capabilities: claude }]) {
      await api('/v1/capabilities/sync', { method: 'POST', body: JSON.stringify({ ...batch, project_code: '*', replace: true }) });
    }
  })();
  try { return await capabilitySyncPromise; } finally { capabilitySyncPromise = null; }
}

async function loop() {
  await heartbeat();
  setInterval(() => heartbeat().catch((error) => console.error(error)), 10000).unref();
  syncCapabilities().catch((error) => console.error('capability sync:', error.message));
  setInterval(() => syncCapabilities().catch((error) => console.error('capability sync:', error.message)), 6 * 60 * 60 * 1000).unref();
  while (!stopping) {
    try {
      const { job } = await api('/v1/mac/bridge/jobs/next', { method: 'POST', body: '{}' });
      if (!job) { await new Promise((resolve) => setTimeout(resolve, 2000)); continue; }
      try {
        const result = await execute(job);
        await api(`/v1/mac/bridge/jobs/${job.id}/result`, { method: 'POST', body: JSON.stringify({ ok: true, result }) });
      } catch (error) {
        await api(`/v1/mac/bridge/jobs/${job.id}/result`, { method: 'POST', body: JSON.stringify({ ok: false, error: error.message }) });
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => { stopping = true; });
loop();
