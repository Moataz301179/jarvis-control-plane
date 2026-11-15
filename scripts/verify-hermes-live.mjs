import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const { stdout: tokenOutput } = await exec('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'hv-vps', "awk -F= '/^JARVIS_OWNER_TOKEN=/{print substr($0,index($0,\"=\")+1)}' /srv/jarvis/shared/.env"], { timeout: 15000 });
const ownerToken = tokenOutput.trim();
if (!ownerToken) throw new Error('Owner token unavailable');
const base = 'http://127.0.0.1:13100';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(options.timeout || 60000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `${path} returned HTTP ${response.status}`);
  return body;
}

const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const memoryTitle = `Hermes bridge verification ${stamp}`;
const memory = await request('/v1/memory', { method: 'POST', body: JSON.stringify({ project_code: 'STUDIO', agent_id: 'jarvis', memory_type: 'verification', title: memoryTitle, content: 'Shared memory round trip for the JARVIS Hermes bridge.', tags: ['verification'] }) });
const search = await request(`/v1/memory?project_code=STUDIO&q=${encodeURIComponent(stamp)}`);
if (!search.memories.some((entry) => entry.id === memory.id)) throw new Error('Written memory was not returned by search');

let state = await request('/v1/hermes/state');
for (let attempt = 0; attempt < 20 && !(state.bridge?.last_seen && Date.now() - new Date(state.bridge.last_seen).getTime() < 60000 && state.bridge.gateway_status === 'online'); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  state = await request('/v1/hermes/state');
}
if (!(state.bridge?.last_seen && Date.now() - new Date(state.bridge.last_seen).getTime() < 60000 && state.bridge.gateway_status === 'online')) throw new Error('Hermes bridge heartbeat is not online');

const job = await request('/v1/hermes/jobs', { method: 'POST', body: JSON.stringify({ project_code: 'STUDIO', title: `Hermes bridge verification ${stamp}`, instruction: 'Respond with exactly HERMES_BRIDGE_OK and no additional text.', toolsets: ['memory', 'todo', 'clarify'] }) });
let completed;
for (let attempt = 0; attempt < 90; attempt += 1) {
  const current = await request('/v1/hermes/state');
  completed = current.jobs.find((entry) => entry.id === job.id);
  if (completed && ['succeeded', 'failed'].includes(completed.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (!completed || completed.status !== 'succeeded') throw new Error(`Hermes job did not succeed: ${completed?.error || completed?.status || 'timeout'}`);
if (!String(completed.result || '').includes('HERMES_BRIDGE_OK')) throw new Error('Hermes result marker is missing');
const memoryAfter = await request(`/v1/memory?project_code=STUDIO&q=${encodeURIComponent(stamp)}`);
if (!memoryAfter.memories.some((entry) => entry.agent_id === 'hermes-cto' && entry.memory_type === 'job_result')) throw new Error('Hermes job result was not shared into project memory');

console.log(`hermes integration verified memory=${memory.id} job=${job.id} profile=${state.bridge.profile}`);
