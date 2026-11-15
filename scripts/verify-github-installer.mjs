import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { clonePublicGitHubRepository } from '../lib/github-repos.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-github-gate-'));
try {
  const result = await clonePublicGitHubRepository({ projectCode: 'STUDIO', url: 'https://github.com/octocat/Hello-World', root, installDependencies: false });
  if (result.repository !== 'octocat/Hello-World' || result.commitSha.length < 7 || !result.path.startsWith(root)) throw new Error('GitHub clone evidence is incomplete');
  const gitConfig = await fs.readFile(path.join(result.path, '.git', 'config'), 'utf8');
  if (!gitConfig.includes('github.com/octocat/Hello-World.git')) throw new Error('Clone remote identity mismatch');
  console.log(`github installer verified ${result.repository}@${result.commitSha.slice(0, 12)}`);
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
