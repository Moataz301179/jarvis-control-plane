const CLASSIFIERS = [
  { failureClass: 'transient', pattern: /timeout|timed out|temporar|rate limit|429|502|503|504|econnreset|enotfound/i, severity: 'medium', repairAction: 'bounded_retry', nextAction: 'Retry after the configured backoff and preserve idempotency.' },
  { failureClass: 'model_route', pattern: /model.*(?:missing|not found|unavailable)|provider.*(?:failed|unavailable)|no free model|zero-cost/i, severity: 'high', repairAction: 'route_fallback', nextAction: 'Switch to an approved free model route or request an Owner decision.' },
  { failureClass: 'tool_contract', pattern: /unsupported tool|invalid input|validation|invalid plan|tool contract/i, severity: 'high', repairAction: 'input_repair', nextAction: 'Attempt deterministic input repair; otherwise stop the Task.' },
  { failureClass: 'workspace', pattern: /workspace|working directory|dirty tree|missing repo|wrong branch|outside project/i, severity: 'high', repairAction: 'clean_worktree', nextAction: 'Quarantine the workspace and prepare a clean project worktree.' },
  { failureClass: 'evidence', pattern: /evidence|verification failed|commit claim|fabricat|checksum|mismatch/i, severity: 'critical', repairAction: 'independent_recheck', nextAction: 'Fail closed, preserve evidence and run an independent recheck.' },
  { failureClass: 'policy', pattern: /approval|permission|forbidden|unauthorized|policy|risk exceeds/i, severity: 'critical', repairAction: 'owner_decision', nextAction: 'Wait for an explicit Owner yes/no decision.' },
  { failureClass: 'infrastructure', pattern: /service|systemd|database|disk|redis|postgres|heartbeat|lease expired|offline/i, severity: 'high', repairAction: 'safe_recovery', nextAction: 'Run the safe infrastructure playbook and escalate if it does not recover.' },
];

export function classifyIncident(input, context = {}) {
  const text = typeof input === 'string' ? input : `${input?.message || ''} ${input?.code || ''}`;
  const match = CLASSIFIERS.find((entry) => entry.pattern.test(text)) || {
    failureClass: 'unknown', severity: 'high', repairAction: 'owner_decision', nextAction: 'Escalate to the Owner for diagnosis.',
  };
  return {
    ...match,
    title: String(context.title || `JARVIS ${match.failureClass} incident`).slice(0, 240),
    detail: String(context.detail || text || 'No diagnostic detail was supplied').slice(0, 5000),
    projectCode: String(context.projectCode || 'STUDIO').toUpperCase(),
    sourceType: String(context.sourceType || 'system'),
    sourceId: String(context.sourceId || 'unknown'),
  };
}

export function incidentDedupeKey(incident) {
  return `${incident.projectCode}:${incident.failureClass}:${incident.sourceType}:${incident.sourceId}`.slice(0, 500);
}
