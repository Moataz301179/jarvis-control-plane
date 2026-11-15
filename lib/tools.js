import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';
import { query } from './db.js';

const exec = promisify(execFile);

const HEALTH_TARGETS = {
  jarvis: () => config.jarvisHealthUrl,
  hotelsvendors: () => config.hotelsVendorsHealthUrl,
};

export const WORKER_TOOLS = new Set([
  'http_probe',
  'database_health',
  'service_status',
  'release_inventory',
  'workspace_inventory',
  'backup_verify',
]);

export const AUTO_APPROVAL_TOOLS = new Set(WORKER_TOOLS);

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function resolveHealthTarget(input) {
  const target = String(input?.target || '');
  if (!Object.hasOwn(HEALTH_TARGETS, target)) throw new Error(`Tool target is not allowlisted: ${target}`);
  return HEALTH_TARGETS[target]();
}

async function fileEvidence(file) {
  const data = await fs.readFile(file);
  return { path: file, bytes: data.length, sha256: digest(data) };
}

async function httpProbe(input) {
  const url = resolveHealthTarget(input);
  const startedAt = new Date().toISOString();
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'jarvis-verifier/0.2', accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch {}
  const evidence = {
    kind: 'http_probe',
    target: input.target,
    url,
    httpStatus: response.status,
    contentType: response.headers.get('content-type'),
    bodyDigest: digest(body),
    bodySnippet: body.slice(0, 1000),
    json,
    startedAt,
    completedAt: new Date().toISOString(),
  };
  if (response.status < 200 || response.status >= 300) throw Object.assign(new Error(`HTTP probe failed with ${response.status}`), { evidence });
  return evidence;
}

async function databaseHealth() {
  const [identity, tables, tableNames, objectives, tasks, audit] = await Promise.all([
    query('SELECT current_database() AS database,current_user AS db_user,now() AS checked_at'),
    query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'"),
    query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"),
    query('SELECT status,count(*)::int AS count FROM objectives GROUP BY status ORDER BY status'),
    query('SELECT status,count(*)::int AS count FROM tasks GROUP BY status ORDER BY status'),
    query('SELECT count(*)::bigint AS count FROM audit_events'),
  ]);
  const snapshot = {
    database: identity.rows[0].database,
    tables: tables.rows[0].count,
    objectives: Object.fromEntries(objectives.rows.map((row) => [row.status, row.count])),
    tasks: Object.fromEntries(tasks.rows.map((row) => [row.status, row.count])),
    auditEvents: Number(audit.rows[0].count),
  };
  return {
    kind: 'database_health',
    ok: true,
    ...snapshot,
    schemaDigest: digest(JSON.stringify({ database: snapshot.database, tables: snapshot.tables, tableNames: tableNames.rows.map((row) => row.table_name) })),
    checkedAt: identity.rows[0].checked_at,
  };
}

async function serviceStatus(input) {
  const allowed = new Set(['jarvis-api','jarvis-worker','jarvis-verifier','jarvis-operations','jarvis-telegram','nginx','redis-server','postgresql@14-main','ollama']);
  const aliases = { jarvis: ['jarvis-api','jarvis-worker','jarvis-verifier','jarvis-operations','jarvis-telegram'] };
  const requested = Array.isArray(input?.services) && input.services.length
    ? [...new Set(input.services.map(String))]
    : ['jarvis-api','jarvis-worker','jarvis-verifier','jarvis-operations','jarvis-telegram'];
  const services = [...new Set(requested.flatMap((service) => aliases[service] || [service]))];
  const rejected = services.filter((service) => !allowed.has(service));
  if (rejected.length) throw new Error(`Service is not allowlisted: ${rejected.join(', ')}`);
  const rows = [];
  for (const service of services) {
    const { stdout } = await exec('systemctl', ['show', `${service}.service`, '--property=ActiveState,SubState,NRestarts,ExecMainStartTimestamp', '--no-pager'], { timeout: 5000 });
    const values = Object.fromEntries(stdout.trim().split('\n').map((line) => line.split('=', 2)));
    rows.push({ service, active: values.ActiveState === 'active', state: values.ActiveState, substate: values.SubState, restarts: Number(values.NRestarts || 0), startedAt: values.ExecMainStartTimestamp || null });
  }
  return { kind: 'service_status', services: rows, allActive: rows.every((row) => row.active), snapshotDigest: digest(JSON.stringify(rows.map(({ service, active, state, substate }) => ({ service, active, state, substate })))) };
}

async function releaseInventory() {
  const root = process.cwd();
  const [packageFile, lockFile, migrations, release, migrationsList] = await Promise.all([
    fileEvidence(path.join(root, 'package.json')),
    fileEvidence(path.join(root, 'package-lock.json')).catch(() => null),
    fileEvidence(path.join(root, 'scripts', 'migrate.js')),
    fs.readlink('/srv/jarvis/current').catch(() => root),
    fs.readdir(path.join(root, 'migrations')).then((items) => items.filter((item) => item.endsWith('.sql')).sort()).catch(() => []),
  ]);
  return {
    kind: 'release_inventory',
    release: process.env.JARVIS_RELEASE || release,
    packageDigest: packageFile.sha256,
    lockDigest: lockFile?.sha256 || null,
    migrationRunnerDigest: migrations.sha256,
    migrations: migrationsList,
    migrationCount: migrationsList.length,
    snapshotDigest: digest(JSON.stringify({ package: packageFile.sha256, lock: lockFile?.sha256 || null, migrations: migrationsList })),
  };
}

