import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';

const exec = promisify(execFile);

const SCOPE_FILE = process.env.JARVIS_SECURITY_SCOPE || '/srv/jarvis/shared/security-scope.json';
const PRIVATE_PREFIXES = ['127.', '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];

export const LINUX_TOOLS = {
  nmap: { bin: 'nmap', targetFirst: false, flags: new Set(['-sV', '-Pn', '-T4', '-F', '-sn']) },
  dig: { bin: 'dig', targetFirst: true, flags: new Set(['+short', '+trace']) },
  whois: { bin: 'whois', targetFirst: true, flags: new Set([]) },
  traceroute: { bin: 'traceroute', targetFirst: false, flags: new Set(['-n']) },
  curl: { bin: 'curl', targetFirst: false, flags: new Set(['-sS', '-I', '--head', '-L']), url: true },
};

export function isPrivateAddress(value) {
  const host = String(value || '').trim();
  if (host === 'localhost' || host === '::1') return true;
  return PRIVATE_PREFIXES.some((prefix) => host.startsWith(prefix));
}

export function extractHost(target) {
  const value = String(target || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try { return new URL(value).hostname.toLowerCase(); } catch { return null; }
  }
  return value.toLowerCase().replace(/\/.*$/, '').replace(/:\d+$/, '');
}

export function targetAllowed(target, scope = { domains: [], ips: [], cidrs: [] }) {
  const host = extractHost(target);
  if (!host) return false;
  if (isPrivateAddress(host)) return true;
  const domains = (scope.domains || []).map((domain) => String(domain).toLowerCase());
  if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return true;
  const ips = (scope.ips || []).map((ip) => String(ip).toLowerCase());
  if (ips.includes(host)) return true;
  const cidrs = (scope.cidrs || []).map((cidr) => String(cidr).toLowerCase());
  return cidrs.includes(host);
}

export function validateToolRequest({ tool, target, options = [] }, scope = { domains: [], ips: [], cidrs: [] }) {
  const definition = LINUX_TOOLS[String(tool || '').toLowerCase()];
  if (!definition) throw Object.assign(new Error('Tool is not in the allowlist'), { statusCode: 400 });
  const host = extractHost(target);
  if (!host) throw Object.assign(new Error('A valid target is required'), { statusCode: 400 });
  if (host.length > 253 || !/^[a-z0-9._:-]+$/i.test(host)) throw Object.assign(new Error('Target format is invalid'), { statusCode: 400 });
  if (!targetAllowed(host, scope)) {
    throw Object.assign(new Error('Target is outside the authorized security scope. Add it to security-scope.json first.'), { statusCode: 403 });
  }
  const flags = Array.isArray(options) ? options.map(String) : [];
  if (flags.length > 6) throw Object.assign(new Error('Too many options'), { statusCode: 400 });
  for (const flag of flags) {
    if (!definition.flags.has(flag)) throw Object.assign(new Error(`Option ${flag} is not allowlisted for ${tool}`), { statusCode: 400 });
  }
  let args;
  let requestTarget = host;
  if (definition.url) {
    const url = /^https?:\/\//i.test(String(target)) ? String(target) : `https://${host}`;
    if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error('Only http and https URLs are allowed'), { statusCode: 400 });
    args = [...flags, url];
  } else if (definition.targetFirst) {
    args = [host, ...flags];
  } else {
    args = [...flags, host];
  }
  return { tool: String(tool).toLowerCase(), bin: definition.bin, args, host: requestTarget };
}

let cachedScope = { at: 0, value: null };
export async function loadSecurityScope() {
  if (cachedScope.value && Date.now() - cachedScope.at < 60000) return cachedScope.value;
  let value = { domains: [], ips: [], cidrs: [] };
  try {
    const parsed = JSON.parse(await fs.readFile(SCOPE_FILE, 'utf8'));
    value = {
      domains: Array.isArray(parsed.domains) ? parsed.domains : [],
      ips: Array.isArray(parsed.ips) ? parsed.ips : [],
      cidrs: Array.isArray(parsed.cidrs) ? parsed.cidrs : [],
    };
  } catch { /* defaults: private/loopback only */ }
  cachedScope = { at: Date.now(), value };
  return value;
}

export async function linuxSecurityScope() {
  const scope = await loadSecurityScope();
  return { ...scope, scope_file: SCOPE_FILE, private_ranges_allowed: true };
}

export async function runLinuxTool({ tool, target, options }, actor = 'jarvis') {
  const scope = await loadSecurityScope();
  const request = validateToolRequest({ tool, target, options }, scope);
  const started = Date.now();
  let stdout = '';
  let stderr = '';
  let exitCode = null;
  let timedOut = false;
  try {
    const result = await exec(request.bin, request.args, { timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = 0;
  } catch (error) {
    stdout = String(error.stdout || '');
    stderr = String(error.stderr || error.message || '');
    exitCode = typeof error.code === 'number' ? error.code : null;
    timedOut = /timed out/i.test(String(error.message || ''));
  }
  const { query } = await import('./db.js');
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'linux_tool.run', 'linux_tool', request.tool, { target: request.host, options: request.args.slice(0, -1), exit_code: exitCode }]);
  return {
    tool: request.tool,
    target: request.host,
    exit_code: exitCode,
    timed_out: timedOut,
    duration_ms: Date.now() - started,
    stdout: String(stdout).slice(0, 20000),
    stderr: String(stderr).slice(0, 8000),
  };
}
