import { query } from './db.js';
import { classifyIncident, incidentDedupeKey } from './incident-policy.js';

export async function recordIncident(input, context = {}) {
  const incident = classifyIncident(input, context);
  const dedupeKey = incidentDedupeKey(incident);
  const result = await query(`INSERT INTO incidents
    (dedupe_key,project_code,source_type,source_id,title,detail,failure_class,severity,next_action,repair_action,evidence,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
    ON CONFLICT (dedupe_key) DO UPDATE SET
      title=EXCLUDED.title,detail=EXCLUDED.detail,severity=EXCLUDED.severity,
      next_action=EXCLUDED.next_action,repair_action=EXCLUDED.repair_action,
      evidence=incidents.evidence || EXCLUDED.evidence,updated_at=now()
    RETURNING *`, [dedupeKey, incident.projectCode, incident.sourceType, incident.sourceId, incident.title, incident.detail, incident.failureClass, incident.severity, incident.nextAction, incident.repairAction, JSON.stringify(context.evidence || {})]);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', ['incident-policy', 'incident.recorded', 'incident', result.rows[0].id, { failureClass: incident.failureClass, severity: incident.severity, sourceType: incident.sourceType, sourceId: incident.sourceId }]);
  return result.rows[0];
}

export async function listIncidents() {
  const result = await query('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 200');
  return { incidents: result.rows };
}

export async function diagnoseIncident(id, actor = 'operations') {
  const current = await query("SELECT * FROM incidents WHERE id=$1 AND status IN ('open','failed')", [id]);
  if (!current.rows.length) throw Object.assign(new Error('Incident is not available for diagnosis'), { statusCode: 409 });
  const incident = current.rows[0];
  const safeAutonomous = ['transient','infrastructure'].includes(incident.failure_class);
  const status = safeAutonomous && incident.attempts < incident.max_attempts ? 'repairing' : 'waiting_owner';
  const result = await query('UPDATE incidents SET status=$2,attempts=attempts+1,next_action=$3,updated_at=now() WHERE id=$1 RETURNING *', [id, status, safeAutonomous ? 'Run the bounded repair playbook and re-observe evidence.' : 'Wait for an explicit Owner decision or specialist diagnosis.']);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'incident.diagnosed', 'incident', id, { failureClass: incident.failure_class, status }]);
  return result.rows[0];
}
