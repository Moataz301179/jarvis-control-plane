#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { query, pool } from '../lib/db.js';
import { decryptSecret } from '../lib/secrets.js';

const STATE_FILE = process.env.JARVIS_WATCHDOG_STATE || '/srv/jarvis/shared/watchdog-state.json';
const PUBLIC_HEALTH_URL = process.env.JARVIS_WATCHDOG_URL || 'https://jarvis.187-77-181-3.nip.io/health';
const ALERT_REPEAT_MS = 60 * 60 * 1000;
const SERVICE_LIST = ['jarvis-api', 'jarvis-worker', 'jarvis-verifier', 'jarvis-operations', 'jarvis-telegram'];

async function readState() {
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); } catch { return {}; }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true }).catch(() => {});
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function telegram() {
  const rows = await query("SELECT * FROM provider_credentials WHERE provider='telegram'");
  if (!rows.rows.length) return null;
  try {
    return { token: decryptSecret(rows.rows[0].encrypted_key), chatId: String(rows.rows[0].metadata?.chat_id || '') };
  } catch { return null; }
}

async function alert(text) {
  const creds = await telegram();
  if (!creds?.token || !creds.chatId) return false;
  const response = await fetch(`https://api.telegram.org/bot${creds.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: creds.chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  return Boolean(response?.ok);
}

async function checkHealth() {
  try {
    const response = await fetch(PUBLIC_HEALTH_URL, { signal: AbortSignal.timeout(15000) });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok && body?.ok === true, status: response.status, detail: body?.database || null };
  } catch (error) {
    return { ok: false, status: 0, detail: error.message };
  }
}

async function checkServices() {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const results = [];
  for (const service of SERVICE_LIST) {
    try {
      const { stdout } = await run('systemctl', ['is-active', service], { timeout: 5000 });
      results.push({ service, active: stdout.trim() === 'active' });
    } catch {
      results.push({ service, active: false });
    }
  }
  return results;
}

async function checkDisk() {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const { stdout } = await run('df', ['-P', '/srv'], { timeout: 5000 });
  const line = stdout.trim().split('\n').pop() || '';
  const parts = line.split(/\s+/);
  const usedPercent = Number(String(parts[4] || '0').replace('%', ''));
  return { usedPercent, ok: usedPercent < 90 };
}

async function checkDatabase() {
  try {
    await query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

async function checkBackup() {
  try {
    const rows = await query("SELECT completed_at FROM backup_runs WHERE status='succeeded' ORDER BY completed_at DESC LIMIT 1");
    const last = rows.rows[0]?.completed_at ? new Date(rows.rows[0].completed_at) : null;
    if (!last) return { ok: false, detail: 'no successful backup on record' };
    const ageHours = (Date.now() - last.getTime()) / 3600000;
    return { ok: ageHours < 48, ageHours: Number(ageHours.toFixed(1)), lastBackup: last.toISOString() };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

async function main() {
  const previous = await readState();
  const [health, services, disk, database, backup] = await Promise.all([checkHealth(), checkServices(), checkDisk(), checkDatabase(), checkBackup()]);
  const failures = [];
  if (!health.ok) failures.push(`Public endpoint unreachable (status ${health.status}${health.detail ? ` · ${health.detail}` : ''})`);
  const downServices = services.filter((s) => !s.active).map((s) => s.service);
  if (downServices.length) failures.push(`Services down: ${downServices.join(', ')}`);
  if (!disk.ok) failures.push(`Disk usage critical: ${disk.usedPercent}%`);
  if (!database.ok) failures.push(`Database error: ${database.detail}`);
  if (!backup.ok) failures.push(`Backup stale: ${backup.detail || `${backup.ageHours}h old`}`);
  const failing = failures.length > 0;
  const wasFailing = Boolean(previous.failing);
  const lastAlertAt = Number(previous.lastAlertAt || 0);
  const now = Date.now();
  let alerted = false;
  if (failing && (!wasFailing || now - lastAlertAt > ALERT_REPEAT_MS)) {
    await alert(`JARVIS INCIDENT\n${failures.join('\n')}\n\nChecked ${new Date().toISOString()}`);
    alerted = true;
  }
  if (!failing && wasFailing) {
    await alert(`JARVIS RECOVERED\nAll checks passing again.\n\nChecked ${new Date().toISOString()}`);
    alerted = true;
  }
  await writeState({
    checkedAt: new Date().toISOString(),
    failing,
    failures,
    alerted,
    lastAlertAt: alerted ? now : lastAlertAt,
    checks: { health, services, disk, database, backup },
  });
  if (failing) process.exitCode = 2;
}

main().catch(async (error) => {
  await alert(`JARVIS WATCHDOG ERROR\n${error.message}`).catch(() => {});
  process.exitCode = 1;
}).finally(async () => pool.end());
