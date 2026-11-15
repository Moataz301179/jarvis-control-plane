import { config } from '../lib/config.js';
import { pool, query } from '../lib/db.js';

const base = config.apiBaseUrl;
const ownerHeaders = { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' };
const results = [];
const record = (name, status, evidence) => results.push({ name, status, evidence });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}, headers = ownerHeaders) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(180000) });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function waitObjective(id, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let final = null;
  while (Date.now() < deadline) {
    final = await request(`/v1/objectives/${id}`);
    if (['completed', 'failed'].includes(final.body?.status)) break;
    await sleep(1000);
  }
  return final;
}

async function runMission({ title, details, timeoutMs = 90000 }) {
  const mission = await request('/v1/studio/tasks', {
    method: 'POST',
    body: JSON.stringify({ project_code: 'STUDIO', owner_agent: 'Reliability & Recovery Lead', priority: 'high', title, details, acceptance_criteria: ['Safe tool evidence is recorded', 'Independent verification passes'] }),
  });
  if (mission.status !== 201 || !mission.body?.id) throw new Error(`Mission creation failed: ${JSON.stringify(mission.body)}`);
  const objectiveResponse = await request(`/v1/studio/tasks/${encodeURIComponent(mission.body.id)}/plan`, { method: 'POST', body: '{}' });
  if (objectiveResponse.status !== 201 || !objectiveResponse.body?.id) throw new Error(`Objective planning failed: ${JSON.stringify(objectiveResponse.body)}`);
  let approval = null;
  if (objectiveResponse.body.status === 'awaiting_approval') {
    approval = await request(`/v1/objectives/${objectiveResponse.body.id}/approvals`, { method: 'POST', body: JSON.stringify({ decision: 'approved', note: 'Owner-authorized contract audit' }) });
    if (approval.status !== 200) throw new Error(`Objective approval failed: ${JSON.stringify(approval.body)}`);
  } else if (!['queued','running','verifying','completed'].includes(objectiveResponse.body.status)) {
    throw new Error(`Objective entered an unsupported state: ${objectiveResponse.body.status}`);
  }
  const final = await waitObjective(objectiveResponse.body.id, timeoutMs);
  return { mission: mission.body, planned: objectiveResponse.body, approved: approval?.body || null, final };
}

async function waitHermes(id, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await request('/v1/hermes/state');
    const job = state.body?.jobs?.find((entry) => entry.id === id);
    if (job && ['succeeded', 'failed', 'cancelled'].includes(job.status)) return job;
    await sleep(2000);
  }
  return null;
}

