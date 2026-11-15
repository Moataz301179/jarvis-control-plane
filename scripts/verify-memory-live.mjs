import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const { stdout } = await exec('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'hv-vps', "awk -F= '/^JARVIS_OWNER_TOKEN=/{print substr($0,index($0,\"=\")+1)}' /srv/jarvis/shared/.env"], { timeout: 15000 });
const token = stdout.trim();
if (!token) throw new Error('Owner token unavailable');
const base = 'http://127.0.0.1:13100';
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000) });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}
const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const created = await request('/v1/memory', { method: 'POST', body: JSON.stringify({ project_code: 'STUDIO', agent_id: 'jarvis', memory_type: 'verification', title: `Memory verification ${stamp}`, content: 'Project-scoped memory isolation verification.', tags: ['verification'] }) });
if (created.status !== 201 || !created.body.id) throw new Error('Memory write failed');
const found = await request(`/v1/memory?project_code=STUDIO&q=${encodeURIComponent(stamp)}`);
if (!found.body.memories?.some((entry) => entry.id === created.body.id)) throw new Error('Memory search did not return the written entry');
const denied = await request('/v1/memory?project_code=HV&agent_id=hermes-cto');
if (denied.status !== 403) throw new Error('Hermes HV memory isolation was not enforced');
console.log(`project memory verified id=${created.body.id} hermes_hv_denied=${denied.status}`);
