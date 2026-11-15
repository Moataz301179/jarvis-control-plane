import { config } from './lib/config.js';
import { pool, query, transaction } from './lib/db.js';
import { queueNotification, drainNotifications } from './lib/notifications.js';
import { runBackupIfDue } from './lib/backup.js';
import { AUTO_APPROVAL_TOOLS } from './lib/tools.js';
import { syncPendingDeployments } from './lib/deployment-adapters.js';
import { processWorkflowEvents } from './lib/triggers.js';
import { recordIncident } from './lib/incidents.js';

let stopping = false;
let stopResolve;
const stopped = new Promise((resolve) => { stopResolve = resolve; });

function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}; stopping operations loop`);
  stopResolve();
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

async function pause(milliseconds) {
  if (stopping) return;
  let timer;
  await Promise.race([
    new Promise((resolve) => { timer = setTimeout(resolve, milliseconds); }),
    stopped,
  ]);
  clearTimeout(timer);
}

async function raiseAlert(id, projectCode, severity, title, detail) {
  const inserted = await query("INSERT INTO studio_alerts (id,project_code,severity,title,detail,status) VALUES ($1,$2,$3,$4,$5,'open') ON CONFLICT (id) DO NOTHING RETURNING id", [id, projectCode, severity, title, detail]);
  if (inserted.rows.length) await queueNotification({ dedupeKey: `alert:${id}`, projectCode, eventType: 'operations.alert', severity, title, detail });
}

async function ensureRoadmapTasks() {
  const [controls, tasks] = await Promise.all([query('SELECT * FROM project_controls'), query('SELECT project_code,title FROM studio_tasks')]);
  for (const control of controls.rows) {
    const roadmap = Array.isArray(control.roadmap) ? control.roadmap : [];
    const existing = new Set(tasks.rows.filter((task) => task.project_code === control.project_code).map((task) => task.title));
    const index = roadmap.findIndex((title) => !existing.has(String(title)));
    if (index < 0) continue;
    const id = `roadmap-${control.project_code.toLowerCase()}-${index + 1}`;
    await query("INSERT INTO studio_tasks (id,project_code,title,status,priority,owner_agent,details,acceptance_criteria) VALUES ($1,$2,$3,'open','high',$4,$5,$6) ON CONFLICT (id) DO NOTHING", [id, control.project_code, String(roadmap[index]), control.manager, 'Roadmap step registered by the JARVIS continuous operations loop.', JSON.stringify(['Scope is defined', 'Evidence is recorded', 'Completion is independently verified'])]);
  }
}

async function recoverExpiredWork() {
  const recovered = await transaction(async (client) => {
    const expiredTasks = await client.query("SELECT id,objective_id,attempts,max_attempts,lease_owner,lease_kind FROM tasks WHERE status='running' AND lease_until<now() FOR UPDATE SKIP LOCKED");
    for (const task of expiredTasks.rows) {
      const verifier = task.lease_kind === 'verifier';
      const status = verifier ? 'executed' : task.attempts < task.max_attempts ? 'queued' : 'failed';
      await client.query('UPDATE tasks SET status=$2,lease_owner=NULL,lease_until=NULL,error=CASE WHEN $2=\'failed\' THEN \'Recovered after expired lease\' ELSE error END,updated_at=now() WHERE id=$1', [task.id, status]);
      await client.query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', ['operations', 'task.lease_recovered', 'task', task.id, { previousOwner: task.lease_owner, previousKind: task.lease_kind, status }]);
    }
    const expiredHermes = await client.query("SELECT id,project_code,attempts FROM hermes_jobs WHERE status IN ('claimed','running') AND lease_until<now() FOR UPDATE SKIP LOCKED");
    for (const job of expiredHermes.rows) {
      const status = job.attempts < 3 ? 'queued' : 'failed';
      await client.query("UPDATE hermes_jobs SET status=$2,claimed_by=NULL,lease_until=NULL,error=CASE WHEN $2='failed' THEN 'Hermes lease expired after maximum attempts' ELSE error END,updated_at=now() WHERE id=$1", [job.id, status]);
      await client.query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', ['operations', 'hermes.lease_recovered', 'hermes_job', job.id, { status, attempts: job.attempts }]);
    }
    return { tasks: expiredTasks.rowCount, hermes: expiredHermes.rowCount };
  });
  if (recovered.tasks || recovered.hermes) console.log(`Recovered expired work: ${JSON.stringify(recovered)}`);
}

async function reconcileObjectives() {
  const result = await query(`
    WITH terminal AS (
      SELECT o.id,
             count(t.id)::int AS total,
             count(*) FILTER (WHERE t.status IN ('verified','failed'))::int AS terminal,
             count(*) FILTER (WHERE t.status='failed')::int AS failed
      FROM objectives o JOIN tasks t ON t.objective_id=o.id
      WHERE o.status IN ('queued','running','verifying')
      GROUP BY o.id
    )
    UPDATE objectives o SET status='failed',updated_at=now()
    FROM terminal x
    WHERE o.id=x.id AND x.total>0 AND x.total=x.terminal AND x.failed>0
    RETURNING o.id`);
  for (const objective of result.rows) {
    await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', ['operations', 'objective.failed_after_terminal_tasks', 'objective', objective.id, { reconciled: true }]);
    await queueNotification({ dedupeKey: `objective:${objective.id}:failed`, eventType: 'objective.failed', severity: 'critical', title: 'Objective failed during reconciliation', detail: `Objective ${objective.id} had terminal failed tasks and has been reconciled to failed.` });
  }
  return result.rowCount;
}

async function api(path, body = null) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: body === null ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
    body: body === null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `${path} returned HTTP ${response.status}`);
  return result;
}

async function claimNextSchedule() {
  return transaction(async (client) => {
    const result = await client.query('SELECT * FROM automation_schedules WHERE enabled=true AND next_run_at<=now() ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1');
    if (!result.rows.length) return null;
    const schedule = result.rows[0];
    await client.query("UPDATE automation_schedules SET next_run_at=now()+($2::text||' minutes')::interval,updated_at=now() WHERE id=$1", [schedule.id, schedule.interval_minutes]);
    return schedule;
  });
}

async function executeSchedule(schedule) {
  try {
    const mission = await api('/v1/studio/tasks', { project_code: schedule.project_code, title: schedule.title, details: schedule.details, owner_agent: schedule.owner_agent, priority: schedule.priority, acceptance_criteria: ['Execution evidence is recorded', 'Independent verification passes'] });
    let objective = await api(`/v1/studio/tasks/${encodeURIComponent(mission.id)}/plan`, {});
    let status = objective.status;
    if (schedule.approval_policy === 'standing_safe') {
      const unsafe = objective.tasks.some((task) => !AUTO_APPROVAL_TOOLS.has(task.tool));
      if (unsafe) {
        status = 'awaiting_owner_approval';
        await queueNotification({ dedupeKey: `schedule-approval:${schedule.id}:${objective.id}`, projectCode: schedule.project_code, eventType: 'schedule.approval_required', severity: 'warning', title: `Approval required: ${schedule.title}`, detail: 'The generated plan contains a tool outside the standing safe approval policy.' });
      } else if (objective.status === 'awaiting_approval') {
        objective = await api(`/v1/objectives/${objective.id}/approvals`, { decision: 'approved', note: `Standing safe approval from schedule ${schedule.id}` });
        status = objective.status;
      } else {
        status = objective.status;
      }
    }
    await query('UPDATE automation_schedules SET last_run_at=now(),last_objective_id=$2,last_status=$3,last_error=NULL,updated_at=now() WHERE id=$1', [schedule.id, objective.id, status]);
    await query("INSERT INTO studio_activity (project_code,actor,event_type,detail) VALUES ($1,'Scheduler','scheduled_mission_started',$2)", [schedule.project_code, `${schedule.title} → ${objective.id}`]);
  } catch (error) {
    await query("UPDATE automation_schedules SET last_run_at=now(),last_status='failed',last_error=$2,next_run_at=now()+interval '1 minute',updated_at=now() WHERE id=$1", [schedule.id, String(error.message).slice(0, 3000)]);
    await queueNotification({ dedupeKey: `schedule-failed:${schedule.id}:${new Date().toISOString().slice(0,16)}`, projectCode: schedule.project_code, eventType: 'schedule.failed', severity: 'critical', title: `Scheduled mission failed: ${schedule.title}`, detail: error.message });
  }
}

async function runDueSchedules() {
  for (let count = 0; count < 5 && !stopping; count += 1) {
    const schedule = await claimNextSchedule();
    if (!schedule) return;
    await executeSchedule(schedule);
  }
}

async function enqueueObjectiveNotifications() {
  const result = await query("SELECT id,title,status,updated_at FROM objectives WHERE status IN ('completed','failed') AND updated_at>now()-interval '2 days' ORDER BY updated_at DESC LIMIT 50");
  for (const objective of result.rows) {
    await queueNotification({
      dedupeKey: `objective:${objective.id}:${objective.status}`,
      eventType: `objective.${objective.status}`,
      severity: objective.status === 'completed' ? 'info' : 'critical',
      title: `Objective ${objective.status}: ${objective.title}`,
      detail: `Objective ${objective.id} reached ${objective.status} at ${new Date(objective.updated_at).toISOString()}.`,
    });
  }
}

async function syncDeployments() {
  const synced = await syncPendingDeployments(10);
  for (const deployment of synced) {
    if (!deployment?.id || !['succeeded','failed','cancelled'].includes(deployment.status)) continue;
    await queueNotification({
      dedupeKey: `deployment:${deployment.id}:${deployment.status}`,
      projectCode: deployment.project_code,
      eventType: `deployment.${deployment.status}`,
      severity: deployment.status === 'succeeded' ? 'info' : 'critical',
      title: `Deployment ${deployment.status} for ${deployment.project_code}`,
      detail: `Deployment request ${deployment.id} completed with status ${deployment.status}${deployment.github_run_url ? `: ${deployment.github_run_url}` : ''}.`,
    });
  }
}

async function auditState() {
  const [workers, mac, hermes, runs, hv] = await Promise.all([
    query('SELECT last_seen FROM workers WHERE active=true'),
    query("SELECT * FROM mac_bridge_status WHERE id='primary'"),
    query("SELECT gateway_status,last_seen FROM hermes_bridge_status WHERE id='primary'"),
    query("SELECT * FROM agent_runs WHERE status IN ('paused','blocked') ORDER BY updated_at DESC"),
    fetch(config.hotelsVendorsHealthUrl, { signal: AbortSignal.timeout(8000) }).then((response) => response.ok).catch(() => false),
  ]);
  const now = Date.now();
  const online = workers.rows.some((worker) => worker.last_seen && now - new Date(worker.last_seen).getTime() < 60000);
  if (!online) {
    await raiseAlert(`ops-worker-offline-${new Date().toISOString().slice(0,10)}`, 'STUDIO', 'critical', 'No authenticated worker heartbeat', 'JARVIS cannot claim queued work until a worker reconnects.');
    await recordIncident('worker heartbeat offline; no authenticated worker can claim queued work', { title: 'No authenticated worker heartbeat', projectCode: 'STUDIO', sourceType: 'worker', sourceId: 'primary', evidence: { workers: workers.rows } });
  }
  const macBridge = mac.rows[0];
  if (!macBridge || macBridge.status !== 'online' || !macBridge.last_seen || now - new Date(macBridge.last_seen).getTime() > 10 * 60 * 1000) await raiseAlert(`ops-mac-offline-${new Date().toISOString().slice(0,10)}`, 'STUDIO', 'warning', 'Mac bridge has been offline for over 10 minutes', 'Desktop, file and Terminal operations are unavailable.');
  const hermesBridge = hermes.rows[0];
  if (!hermesBridge || hermesBridge.gateway_status !== 'online' || !hermesBridge.last_seen || now - new Date(hermesBridge.last_seen).getTime() > 120000) {
    await raiseAlert(`ops-hermes-offline-${new Date().toISOString().slice(0,10)}`, 'STUDIO', 'critical', 'Hermes execution bridge is offline', 'Specialist Hermes missions cannot be claimed.');
    await recordIncident('Hermes bridge heartbeat missed or gateway offline', { title: 'Hermes execution bridge is offline', projectCode: 'STUDIO', sourceType: 'hermes_bridge', sourceId: 'primary', evidence: hermesBridge || {} });
  }
  for (const run of runs.rows) await raiseAlert(`ops-run-${run.id}`, run.project_code || 'STUDIO', run.status === 'blocked' ? 'critical' : 'warning', `Agent run ${run.status}`, `${run.agent_id}: ${run.objective}`);
  if (!hv) {
    await raiseAlert(`ops-hv-health-${new Date().toISOString().slice(0,13)}`, 'HV', 'critical', 'HotelsVendors health check failed', 'The public HotelsVendors health endpoint did not return HTTP 2xx.');
    await recordIncident('HotelsVendors public health endpoint unavailable', { title: 'HotelsVendors health check failed', projectCode: 'HV', sourceType: 'health', sourceId: 'hotelsvendors-public', evidence: { endpoint: config.hotelsVendorsHealthUrl } });
  }
}

async function cycle() {
  await recoverExpiredWork();
  await processWorkflowEvents(20);
  await reconcileObjectives();
  await ensureRoadmapTasks();
  await runDueSchedules();
  await auditState();
  await syncDeployments();
  await enqueueObjectiveNotifications();
  await drainNotifications(20);
  try { await runBackupIfDue(24); }
  catch (error) {
    await raiseAlert(`ops-backup-failed-${new Date().toISOString().slice(0,13)}`, 'STUDIO', 'critical', 'Database backup verification failed', error.message);
  }
}

async function main() {
  while (!stopping) {
    try { await cycle(); }
    catch (error) { console.error(new Date().toISOString(), error.message); }
    await pause(Math.max(5, config.operationsPollSeconds) * 1000);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await pool.end().catch(() => {}); });
