import { config } from './lib/config.js';
import { pool, transaction } from './lib/db.js';
import { executeTool, verifyEvidence } from './lib/tools.js';
import { waitForSignal } from './lib/redis.js';
import { recordIncident } from './lib/incidents.js';

let stopping = false;

async function verifyOne() {
  const claimed = await transaction(async (client) => {
    const task = await client.query("SELECT * FROM tasks WHERE status='executed' ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1");
    if (!task.rows.length) return null;
    const row = task.rows[0];
    await client.query("UPDATE tasks SET status='running',lease_owner=NULL,lease_kind='verifier',lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=$1", [row.id]);
    await client.query("UPDATE objectives SET status='verifying',updated_at=now() WHERE id=$1", [row.objective_id]);
    return row;
  });
  if (!claimed) return false;

  try {
    const fresh = await executeTool(claimed.tool, claimed.input);
    const verification = verifyEvidence(claimed.tool, claimed.input, claimed.evidence, fresh);
    let failure = null;
    await transaction(async (client) => {
      if (verification.verified) {
        await client.query("UPDATE tasks SET status='verified',verification=$2,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [claimed.id, JSON.stringify(verification)]);
      } else {
        failure = { verification, error: 'Independent verification failed' };
        await client.query("UPDATE tasks SET status='failed',verification=$2,error='Independent verification failed',lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [claimed.id, JSON.stringify(verification)]);
        await client.query("UPDATE objectives SET status='failed',updated_at=now() WHERE id=$1", [claimed.objective_id]);
      }
      await client.query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', ['verifier', verification.verified ? 'task.independently_verified' : 'task.verification_failed', 'task', claimed.id, verification]);
      const remaining = await client.query("SELECT count(*) FROM tasks WHERE objective_id=$1 AND status NOT IN ('verified','failed')", [claimed.objective_id]);
      const failed = await client.query("SELECT count(*) FROM tasks WHERE objective_id=$1 AND status='failed'", [claimed.objective_id]);
      if (Number(remaining.rows[0].count) === 0) {
        if (Number(failed.rows[0].count) > 0) {
          await client.query("UPDATE objectives SET status='failed',updated_at=now() WHERE id=$1", [claimed.objective_id]);
        } else {
          const report = await client.query(`
            SELECT jsonb_build_object(
              'objectiveId',o.id,'title',o.title,'completedAt',now(),
              'acceptanceCriteria',o.acceptance_criteria,
              'tasks',jsonb_agg(jsonb_build_object('sequence',t.sequence,'title',t.title,'tool',t.tool,'status',t.status,'evidence',t.evidence,'verification',t.verification) ORDER BY t.sequence)
            ) AS report
            FROM objectives o JOIN tasks t ON t.objective_id=o.id WHERE o.id=$1 GROUP BY o.id`, [claimed.objective_id]);
          await client.query("UPDATE objectives SET status='completed',report=$2,completed_at=now(),updated_at=now() WHERE id=$1", [claimed.objective_id, JSON.stringify(report.rows[0].report)]);
          await client.query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', ['verifier', 'objective.completed', 'objective', claimed.objective_id, { taskCount: report.rows[0].report.tasks.length }]);
        }
      }
    });
    if (failure) await recordIncident(failure.error, { title: 'Independent Task verification failed', projectCode: 'STUDIO', sourceType: 'task', sourceId: claimed.id, evidence: { tool: claimed.tool, input: claimed.input, workerEvidence: claimed.evidence, verification: failure.verification } });
  } catch (error) {
    await transaction(async (client) => {
      await client.query("UPDATE tasks SET status='failed',verification=$2,error=$3,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=$1", [claimed.id, JSON.stringify({ verified: false, reason: error.message }), error.message]);
      await client.query("UPDATE objectives SET status='failed',updated_at=now() WHERE id=$1", [claimed.objective_id]);
      await client.query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', ['verifier', 'task.verification_failed', 'task', claimed.id, { error: error.message }]);
    });
    await recordIncident(error, { title: 'Verifier could not complete evidence check', sourceType: 'task', sourceId: claimed.id, evidence: { tool: claimed.tool, input: claimed.input } });
  }
  return true;
}

async function main() {
  while (!stopping) {
    if (await verifyOne()) continue;
    try { await waitForSignal(Math.min(config.verifierPollSeconds, 5)); }
    catch { await new Promise((resolve) => setTimeout(resolve, config.verifierPollSeconds * 1000)); }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => pool.end());
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; });
