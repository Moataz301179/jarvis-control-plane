import { config } from './lib/config.js';
import { pool, transaction, audit } from './lib/db.js';
import { executeTool } from './lib/tools.js';
import { signalQueue, waitForSignal } from './lib/redis.js';

let stopping = false;
let currentTaskId = null;

async function heartbeat() {
  const response = await fetch(`${config.apiBaseUrl}/v1/workers/heartbeat`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.workerSecret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ current_task_id: currentTaskId }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Worker heartbeat failed with HTTP ${response.status}`);
}

async function heartbeatUntilReady() {
  while (!stopping) {
    try { await heartbeat(); return; }
    catch (error) {
      console.error(`Worker heartbeat unavailable: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function claimTask() {
  return transaction(async (client) => {
    const worker = await client.query('SELECT id,last_seen FROM workers WHERE id=$1 AND active=true FOR UPDATE', [config.workerId]);
    if (!worker.rows.length || !worker.rows[0].last_seen || Date.now() - new Date(worker.rows[0].last_seen).getTime() > 60000) return null;
    const task = await client.query(`
      SELECT t.*, o.status AS objective_status
      FROM tasks t JOIN objectives o ON o.id=t.objective_id
      WHERE t.status='queued' AND t.available_at<=now() AND o.status IN ('queued','running','verifying')
      ORDER BY t.created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    if (!task.rows.length) return null;
    const row = task.rows[0];
    await client.query("UPDATE tasks SET status='running',attempts=attempts+1,lease_owner=$2,lease_kind='worker',lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=$1", [row.id, config.workerId]);
    await client.query("UPDATE objectives SET status='running',updated_at=now() WHERE id=$1 AND status='queued'", [row.objective_id]);
    await client.query('UPDATE workers SET current_task_id=$2,last_seen=now() WHERE id=$1', [config.workerId, row.id]);
    await audit(client, `worker:${config.workerId}`, 'task.claimed', 'task', row.id, { attempt: row.attempts + 1 });
    return row;
  });
}

async function execute(task) {
  currentTaskId = task.id;
  try {
    const evidence = await executeTool(task.tool, task.input);
    await transaction(async (client) => {
      await client.query("UPDATE tasks SET status='executed',evidence=$2,lease_owner=NULL,lease_kind='worker',lease_until=NULL,error=NULL,updated_at=now() WHERE id=$1", [task.id, JSON.stringify(evidence)]);
      await client.query('UPDATE workers SET current_task_id=NULL,last_seen=now() WHERE id=$1', [config.workerId]);
      await audit(client, `worker:${config.workerId}`, 'task.executed', 'task', task.id, { httpStatus: evidence.httpStatus, target: evidence.target });
    });
    await signalQueue();
  } catch (error) {
    await transaction(async (client) => {
      const retry = task.attempts + 1 < task.max_attempts;
      await client.query(
        "UPDATE tasks SET status=$2,available_at=now()+(($3)::text||' seconds')::interval,lease_owner=NULL,lease_until=NULL,error=$4,evidence=COALESCE($5,evidence),updated_at=now() WHERE id=$1",
        [task.id, retry ? 'queued' : 'failed', String(Math.min(60, 2 ** (task.attempts + 1))), error.message.slice(0, 2000), error.evidence ? JSON.stringify(error.evidence) : null],
      );
      await client.query('UPDATE workers SET current_task_id=NULL,last_seen=now() WHERE id=$1', [config.workerId]);
      await audit(client, `worker:${config.workerId}`, retry ? 'task.retry_scheduled' : 'task.failed', 'task', task.id, { error: error.message });
    });
    if (task.attempts + 1 < task.max_attempts) await signalQueue();
  } finally {
    currentTaskId = null;
  }
}

async function main() {
  await heartbeatUntilReady();
  if (stopping) return;
  let heartbeatBusy = false;
  setInterval(() => {
    if (heartbeatBusy || stopping) return;
    heartbeatBusy = true;
    heartbeat().catch((error) => console.error(`Worker heartbeat: ${error.message}`)).finally(() => { heartbeatBusy = false; });
  }, 10000).unref();
  while (!stopping) {
    try {
      const task = await claimTask();
      if (task) {
        await execute(task);
        continue;
      }
    } catch (error) {
      console.error(`Worker claim failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    try {
      await waitForSignal(Math.min(config.workerPollSeconds, 5));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, config.workerPollSeconds * 1000));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => pool.end());

for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; });
