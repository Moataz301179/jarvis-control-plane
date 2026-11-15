import { query, transaction } from './db.js';
import { queueNotification } from './notifications.js';
import { recordIncident } from './incidents.js';
import { TRIGGER_HANDLERS, triggerHandlerFor } from './trigger-policy.js';
export { TRIGGER_HANDLERS, triggerHandlerFor };

export async function enqueueWorkflowEvent({ eventType, projectCode = 'STUDIO', entityType, entityId, dedupeKey, producer = 'jarvis', payload = {}, availableAt = null }) {
  if (!triggerHandlerFor(eventType)) throw Object.assign(new Error(`Unknown trigger: ${eventType}`), { statusCode: 400 });
  const result = await query(`INSERT INTO workflow_events
    (event_type,project_code,entity_type,entity_id,dedupe_key,producer,payload,available_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,now()))
    ON CONFLICT (dedupe_key) DO UPDATE SET payload=workflow_events.payload || EXCLUDED.payload,updated_at=now()
    RETURNING *`, [eventType, String(projectCode).toUpperCase(), entityType, String(entityId), dedupeKey, producer, JSON.stringify(payload), availableAt]);
  return result.rows[0];
}

async function handleEvent(event) {
  const handler = triggerHandlerFor(event.event_type);
  if (!handler) throw new Error(`Unknown trigger: ${event.event_type}`);
  const payload = event.payload || {};
  if (handler === 'notify') {
    const critical = payload.severity === 'critical' || event.event_type === 'task.verification_failed';
    await queueNotification({
      dedupeKey: `workflow:${event.id}`,
      projectCode: event.project_code,
      eventType: event.event_type,
      severity: critical ? 'critical' : payload.severity === 'warning' ? 'warning' : 'info',
      title: String(payload.title || event.event_type).slice(0, 500),
      detail: String(payload.detail || `${event.entity_type} ${event.entity_id}`).slice(0, 5000),
    });
    return { handledBy: 'notification-outbox' };
  }
  if (handler === 'incident') {
    const incident = await recordIncident(payload.error || payload.detail || event.event_type, {
      title: payload.title || event.event_type,
      detail: payload.detail || payload.error,
      projectCode: event.project_code,
      sourceType: event.entity_type,
      sourceId: event.entity_id,
      evidence: payload.evidence || {},
    });
    return { handledBy: 'incident-policy', incidentId: incident.id, failureClass: incident.failure_class };
  }
  return { handledBy: 'state-transition' };
}

export async function processWorkflowEvents(limit = 20) {
  const processed = [];
  for (let index = 0; index < limit; index += 1) {
    const claimed = await transaction(async (client) => {
      const result = await client.query("SELECT * FROM workflow_events WHERE status IN ('pending','failed') AND available_at<=now() AND attempts<5 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
      if (!result.rows.length) return null;
      const event = result.rows[0];
      const updated = await client.query("UPDATE workflow_events SET status='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=$1 RETURNING *", [event.id]);
      return updated.rows[0];
    });
    if (!claimed) break;
    try {
      const result = await handleEvent(claimed);
      const completed = await query("UPDATE workflow_events SET status='completed',lease_until=NULL,completed_at=now(),updated_at=now() WHERE id=$1 RETURNING *", [claimed.id]);
      processed.push({ event: completed.rows[0], result });
    } catch (error) {
      const dead = claimed.attempts >= 5;
      await query("UPDATE workflow_events SET status=$2,lease_until=NULL,last_error=$3,available_at=now()+(($4)::text||' seconds')::interval,updated_at=now() WHERE id=$1", [claimed.id, dead ? 'dead' : 'failed', String(error.message).slice(0, 3000), String(Math.min(300, 2 ** claimed.attempts))]);
      const incident = await recordIncident(error, { title: `Trigger failed: ${claimed.event_type}`, projectCode: claimed.project_code, sourceType: 'workflow_event', sourceId: claimed.id, evidence: { eventType: claimed.event_type, attempts: claimed.attempts } });
      processed.push({ event: claimed, result: { error: error.message, incidentId: incident.id } });
    }
  }
  return processed;
}
