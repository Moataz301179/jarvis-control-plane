import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const catalog = JSON.parse(await fs.readFile('data/capability-catalog.json', 'utf8'));
const sourceMap = new Map(catalog.sources.map((source) => [source.repository, source]));
const profileRoot = path.join(os.homedir(), '.hermes');
const sourcesRoot = path.join(os.homedir(), '.hermes', 'skill-sources', 'jarvis-studio');
const skillsRoot = path.join(profileRoot, 'skills', 'jarvis-studio');

function slug(value) { return String(value).replace(/[^A-Za-z0-9_.-]+/g, '--').replace(/^--+|--+$/g, '').slice(0, 180); }
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
async function run(file, args, cwd) {
  try { return await exec(file, args, { cwd, timeout: 300000, maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) { throw new Error(`${file} ${args.join(' ')} failed: ${String(error.stderr || error.message).slice(0, 3000)}`); }
}

const grouped = new Map();
for (const skill of catalog.skills) {
  if (!grouped.has(skill.repository)) grouped.set(skill.repository, []);
  grouped.get(skill.repository).push(skill);
}

await fs.mkdir(sourcesRoot, { recursive: true });
await fs.mkdir(path.dirname(skillsRoot), { recursive: true });
try {
  await fs.access(skillsRoot);
  await fs.rename(skillsRoot, `${skillsRoot}.previous-${Date.now()}`).catch(() => {});
} catch {}
await fs.mkdir(skillsRoot, { recursive: true });

const installed = [];
const sourceResults = [];
for (const [repository, skills] of grouped) {
  const source = sourceMap.get(repository);
  if (!source?.source_url) throw new Error(`Missing source metadata for ${repository}`);
  const repoSlug = slug(repository);
  const checkout = path.join(sourcesRoot, repoSlug);
  const skillPaths = [...new Set(skills.map((skill) => skill.source_path))];
  await fs.rm(checkout, { recursive: true, force: true });
  await run('git', ['clone', '--filter=blob:none', '--no-checkout', '--depth', '1', source.source_url, checkout]);
  await run('git', ['sparse-checkout', 'init', '--no-cone'], checkout);
  await run('git', ['sparse-checkout', 'set', ...skillPaths], checkout);
  const commit = source.upstream_commit;
  if (commit && /^[0-9a-f]{7,64}$/i.test(commit)) {
    await run('git', ['fetch', '--depth', '1', 'origin', commit], checkout);
    await run('git', ['checkout', '--detach', 'FETCH_HEAD'], checkout);
  } else {
    await run('git', ['checkout'], checkout);
  }
  const checkedOut = (await run('git', ['rev-parse', 'HEAD'], checkout)).stdout.trim();
  let sourceCount = 0;
  for (const skill of skills) {
    const sourceFile = path.join(checkout, skill.source_path);
    await fs.access(sourceFile);
    const sourceDirectory = path.dirname(skill.source_path);
    const relativeLeaf = sourceDirectory.replace(/^(skills|plugins|examples|\.agents\/skills)\//, '');
    const destination = path.join(skillsRoot, `${repoSlug}--${slug(relativeLeaf)}`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(path.join(checkout, sourceDirectory), destination, { recursive: true, force: true });
    const copiedFile = path.join(destination, 'SKILL.md');
    const blobSha = sha256(await fs.readFile(copiedFile));
    installed.push({ id: skill.id, name: skill.skill_name, repository, source_path: skill.source_path, source_commit: checkedOut, destination, sha256: blobSha });
    sourceCount += 1;
  }
  sourceResults.push({ repository, expected: skills.length, installed: sourceCount, commit: checkedOut });
}

if (installed.length !== 193) throw new Error(`Expected 193 installed skills, received ${installed.length}`);
const manifest = { generated_at: new Date().toISOString(), profile: 'default', count: installed.length, sources: sourceResults, skills: installed };
await fs.writeFile(path.join(skillsRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));

const { stdout: tokenOutput } = await exec('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=10','hv-vps',"awk -F= '/^JARVIS_OWNER_TOKEN=/{print substr($0,index($0,\"=\")+1)}' /srv/jarvis/shared/.env"], { timeout: 15000 });
const token = tokenOutput.trim();
if (!token) throw new Error('Owner token unavailable for installation report');
const response = await fetch('http://127.0.0.1:13100/v1/skills/install-report', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ skills: installed }), signal: AbortSignal.timeout(60000) });
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(body.error || `Installation report failed with HTTP ${response.status}`);

console.log(`github skills installed count=${installed.length} repositories=${sourceResults.length} profile=default`);