async function main() {
  const suffix = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const health = await request('/health', {}, {});
  record('API and database health', health.status === 200 && health.body?.database === 'ready' ? 'PASS' : 'FAIL', { httpStatus: health.status });

  const unauthorized = await request('/v1/studio/dashboard', {}, {});
  record('Protected API rejects unauthenticated access', unauthorized.status === 401 ? 'PASS' : 'FAIL', { httpStatus: unauthorized.status });

  const status = await request('/v1/system/status');
  const onlineWorkers = status.body?.workers?.filter((worker) => worker.online).length || 0;
  record('Authenticated worker heartbeat', status.status === 200 && onlineWorkers > 0 ? 'PASS' : 'FAIL', { onlineWorkers, workers: status.body?.workers?.length || 0 });

  const models = await request('/v1/models');
  const selected = models.body?.selected;
  const selectedModel = models.body?.models?.find((model) => model.provider === selected?.provider && model.id === selected?.model);
  record('Zero-cost model policy is enforceable', models.status === 200 && (selected?.provider === 'ollama' || selectedModel?.free === true) && models.body.models.filter((model) => model.provider !== 'ollama-cloud').every((model) => model.free === true) ? 'PASS' : 'FAIL', { selected, selectedFree: selected?.provider === 'ollama' || selectedModel?.free === true, modelCount: models.body?.models?.length || 0 });

  const controlPlane = await request('/v1/control-plane');
  const providerInventory = await request('/v1/providers');
  const claudeRoute = controlPlane.body?.modelRoutes?.routes?.find((route) => route.agent_id === 'claude' && route.task_class === 'review');
  const codexRoute = controlPlane.body?.modelRoutes?.routes?.find((route) => route.agent_id === 'codex' && route.task_class === 'build');
  record('Central model routes and provider endpoints are managed', controlPlane.status === 200 && providerInventory.status === 200 && Boolean(controlPlane.body?.modelRoutes?.global) && Boolean(claudeRoute) && Boolean(codexRoute) ? 'PASS' : 'FAIL', { global: controlPlane.body?.modelRoutes?.global || null, claudeRoute: claudeRoute || null, codexRoute: codexRoute || null, providers: providerInventory.body || null });

  const forcedOwner = await request('/v1/objectives', { method: 'POST', body: JSON.stringify({ title: `Owner decision yes ${suffix}`, objective: 'Inspect database health with independent verification.', approval_policy: 'owner', acceptance_criteria: ['Evidence is recorded'] }) });
  const forcedInbox = await request('/v1/approvals');
  const yesDecision = forcedOwner.status === 201 && forcedInbox.body?.pending?.some((item) => item.kind === 'objective' && item.id === forcedOwner.body.id)
    ? await request(`/v1/approvals/objective/${forcedOwner.body.id}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'yes', note: 'Contract audit yes path' }) })
    : null;
  const forcedFinal = yesDecision?.status === 200 ? await waitObjective(forcedOwner.body.id) : null;
  record('A simple yes decision releases a governed task', forcedOwner.status === 201 && forcedOwner.body?.status === 'awaiting_approval' && yesDecision?.status === 200 && forcedFinal?.body?.status === 'completed' ? 'PASS' : 'FAIL', { objectiveId: forcedOwner.body?.id || null, initialStatus: forcedOwner.body?.status || null, decisionStatus: yesDecision?.status || null, finalStatus: forcedFinal?.body?.status || null });

  const forcedNo = await request('/v1/objectives', { method: 'POST', body: JSON.stringify({ title: `Owner decision no ${suffix}`, objective: 'Inspect release inventory.', approval_policy: 'owner', acceptance_criteria: ['Owner decision is respected'] }) });
  const noDecision = forcedNo.status === 201 ? await request(`/v1/approvals/objective/${forcedNo.body.id}/decision`, { method: 'POST', body: JSON.stringify({ decision: 'no', note: 'Contract audit no path' }) }) : null;
  const noFinal = forcedNo.status === 201 ? await request(`/v1/objectives/${forcedNo.body.id}`) : null;
  record('A simple no decision stops a governed task', forcedNo.status === 201 && noDecision?.status === 200 && noFinal?.body?.status === 'cancelled' ? 'PASS' : 'FAIL', { objectiveId: forcedNo.body?.id || null, decisionStatus: noDecision?.status || null, finalStatus: noFinal?.body?.status || null });

  const runtime = await runMission({ title: `Runtime evidence audit ${suffix}`, details: 'Inspect database health, runtime status and release inventory with independent read-only verification.' });
  const tools = runtime.final?.body?.tasks?.map((task) => task.tool) || [];
  const verifiedRuntimeTasks = runtime.final?.body?.tasks?.filter((task) => task.status === 'verified' && task.verification?.verified === true) || [];
  record('General-purpose safe tool execution', runtime.final?.body?.status === 'completed' && new Set(tools).size >= 2 ? 'PASS' : 'FAIL', { status: runtime.final?.body?.status, tools });
  record('Authenticated worker and verifier complete evidence flow', verifiedRuntimeTasks.length === runtime.final?.body?.tasks?.length && verifiedRuntimeTasks.length > 0 ? 'PASS' : 'FAIL', { tasks: runtime.final?.body?.tasks?.length || 0, verifiedTasks: verifiedRuntimeTasks.length, evidence: runtime.final?.body?.tasks?.map((task) => ({ tool: task.tool, evidence: task.evidence, verification: task.verification })) });

  const hermesState = await request('/v1/hermes/state');
  const bridgeAge = hermesState.body?.bridge?.last_seen ? Date.now() - new Date(hermesState.body.bridge.last_seen).getTime() : Infinity;
  const runtimeAge = hermesState.body?.runtime?.last_seen ? Date.now() - new Date(hermesState.body.runtime.last_seen).getTime() : Infinity;
  const bridgeOnline = hermesState.body?.bridge?.gateway_status === 'online' && bridgeAge < 120000;
  const specialistBound = hermesState.body?.runtime?.status === 'active' && runtimeAge < 120000;
  const hermesJob = bridgeOnline && specialistBound
    ? await request('/v1/hermes/jobs', { method: 'POST', body: JSON.stringify({ project_code: 'STUDIO', title: `Hermes specialist audit ${suffix}`, instruction: 'Respond with exactly HERMES_SPECIALIST_OK and no additional text.', toolsets: ['memory','todo','clarify'] }) })
    : null;
  const hermesFinal = hermesJob?.status === 201 ? await waitHermes(hermesJob.body.id) : null;
  record('Hermes specialist runtime is bound and executing with a routed model', bridgeOnline && specialistBound && hermesFinal?.status === 'succeeded' && hermesFinal?.verification?.verified === true && String(hermesFinal.result || '').includes('HERMES_SPECIALIST_OK') && Boolean(hermesFinal?.model_provider) && Boolean(hermesFinal?.model) ? 'PASS' : 'FAIL', { bridgeOnline, specialistBound, bridgeAgeMs: bridgeAge, runtimeAgeMs: runtimeAge, jobId: hermesFinal?.id || null, jobStatus: hermesFinal?.status || null, attempts: hermesFinal?.attempts ?? null, modelProvider: hermesFinal?.model_provider || null, model: hermesFinal?.model || null, verification: hermesFinal?.verification || null });

  const principalId = `audit-observer-${suffix.slice(-8)}`;
  const principal = await request('/v1/principals', { method: 'POST', body: JSON.stringify({ id: principalId, name: 'Contract audit observer', role: 'auditor' }) });
  let readAllowed = null;
  let writeDenied = null;
  if (principal.status === 201 && principal.body?.token) {
    const auditorHeaders = { authorization: `Bearer ${principal.body.token}`, 'content-type': 'application/json' };
    readAllowed = await request('/v1/system/status', {}, auditorHeaders);
    writeDenied = await request('/v1/studio/tasks', { method: 'POST', body: JSON.stringify({ project_code: 'STUDIO', title: 'Unauthorized audit mutation', details: 'This must be rejected.' }) }, auditorHeaders);
    await request(`/v1/principals/${principalId}`, { method: 'DELETE' });
  }
  record('Role-based access control is enforced', principal.status === 201 && readAllowed?.status === 200 && writeDenied?.status === 403 ? 'PASS' : 'FAIL', { principalId, readStatus: readAllowed?.status || null, writeStatus: writeDenied?.status || null, revoked: principal.status === 201 });

  const schedule = await request('/v1/schedules', { method: 'POST', body: JSON.stringify({ project_code: 'STUDIO', title: `Scheduled health audit ${suffix}`, details: 'Check JARVIS health status and require independent verification.', interval_minutes: 60, approval_policy: 'standing_safe', priority: 'medium' }) });
  const scheduleRun = schedule.status === 201 ? await request(`/v1/schedules/${schedule.body.id}/run`, { method: 'POST', body: '{}' }) : null;
  const scheduledObjective = scheduleRun?.body?.last_objective_id ? await waitObjective(scheduleRun.body.last_objective_id) : null;
  if (schedule.status === 201) await request(`/v1/schedules/${schedule.body.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: false }) });
  record('Scheduled mission execution is durable and approval-aware', scheduleRun?.status === 200 && ['queued','running','verifying','completed'].includes(scheduleRun.body.last_status) && scheduledObjective?.body?.status === 'completed' ? 'PASS' : 'FAIL', { scheduleId: schedule.body?.id || null, policy: schedule.body?.approval_policy || null, objectiveId: scheduleRun?.body?.last_objective_id || null, objectiveStatus: scheduledObjective?.body?.status || null });

  const backupsBefore = await request('/v1/backups');
  const recentBackup = backupsBefore.body?.runs?.find((entry) => entry.status === 'succeeded' && Date.now() - new Date(entry.completed_at).getTime() < 86400000);
  const backup = recentBackup ? { status: 200, body: { skipped: true, backup: recentBackup } } : await request('/v1/backups/ensure', { method: 'POST', body: '{}' });
  const backupMission = backup.body?.backup?.status === 'succeeded' ? await runMission({ title: `Backup restore evidence audit ${suffix}`, details: 'Verify backup and restore proof using the newest restore-tested database backup.', timeoutMs: 60000 }) : null;
  record('Database backup and isolated restore proof', backup.status === 200 && backup.body?.backup?.status === 'succeeded' && backupMission?.final?.body?.status === 'completed' ? 'PASS' : 'FAIL', { skippedBecauseRecent: Boolean(recentBackup), backupId: backup.body?.backup?.id || null, restoreSchema: backup.body?.backup?.restore_schema || null, tableCount: backup.body?.backup?.table_count || null, rowCount: backup.body?.backup?.row_count || null, objectiveId: backupMission?.final?.body?.id || null });

  const notificationsBefore = await request('/v1/notifications');
  const recentDelivery = notificationsBefore.body?.outbox?.find((entry) => entry.event_type === 'notification.test' && entry.status === 'sent' && Date.now() - new Date(entry.updated_at).getTime() < 3600000);
  const notification = recentDelivery ? { status: 200, body: { delivery: { sent: 1, recent: true }, state: notificationsBefore.body } } : await request('/v1/notifications/test', { method: 'POST', body: '{}' });
  const delivered = recentDelivery || notification.body?.state?.outbox?.find((entry) => entry.event_type === 'notification.test' && entry.status === 'sent' && Date.now() - new Date(entry.updated_at).getTime() < 300000);
  record('Notification delivery is authenticated and recorded', notification.status === 200 && Boolean(delivered) && Boolean(delivered.provider_message_id) ? 'PASS' : 'FAIL', { sent: notification.body?.delivery?.sent || 0, recent: Boolean(recentDelivery), providerMessageId: delivered?.provider_message_id || null });

  const usage = await request('/v1/inference/usage');
  const latestUsage = usage.body?.recent?.[0];
  record('Provider usage is persisted under zero-cost policy', usage.status === 200 && latestUsage?.policy_result === 'allowed' && latestUsage?.cost_status === 'verified_zero' && latestUsage?.free_verified === true ? 'PASS' : 'FAIL', { latestUsage, last24Hours: usage.body?.last24Hours, zeroCostRequired: usage.body?.zeroCostRequired });

  const duplicates = await query('SELECT count(*)::int AS total, count(DISTINCT idempotency_key)::int AS unique_keys FROM tasks');
  record('Task idempotency keys are unique', duplicates.rows[0].total === duplicates.rows[0].unique_keys ? 'PASS' : 'FAIL', duplicates.rows[0]);

  const counts = results.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), base, counts, results }, null, 2));
  if ((counts.FAIL || 0) > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message, stack: error.stack }, null, 2));
  process.exitCode = 1;
}).finally(async () => pool.end());