async function workspaceInventory(input) {
  const scope = String(input?.scope || 'current_release');
  const roots = {
    current_release: process.cwd(),
    services: '/etc/systemd/system',
    studio_workspaces: '/srv/jarvis/workspaces/STUDIO',
    hv_workspaces: '/srv/jarvis/workspaces/HV',
    backups: config.backupDir,
  };
  if (!Object.hasOwn(roots, scope)) throw new Error(`Workspace scope is not allowlisted: ${scope}`);
  const root = roots[scope];
  const entries = await fs.readdir(root, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const rows = entries
    .filter((entry) => !['node_modules', '.git', '.env'].includes(entry.name) && !entry.name.endsWith('.env'))
    .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other' }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 500);
  return { kind: 'workspace_inventory', scope, root, entries: rows, count: rows.length, snapshotDigest: digest(JSON.stringify(rows)) };
}

async function backupVerify(input) {
  const requested = String(input?.backup_id || '');
  const result = requested
    ? await query('SELECT * FROM backup_runs WHERE id=$1', [requested])
    : await query("SELECT * FROM backup_runs WHERE status='succeeded' ORDER BY completed_at DESC LIMIT 1");
  const run = result.rows[0];
  if (!run) throw new Error('No successful backup evidence exists');
  const file = await fs.readFile(run.backup_path);
  const sha256 = digest(file);
  return {
    kind: 'backup_verify',
    backupId: run.id,
    path: run.backup_path,
    bytes: file.length,
    expectedSha256: run.backup_sha256,
    sha256,
    checksumValid: sha256 === run.backup_sha256,
    restoreSchema: run.restore_schema,
    tableCount: run.table_count,
    rowCount: Number(run.row_count),
    completedAt: run.completed_at,
    snapshotDigest: digest(JSON.stringify({ id: run.id, sha256, restoreSchema: run.restore_schema, tableCount: run.table_count })),
  };
}

export async function executeTool(tool, input = {}) {
  if (tool === 'http_probe') return httpProbe(input);
  if (tool === 'database_health') return databaseHealth();
  if (tool === 'service_status') return serviceStatus(input);
  if (tool === 'release_inventory') return releaseInventory();
  if (tool === 'workspace_inventory') return workspaceInventory(input);
  if (tool === 'backup_verify') return backupVerify(input);
  throw new Error(`Unsupported tool: ${tool}`);
}

export function verifyEvidence(tool, input, workerEvidence, verifierEvidence) {
  if (!workerEvidence || !verifierEvidence || workerEvidence.kind !== tool || verifierEvidence.kind !== tool) {
    return { verified: false, reason: 'evidence_kind_mismatch', workerKind: workerEvidence?.kind || null, verifierKind: verifierEvidence?.kind || null };
  }
  let checks;
  if (tool === 'http_probe') {
    checks = {
      worker2xx: workerEvidence.httpStatus >= 200 && workerEvidence.httpStatus < 300,
      verifier2xx: verifierEvidence.httpStatus >= 200 && verifierEvidence.httpStatus < 300,
      sameTarget: workerEvidence.target === input.target && verifierEvidence.target === input.target,
    };
  } else if (tool === 'database_health') {
    checks = { workerHealthy: workerEvidence.ok === true, verifierHealthy: verifierEvidence.ok === true, sameSchema: workerEvidence.schemaDigest === verifierEvidence.schemaDigest };
  } else if (tool === 'service_status') {
    checks = { allActive: workerEvidence.allActive === true && verifierEvidence.allActive === true, sameSnapshot: workerEvidence.snapshotDigest === verifierEvidence.snapshotDigest };
  } else if (tool === 'release_inventory') {
    checks = { sameRelease: workerEvidence.release === verifierEvidence.release, sameSnapshot: workerEvidence.snapshotDigest === verifierEvidence.snapshotDigest, migrationsPresent: verifierEvidence.migrationCount > 0 };
  } else if (tool === 'workspace_inventory') {
    checks = { sameWorkspace: workerEvidence.scope === input.scope && verifierEvidence.scope === input.scope, verifierHasEntries: verifierEvidence.count > 0 };
  } else if (tool === 'backup_verify') {
    checks = { sameBackup: workerEvidence.backupId === verifierEvidence.backupId, checksumValid: workerEvidence.checksumValid === true && verifierEvidence.checksumValid === true, restoreProven: Number(verifierEvidence.tableCount) > 0 };
  } else {
    return { verified: false, reason: 'unsupported_tool' };
  }
  return { verified: Object.values(checks).every(Boolean), checks, verifierEvidence, verifiedAt: new Date().toISOString() };
}

export const toolCatalog = [
  { name: 'http_probe', risk: 'safe', description: 'Probe the JARVIS or HotelsVendors public health endpoint.' },
  { name: 'database_health', risk: 'safe', description: 'Read JARVIS database identity, table and workflow counts.' },
  { name: 'service_status', risk: 'safe', description: 'Read allowlisted systemd service state.' },
  { name: 'release_inventory', risk: 'safe', description: 'Verify the active release and migration inventory.' },
  { name: 'workspace_inventory', risk: 'safe', description: 'Inventory an allowlisted project or service directory.' },
  { name: 'backup_verify', risk: 'safe', description: 'Verify the newest restore-tested database backup.' },
];
