import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.join(os.homedir(), '.hermes', 'skills', 'jarvis-studio');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
if (manifest.count !== 193 || manifest.skills.length !== 193) throw new Error('Skill manifest is incomplete');
const files = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name === 'SKILL.md') files.push(full);
  }
}
await walk(root);
if (files.length !== 193) throw new Error(`Physical SKILL.md count is ${files.length}, expected 193`);
const { stdout: discovery } = await exec('/Users/Moatazi/.hermes/hermes-agent/.hermes/bin/hermes', ['-p','default','skills','list','--source','local','--enabled-only'], { timeout: 60000, maxBuffer: 5 * 1024 * 1024 });
const discovered = discovery.split('\n').filter((line) => line.includes('jarvis-studio')).length;
if (discovered !== 193) throw new Error(`Hermes discovers ${discovered} jarvis-studio skills, expected 193`);
const { stdout: database } = await exec('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=10','hv-vps',"cd /; runuser -u postgres -- psql -d jarvis -Atc \"select count(*) from jarvis_skill_catalog where status='installed';\""], { timeout: 15000 });
if (Number(database.trim()) !== 193) throw new Error(`JARVIS database has ${database.trim()} installed skills, expected 193`);
console.log(`github skills verified files=193 hermes=193 database=193 repositories=${manifest.sources.length}`);
