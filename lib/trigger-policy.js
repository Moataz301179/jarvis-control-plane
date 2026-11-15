export const TRIGGER_HANDLERS = Object.freeze({
  'objective.planned': 'noop',
  'approval.decision': 'notify',
  'agent_job.created': 'noop',
  'agent_job.completed': 'notify',
  'build.requested': 'notify',
  'task.verification_failed': 'incident',
  'deployment.requested': 'notify',
  'deployment.succeeded': 'notify',
  'deployment.failed': 'incident',
  'heartbeat.missed': 'incident',
});

export function triggerHandlerFor(eventType) {
  return TRIGGER_HANDLERS[eventType] || null;
}
