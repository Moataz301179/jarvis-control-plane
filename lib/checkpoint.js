import crypto from 'node:crypto';
import { query, transaction, audit } from './db.js';

export async function createCheckpoint({ job_id, run_id = null, step = null, status = 'checkpointed', state = {}, result = null }, actor = 'jarvis') {
  const payload = JSON.stringify(state);
  const stateDigest = crypto.createHash('sha256').update(payload).digest('hex');
  const rows = await query(
    `INSERT INTO execution_checkpoints (job_id,run_id,step,status,state,state_digest,result)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,job_id,run_id,step,status,state,state_digest,result,created_at`,
    [String(job_id), run_id ? String(run_id) : null, step ?? null, String(status || 'checkpointed'), payload, stateDigest, result ? JSON.stringify(result) : null],
  );
  const row = rows.rows[0];
  await audit(null, actor, 'checkpoint.created', 'execution_checkpoint', String(row.id), { jobId: row.job_id, step: row.step, digest: stateDigest });
  return {
    id: row.id, job_id: row.job_id, run_id: row.run_id, step: row.step, status: row.status,
    state: row.state, state_digest: row.state_digest, result: row.result, created_at: row.created_at,
  };
}

export async function resumeCheckpoint(jobId) {
  const rows = await query(
    `SELECT id,run_id FROM checkpoint_runs WHERE job_id=$1 ORDER BY id DESC LIMIT 1`,
    [String(jobId)],
  );
  if (rows.rows[0]?.run_id) {
    await query(`UPDATE checkpoint_runs SET resume_count=resume_count+1 WHERE run_id=$1`, [rows.rows[0].run_id]);
    const runId = rows.rows[0].run_id;
    const cps = await query(
      `SELECT id,job_id,run_id,step,status,state,state_digest,result,created_at FROM execution_checkpoints WHERE run_id=$1 ORDER BY id DESC LIMIT 1`,
      [runId],
    );
    const row = cps.rows[0];
    if (!row) return { job_id: String(jobId), run_id: null, checkpoint: null, resume_attempted: true };
    return {
      job_id: row.job_id, run_id: row.run_id, resume_attempted: true,
      checkpoint: {
        id: row.id, step: row.step, status: row.status, state: row.state,
        state_digest: row.state_digest, result: row.result, created_at: row.created_at,
      },
    };
  }
  const fresh = await query(
    `SELECT id,job_id,run_id,step,status,state,state_digest,result,created_at FROM execution_checkpoints WHERE job_id=$1 ORDER BY id DESC LIMIT 1`,
    [String(jobId)],
  );
  const row = fresh.rows[0];
  if (!row) return { job_id: String(jobId), run_id: null, checkpoint: null, resume_attempted: true };
  const started = await query(
    `INSERT INTO checkpoint_runs (job_id) VALUES ($1) RETURNING id,job_id,run_id,resume_count,started_at`,
    [String(jobId)],
  );
  const run = started.rows[0];
  const updated = await query(`UPDATE execution_checkpoints SET run_id=$1 WHERE id=$2`, [run.run_id, row.id]);
  await audit(null, 'jarvis', 'checkpoint.resumed', 'execution_checkpoint', String(row.id), { runId: run.run_id, rows: updated.rowCount });
  return {
    job_id: row.job_id, run_id: run.run_id, resume_attempted: true,
    checkpoint: {
      id: row.id, step: row.step, status: row.status, state: row.state,
      state_digest: row.state_digest, result: row.result, created_at: row.created_at,
    },
  };
}

export async function listCheckpoints(limit = 50) {
  const rows = await query(
    'SELECT id,job_id,run_id,step,status,state,state_digest,result,created_at FROM execution_checkpoints ORDER BY id DESC LIMIT $1',
    [Math.min(Number(limit) || 50, 500)],
  );
  return rows.rows;
}
