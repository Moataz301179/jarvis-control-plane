import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { config } from './config.js';
import { query } from './db.js';

const CORE_TABLES = [
  'objectives','tasks','workers','approvals','audit_events','conversations','chat_messages',
  'studio_projects','studio_agents','studio_tasks','studio_alerts','venture_ideas',
  'agent_registry','agent_runs','mac_jobs','shared_memory_entries','hermes_jobs','inference_usage',
  'agent_model_routes','autonomy_rules','workflow_events','incidents',
  'agent_capability_registry','account_connection_sessions',
];

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function run(command, args, input = null) {
  const child = spawn(command, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  if (input) {
    child.stdin.end(input);
  }
  const [code] = await once(child, 'close');
  if (code !== 0) throw new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`);
  return { stdout, stderr };
}

function schemaRewrite(sql, schema) {
  return sql
    .replace(/^CREATE SCHEMA public;\s*$/gm, '')
    .replace(/^COMMENT ON SCHEMA public IS .*?;\s*$/gm, '')
    .replaceAll('public.', `${schema}.`);
}

async function restoreProof(sql, schema) {
  const rewritten = schemaRewrite(sql, schema);
  await run('psql', ['--dbname', config.databaseUrl, '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--quiet'], rewritten);
  const tables = await query('SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name', [schema]);
  const names = tables.rows.map((row) => row.table_name);
  let rowCount = 0;
  const counts = {};
  for (const name of names) {
    if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Unexpected restored table name: ${name}`);
    const count = await query(`SELECT count(*)::bigint AS count FROM "${schema}"."${name}"`);
    counts[name] = Number(count.rows[0].count);
    rowCount += counts[name];
  }
  const missing = CORE_TABLES.filter((name) => !names.includes(name));
  if (missing.length) throw new Error(`Restore is missing core tables: ${missing.join(', ')}`);
  return { schema, tableCount: names.length, rowCount, counts };
}

export async function runBackupVerification() {
  const started = new Date();
  const runResult = await query("INSERT INTO backup_runs (status) VALUES ('running') RETURNING *");
  const backupRun = runResult.rows[0];
  const schema = `jarvis_restore_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const workingDirectory = await fs.mkdtemp('/tmp/jarvis-backup-');
  const sqlPath = path.join(workingDirectory, 'jarvis.sql');
  await fs.mkdir(config.backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(config.backupDir, `jarvis-${stamp()}.sql.gz`);
  try {
    await run('pg_dump', ['--dbname', config.databaseUrl, '--format=plain', '--no-owner', '--no-privileges', '--schema=public', '--file', sqlPath]);
    await pipeline(createReadStream(sqlPath), createGzip({ level: 9 }), createWriteStream(backupPath, { mode: 0o600 }));
    const compressed = await fs.readFile(backupPath);
    await query('CREATE SCHEMA IF NOT EXISTS "' + schema.replaceAll('"', '""') + '"');
    const sql = await fs.readFile(sqlPath, 'utf8');
    const proof = await restoreProof(sql, schema);
    const completed = new Date();
    const evidence = {
      startedAt: started.toISOString(),
      completedAt: completed.toISOString(),
      durationMs: completed.getTime() - started.getTime(),
      coreTables: CORE_TABLES,
      restoredTables: proof.tableCount,
      restoredRows: proof.rowCount,
      rowCounts: proof.counts,
    };
    const saved = await query("UPDATE backup_runs SET status='succeeded',backup_path=$2,backup_sha256=$3,backup_bytes=$4,restore_schema=$5,table_count=$6,row_count=$7,evidence=$8,completed_at=now() WHERE id=$1 RETURNING *", [backupRun.id, backupPath, sha256(compressed), compressed.length, schema, proof.tableCount, proof.rowCount, JSON.stringify(evidence)]);
    return saved.rows[0];
  } catch (error) {
    await query("UPDATE backup_runs SET status='failed',error=$2,completed_at=now() WHERE id=$1", [backupRun.id, String(error.message).slice(0, 5000)]).catch(() => {});
    throw error;
  } finally {
    await query('DROP SCHEMA IF EXISTS "' + schema.replaceAll('"', '""') + '" CASCADE').catch(() => {});
    await fs.rm(workingDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

export async function backupState() {
  const result = await query('SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT 20');
  return { runs: result.rows };
}

export async function runBackupIfDue(maxAgeHours = 24) {
  const latest = await query("SELECT id,completed_at FROM backup_runs WHERE status='succeeded' ORDER BY completed_at DESC LIMIT 1");
  const completed = latest.rows[0]?.completed_at ? new Date(latest.rows[0].completed_at).getTime() : 0;
  if (completed && Date.now() - completed < maxAgeHours * 3600000) return { skipped: true, backup: latest.rows[0] };
  return { skipped: false, backup: await runBackupVerification() };
}
