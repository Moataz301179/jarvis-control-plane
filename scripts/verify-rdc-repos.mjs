import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const { stdout } = await exec('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=10','hv-vps',"awk -F= '/^JARVIS_OWNER_TOKEN=/{print substr($0,index($0,\"=\")+1)}' /srv/jarvis/shared/.env"], { timeout: 15000 });
const token = stdout.trim();
if (!token) throw new Error('Owner token unavailable');
const base = 'http://127.0.0.1:13100';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `${path} HTTP ${response.status}`);
  return body;
}

const registry = await request('/v1/venture/repositories');
if (registry.repositories.length !== 11) throw new Error(`Expected 11 Hatchable repositories, received ${registry.repositories.length}`);
const local = registry.repositories.filter((repo) => repo.local_path);
if (local.length < 3) throw new Error('Expected at least three locally reachable repositories');

const state = await request('/v1/agents-projects/state');
const required = ['cursor_status','cursor_open','cursor_agent','remote_desktop_device'];
if (!required.every((capability) => state.macBridge.capabilities.includes(capability))) throw new Error('Cursor or Remote Desktop capability is missing from the Mac bridge');
if (state.macBridge.metadata.remote_desktop_device_id !== 'f9b26368-7f2d-413f-a623-f30642cd1e7e') throw new Error('Remote Desktop Commander device identity is not linked');

const created = await request('/v1/mac/jobs', { method: 'POST', body: JSON.stringify({ action: 'remote_desktop_device', params: {}, requested_by: 'owner' }) });
let job;
for (let attempt = 0; attempt < 20; attempt += 1) {
  const current = await request('/v1/agents-projects/state');
  job = current.macBridge.jobs.find((entry) => entry.id === created.id);
  if (job && ['succeeded','failed'].includes(job.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!job || job.status !== 'succeeded' || job.result?.device_id !== 'f9b26368-7f2d-413f-a623-f30642cd1e7e') throw new Error('Remote Desktop device job did not succeed');

const dashboard = await request('/v1/studio/dashboard');
if (dashboard.alerts.some((alert) => alert.status === 'open' && /Mac bridge/i.test(alert.title))) throw new Error('An active Mac bridge offline alert still exists');

console.log(`rdc repository integration verified repos=${registry.repositories.length} local=${local.length} device=${job.result.device_id}`);
