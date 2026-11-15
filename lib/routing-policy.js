const RISK_ORDER = { safe: 0, review: 1, danger: 2 };

function normalized(value) {
  return String(value || '').trim();
}

function routeSpecificity(route, request) {
  const agent = normalized(route.agent_id);
  const project = normalized(route.project_code || '*').toUpperCase();
  const taskClass = normalized(route.task_class || 'general');
  const requestedAgent = normalized(request.agentId);
  const requestedProject = normalized(request.projectCode || '*').toUpperCase();
  const requestedTask = normalized(request.taskClass || 'general');
  if (route.enabled === false) return -1;
  if (agent !== '*' && agent !== requestedAgent) return -1;
  if (project !== '*' && project !== requestedProject) return -1;
  if (taskClass !== '*' && taskClass !== requestedTask) return -1;
  return (agent === '*' ? 0 : 4) + (project === '*' ? 0 : 2) + (taskClass === '*' ? 0 : 1);
}

export function resolveAgentModelRoute(routes, globalSettings, request) {
  const selected = [...routes]
    .map((route) => ({ route, score: routeSpecificity(route, request) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || new Date(right.route.updated_at || 0) - new Date(left.route.updated_at || 0))[0];
  const global = {
    provider: normalized(globalSettings?.provider),
    model: normalized(globalSettings?.model),
    freeOnly: true,
    source: 'global',
  };
  if (!selected) return global;
  if (selected.route.provider === 'inherit') {
    return {
      ...global,
      source: 'inherit',
      routeId: selected.route.id,
      agentId: normalized(request.agentId),
      projectCode: normalized(request.projectCode || '*').toUpperCase(),
      taskClass: normalized(request.taskClass || 'general'),
    };
  }
  return {
    provider: normalized(selected.route.provider),
    model: normalized(selected.route.model),
    freeOnly: selected.route.free_only !== false,
    source: 'agent_route',
    routeId: selected.route.id,
    agentId: normalized(request.agentId),
    projectCode: normalized(request.projectCode || '*').toUpperCase(),
    taskClass: normalized(request.taskClass || 'general'),
  };
}

export function resolveAutonomyRule(rules, request) {
  const actionKey = String(request.actionKey || '').trim();
  const projectCode = String(request.projectCode || '*').trim().toUpperCase();
  const riskLevel = String(request.riskLevel || 'safe').trim();
  const matching = rules.filter((rule) => rule.enabled !== false && rule.action_key === actionKey && (rule.project_code === projectCode || rule.project_code === '*'));
  const rule = matching.sort((left, right) => (left.project_code === projectCode ? -1 : 0) - (right.project_code === projectCode ? -1 : 0))[0];
  if (!rule) return { decision: 'owner_approval', reason: `No autonomy rule exists for ${actionKey}`, actionKey, projectCode, riskLevel };
  if ((RISK_ORDER[riskLevel] ?? 2) > (RISK_ORDER[rule.risk_level] ?? 0)) {
    return { decision: 'owner_approval', reason: `Requested risk ${riskLevel} exceeds the autonomous ceiling ${rule.risk_level}`, actionKey, projectCode, riskLevel, ruleId: rule.id };
  }
  return { decision: rule.decision, reason: rule.description, actionKey, projectCode, riskLevel, ruleId: rule.id };
}

export function classifyAction(text, fallback = 'routine_read') {
  const raw = String(text || '').toLowerCase();
  if (/\b(?:preparation|planning|work product) only\b/.test(raw) && !/\b(?:send|publish|spend|deploy|execute|submit) now\b/.test(raw)) return fallback;
  const value = raw.replace(/\b(?:no|not|never|without|do not|don['’]?t)\s+(?:send|sending|publish|publishing|spend|spending|submit|submitting|deploy|deploying|connect|connecting|post|posting|reply|replying|purchase|purchasing|pay|paying|transfer|transferring|delete|deleting)[^.;\n]*/gi, ' ');
  if (/delete|drop table|destroy|wipe|purge|truncate/.test(value)) return 'destructive_change';
  if (/ssh|firewall|permission|privilege|chmod|chown/.test(value)) return 'permission_change';
  if (/credential|secret|api key|token rotation|password/.test(value)) return 'credential_change';
  if (/pay.*(supplier|vendor|invoice|bill)|transfer (funds|money)|send (funds|money)|complete checkout|make payment|withdraw|issue refund|charge (my|the|a) card|financial commitment/.test(value)) return 'financial_action';
  if (/paid service|subscription|purchase/.test(value)) return 'paid_service';
  if (/post|publish|comment|reply|send|submit|apply|connect account|follow|unfollow/.test(value)) return 'external_commitment';
  if (/update.*(linkedin|profile|headline|account)|change.*(profile|account)|upload.*(post|profile)/.test(value)) return 'external_commitment';
  if (/production migration|migrate production|database migration/.test(value)) return 'production_db_migration';
  if (/deploy|release to production|production release/.test(value)) return 'production_deploy';
  if (/merge.*main|merge.*production|protected branch/.test(value)) return 'merge_main';
  if (/pull request|\bpr\b/.test(value)) return 'pull_request';
  if (/commit/.test(value)) return 'branch_commit';
  if (/email customer|message customer|contact supplier|send.*quote|external commitment/.test(value)) return 'external_commitment';
  if (/build|implement|code|test|develop|refactor/.test(value)) return 'sandbox_build';
  return fallback;
}
