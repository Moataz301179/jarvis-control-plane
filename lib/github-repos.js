import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const DEFAULT_ROOT = process.env.JARVIS_WORKSPACES_ROOT || '/srv/jarvis/workspaces';
const MAX_REPOSITORY_KB = 250 * 1024;

function safeProjectCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) throw Object.assign(new Error('Project code is invalid'), { statusCode: 400 });
  return code;
}

export function parseGitHubRepository(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw Object.assign(new Error('Enter a complete GitHub repository URL'), { statusCode: 400 }); }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') throw Object.assign(new Error('Only public https://github.com repositories are supported'), { statusCode: 400 });
  if (url.username || url.password || url.search || url.hash) throw Object.assign(new Error('Repository URLs cannot contain credentials, query strings or fragments'), { statusCode: 400 });
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 2) throw Object.assign(new Error('Use a repository URL in the form https://github.com/owner/repository'), { statusCode: 400 });
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) throw Object.assign(new Error('GitHub owner or repository name is invalid'), { statusCode: 400 });
  return { owner, repo, repository: `${owner}/${repo}`, cloneUrl: `https://github.com/${owner}/${repo}.git`, webUrl: `https://github.com/${owner}/${repo}` };
}

async function command(file, args, options = {}) {
  try {
    const result = await exec(file, args, {
      cwd: options.cwd,
      timeout: options.timeout || 120000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false' },
    });
    return { stdout: String(result.stdout || '').trim(), stderr: String(result.stderr || '').trim() };
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message || 'command failed').trim().slice(0, 3000);
    throw Object.assign(new Error(detail), { statusCode: 502, command: file });
  }
}

async function preflight(repository) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
  const response = await fetch(endpoint, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'JARVIS-Repository-Installer/1.0' }, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.message || `GitHub repository lookup failed with HTTP ${response.status}`), { statusCode: response.status === 404 ? 404 : 502 });
  if (body.private) throw Object.assign(new Error('Private repositories require a separately approved credential flow and are not cloned by this public installer'), { statusCode: 403 });
  if (Number(body.size || 0) > MAX_REPOSITORY_KB) throw Object.assign(new Error(`Repository is too large for the automatic installer (${body.size} KB)`), { statusCode: 413 });
  return { defaultBranch: body.default_branch || null, sizeKb: Number(body.size || 0), license: body.license?.spdx_id || 'UNKNOWN', description: body.description || '' };
}

async function detectManifests(repositoryPath) {
  const names = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod', 'Dockerfile', 'compose.yml', 'docker-compose.yml'];
  const present = [];
  await Promise.all(names.map(async (name) => { try { await fs.access(path.join(repositoryPath, name)); present.push(name); } catch {} }));
  return names.filter((name) => present.includes(name));
}

async function installNodeDependencies(repositoryPath, manifests) {
  if (!manifests.includes('package.json')) return { status: 'not_applicable', detail: 'No package.json found' };
  const args = manifests.includes('package-lock.json') ? ['ci', '--ignore-scripts', '--no-audit', '--no-fund'] : ['install', '--ignore-scripts', '--no-audit', '--no-fund'];
  const started = Date.now();
  const result = await command('npm', args, { cwd: repositoryPath, timeout: 240000 });
  return { status: 'installed', command: `npm ${args.join(' ')}`, duration_ms: Date.now() - started, stdout: result.stdout.slice(-2000), stderr: result.stderr.slice(-2000) };
}

export async function clonePublicGitHubRepository({ projectCode, url, installDependencies = false, root = DEFAULT_ROOT }) {
  const code = safeProjectCode(projectCode);
  const repository = parseGitHubRepository(url);
  const metadata = await preflight(repository);
  const projectRoot = path.join(root, code, 'repos');
  await fs.mkdir(projectRoot, { recursive: true, mode: 0o750 });
  const destination = path.join(projectRoot, `${repository.owner}--${repository.repo}`);
  let action = 'cloned';
  try { await fs.access(destination); action = 'already_present'; }
  catch {
    const temporary = `${destination}.partial-${process.pid}-${Date.now()}`;
    try {
      await command('git', ['clone', '--depth', '1', '--single-branch', '--no-tags', repository.cloneUrl, temporary], { timeout: 180000 });
      await fs.rename(temporary, destination);
    } catch (error) {
      await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
      try { await fs.access(destination); action = 'already_present'; }
      catch { throw error; }
    }
  }
  const head = await command('git', ['rev-parse', 'HEAD'], { cwd: destination });
  const branch = await command('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: destination });
  const remote = await command('git', ['config', '--get', 'remote.origin.url'], { cwd: destination });
  if (parseGitHubRepository(remote.stdout).repository.toLowerCase() !== repository.repository.toLowerCase()) throw new Error('Repository destination identity mismatch');
  const manifests = await detectManifests(destination);
  let dependencyInstall;
  if (installDependencies) {
    try { dependencyInstall = await installNodeDependencies(destination, manifests); }
    catch (error) { dependencyInstall = { status: 'failed', error: error.message.slice(0, 3000) }; }
  } else {
    dependencyInstall = { status: 'not_requested', detail: 'Repository cloned without executing package code' };
  }
  return {
    projectCode: code,
    repository: repository.repository,
    repositoryUrl: repository.webUrl,
    cloneUrl: repository.cloneUrl,
    path: destination,
    action,
    commitSha: head.stdout,
    branch: branch.stdout,
    defaultBranch: metadata.defaultBranch,
    sizeKb: metadata.sizeKb,
    license: metadata.license,
    description: metadata.description,
    manifests,
    dependencyInstall,
    evidence: { clonedAt: new Date().toISOString(), head: head.stdout, branch: branch.stdout, remote: remote.stdout, manifests },
  };
}

export async function githubRuntimeStatus() {
  try {
    const version = await command('git', ['--version'], { timeout: 10000 });
    const response = await fetch('https://api.github.com/rate_limit', { headers: { accept: 'application/vnd.github+json', 'user-agent': 'JARVIS-Capability-Audit/1.0' }, signal: AbortSignal.timeout(10000) });
    const body = await response.json().catch(() => ({}));
    return { ready: response.ok, git: version.stdout, api: response.ok ? 'reachable' : `HTTP ${response.status}`, remaining: body.rate?.remaining ?? null };
  } catch (error) {
    return { ready: false, error: error.message };
  }
}

export const githubRepositoryToolDefinition = {
  type: 'function',
  function: {
    name: 'clone_public_github_repository',
    description: 'Clone a small public GitHub repository into the isolated JARVIS workspace for the selected venture. This does not execute package scripts or install dependencies.',
    parameters: {
      type: 'object',
      properties: { project_code: { type: 'string' }, url: { type: 'string' }, install_dependencies: { type: 'boolean', default: false } },
      required: ['project_code', 'url'],
    },
  },
};
