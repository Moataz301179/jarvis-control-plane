import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const command = `set -e
services=$(systemctl is-active jarvis-api jarvis-worker jarvis-verifier jarvis-telegram jarvis-operations | tr '\n' ',')
token=$(awk -F= '/^JARVIS_OWNER_TOKEN=/{print substr($0,index($0,"=")+1)}' /srv/jarvis/shared/.env)
body=$(curl -fsS -H "Authorization: Bearer $token" 'http://127.0.0.1:3100/v1/capabilities/audit?probe=1')
printf '%s\n%s' "$services" "$body"`;
const { stdout } = await exec('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'hv-vps', command], { timeout: 120000, maxBuffer: 5 * 1024 * 1024 });
const newline = stdout.indexOf('\n');
const services = stdout.slice(0, newline).replace(/,$/, '').split(',');
const audit = JSON.parse(stdout.slice(newline + 1));
const byId = Object.fromEntries(audit.capabilities.map((entry) => [entry.id, entry.status]));
if (services.length !== 5 || services.some((status) => status !== 'active')) throw new Error(`Service state is incomplete: ${services.join(',')}`);
if (byId.browser !== 'verified') throw new Error('Live Chromium browser probe failed');
if (byId.github_repositories !== 'verified') throw new Error('Live GitHub installer probe failed');
if (byId.skill_catalog !== 'verified_catalogued') throw new Error('Live skill catalogue is incomplete');
console.log(`live capabilities verified browser=${byId.browser} github=${byId.github_repositories} skills=${byId.skill_catalog} services=${services.length}`);
