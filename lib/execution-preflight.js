import crypto from 'node:crypto';

const DEFAULT_MAX_HEARTBEAT_AGE_MS = 90_000;

function clean(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function check(id, ok, message, expected, observed, severity = 'blocker') {
  return { id, status: ok ? 'pass' : severity === 'warning' ? 'warning' : 'fail', message, expected, observed };
}

function capabilityMap(capabilities = []) {
  const map = new Map();
  for (const item of Array.isArray(capabilities) ? capabilities : []) {
    if (typeof item === 'string') {
      map.set(`runtime:${item.toLowerCase()}`, { key: item.toLowerCase(), type: 'runtime', status: 'connected' });
      continue;
    }
    const key = clean(item.capability_key || item.name || item.id, 240).toLowerCase();
    const type = clean(item.capability_type || item.type || 'runtime', 60).toLowerCase();
    if (!key) continue;
    map.set(`${type}:${key}`, { key, type, status: clean(item.status || 'connected', 40).toLowerCase() });
  }
  return map;
}

function capabilityPresent(capabilities, type, key) {
  return capabilities.get(`${type}:${key}`) || capabilities.get(`runtime:${key}`);
}

function bridgeOnline(runtime, bridge = {}) {
  if (runtime === 'hermes') return String(bridge.gateway_status || '').toLowerCase() === 'online';
  return String(bridge.status || '').toLowerCase() === 'online';
}

function bridgeLabel(runtime) {
  return runtime === 'hermes' ? 'Hermes bridge and gateway' : runtime === 'mac' ? 'Mac execution bridge' : `${runtime} runtime`;
}

export function evaluateExecutionPreflight({
  runtime,
  projectCode = 'STUDIO',
  bridge = null,
  capabilities = [],
  accountConnections = [],
  requiredToolsets = [],
  requiredMacActions = [],
  requiredCapabilities = [],
  requiredAccountConnections = [],
  now = Date.now(),
  maxHeartbeatAgeMs = DEFAULT_MAX_HEARTBEAT_AGE_MS,
  requestId = null,
} = {}) {
  const normalizedRuntime = clean(runtime, 40).toLowerCase();
  if (!['hermes', 'mac', 'worker'].includes(normalizedRuntime)) throw Object.assign(new Error('Unsupported execution runtime'), { statusCode: 400 });
  const checks = [];
  checks.push(check('project_scope', /^(STUDIO|HV)$/.test(String(projectCode || '').toUpperCase()), 'Project scope is valid', 'STUDIO or HV', String(projectCode || '')));

  if (normalizedRuntime !== 'worker') {
    const online = Boolean(bridge) && bridgeOnline(normalizedRuntime, bridge);
    checks.push(check('bridge_online', online, `${bridgeLabel(normalizedRuntime)} must be online`, 'online', bridge ? (normalizedRuntime === 'hermes' ? bridge.gateway_status : bridge.status) : 'missing'));
    const lastSeen = bridge?.last_seen ? new Date(bridge.last_seen).getTime() : NaN;
    const heartbeatAgeMs = Number.isFinite(lastSeen) ? Math.max(0, now - lastSeen) : null;
    checks.push(check('heartbeat_fresh', heartbeatAgeMs !== null && heartbeatAgeMs <= maxHeartbeatAgeMs, `${bridgeLabel(normalizedRuntime)} heartbeat must be fresh`, `<= ${maxHeartbeatAgeMs} ms`, heartbeatAgeMs === null ? 'missing' : `${heartbeatAgeMs} ms`));
  }

  const capabilityIndex = capabilityMap(capabilities);
  for (const toolset of [...new Set((Array.isArray(requiredToolsets) ? requiredToolsets : []).map((item) => clean(item, 120).toLowerCase()).filter(Boolean))]) {
    const found = capabilityPresent(capabilityIndex, 'toolset', toolset);
    const ready = Boolean(found && ['connected', 'verified'].includes(found.status));
    checks.push(check(`toolset:${toolset}`, ready, `Hermes toolset ${toolset} must be connected`, 'connected', found?.status || 'missing'));
  }

  for (const action of [...new Set((Array.isArray(requiredMacActions) ? requiredMacActions : []).map((item) => clean(item, 120).toLowerCase()).filter(Boolean))]) {
    const found = capabilityPresent(capabilityIndex, 'runtime', action);
    const ready = Boolean(found && ['connected', 'verified'].includes(found.status));
    checks.push(check(`mac_action:${action}`, ready, `Mac action ${action} must be advertised by the bridge`, 'connected', found?.status || 'missing'));
  }

  for (const requirement of Array.isArray(requiredCapabilities) ? requiredCapabilities : []) {
    const type = clean(typeof requirement === 'string' ? 'runtime' : requirement.type || 'runtime', 60).toLowerCase();
    const key = clean(typeof requirement === 'string' ? requirement : requirement.key || requirement.name, 240).toLowerCase();
    if (!key) continue;
    const found = capabilityPresent(capabilityIndex, type, key);
    const ready = Boolean(found && ['connected', 'verified'].includes(found.status));
    checks.push(check(`capability:${type}:${key}`, ready, `Required capability ${type}:${key} must be connected`, 'connected', found?.status || 'missing'));
  }

  for (const requirement of Array.isArray(requiredAccountConnections) ? requiredAccountConnections : []) {
    const service = clean(typeof requirement === 'string' ? requirement : requirement.service, 120).toLowerCase();
    const alias = clean(typeof requirement === 'string' ? '' : requirement.account_alias || requirement.alias, 120).toLowerCase();
    const account = accountConnections.find((item) => clean(item.service, 120).toLowerCase() === service && (!alias || clean(item.account_alias, 120).toLowerCase() === alias));
    const expiresAt = account?.expires_at ? new Date(account.expires_at).getTime() : NaN;
    const ready = Boolean(account && account.status === 'verified' && Number.isFinite(expiresAt) && expiresAt > now);
    checks.push(check(`account:${service}${alias ? `:${alias}` : ''}`, ready, `Account connection ${service}${alias ? `/${alias}` : ''} must be verified and unexpired`, 'verified', account ? `${account.status}${Number.isFinite(expiresAt) ? ` until ${new Date(expiresAt).toISOString()}` : ''}` : 'missing'));
  }

  const blockers = checks.filter((item) => item.status === 'fail');
  const warnings = checks.filter((item) => item.status === 'warning');
  const stable = { runtime: normalizedRuntime, projectCode: String(projectCode || '').toUpperCase(), checks };
  const receiptId = crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
  return {
    schema_version: 1,
    request_id: requestId ? clean(requestId, 120) : null,
    runtime: normalizedRuntime,
    project_code: stable.projectCode,
    ready: blockers.length === 0,
    checked_at: new Date(now).toISOString(),
    blockers,
    warnings,
    checks,
    receipt_id: receiptId,
  };
}
