import { query, transaction, audit } from './db.js';
import { decryptSecret, encryptSecret } from './secrets.js';
import { enqueueWorkflowEvent } from './triggers.js';

const GITHUB_API = 'https://api.github.com';
const RUN_FIELDS = 'id,status,conclusion,html_url,head_sha,head_branch,event,created_at,updated_at,name,workflow_id';

function deploymentError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeProject(value) {
  const project = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(project)) throw deploymentError('Choose a valid project code');
  return project;
}

function normalizeRepository(value) {
  const repository = String(value || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw deploymentError('Repository must use owner/name format');
  return repository;
}

function normalizeWorkflow(value) {
  const workflow = String(value || '').trim();
  if (!/^[A-Za-z0-9_.-]+\.ya?ml$/.test(workflow)) throw deploymentError('Workflow must be a repository workflow filename');
  return workflow;
}

function normalizeRef(value) {
  const ref = String(value || 'main').trim();
  if (!/^[A-Za-z0-9._/-]{1,120}$/.test(ref) || ref.includes('..')) throw deploymentError('Workflow ref is invalid');
  return ref;
}

async function githubCredential() {
  const stored = await query("SELECT * FROM provider_credentials WHERE provider='github'");
  if (!stored.rows.length) return null;
  try { return decryptSecret(stored.rows[0].encrypted_key); }
  catch { return null; }
}

async function githubRequest(path, options = {}, token = null) {
  const credential = token || await githubCredential();
  if (!credential) throw deploymentError('GitHub deployment credential is not configured', 424);
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${credential}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'JARVIS-Deployment-Adapter/1.0',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(options.timeout || 30000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) throw deploymentError(body?.message || `GitHub API returned HTTP ${response.status}`, response.status === 401 || response.status === 403 ? 424 : 502);
  return { body, headers: response.headers };
}

export async function saveGitHubCredential(body, actor = 'owner') {
  const token = String(body.token || '').trim();
  if (!token || token.length < 20 || token.length > 500) throw deploymentError('Enter a valid GitHub API token');
  const user = await githubRequest('/user', {}, token);
  const scopes = user.headers.get('x-oauth-scopes') || '';
  const metadata = {
    login: user.body?.login || null,
    scopes: scopes.split(',').map((scope) => scope.trim()).filter(Boolean),
    configured_by: actor,
    configured_at: new Date().toISOString(),
  };
  await query("INSERT INTO provider_credentials (provider,encrypted_key,agent_id,metadata,updated_at) VALUES ('github',$1,NULL,$2,now()) ON CONFLICT (provider) DO UPDATE SET encrypted_key=EXCLUDED.encrypted_key,metadata=EXCLUDED.metadata,updated_at=now()", [encryptSecret(token), JSON.stringify(metadata)]);
  await query('UPDATE project_deployment_adapters SET status=CASE WHEN enabled THEN \'configured\' ELSE \'disabled\' END,updated_at=now() WHERE credential_provider=\'github\'');
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'deployment.github_credential_saved', 'provider_credential', 'github', { login: metadata.login, scopes: metadata.scopes }]);
  return { configured: true, login: metadata.login, scopes: metadata.scopes.length };
}

export async function githubCredentialStatus() {
  const token = await githubCredential();
  if (!token) return { configured: false, ready: false };
  try {
    const user = await githubRequest('/user', {}, token);
    return { configured: true, ready: true, login: user.body?.login || null, scopes: String(user.headers.get('x-oauth-scopes') || '').split(',').map((scope) => scope.trim()).filter(Boolean).length };
  } catch (error) {
    return { configured: true, ready: false, error: error.message };
  }
}

function adapterValues(body, actor) {
  const projectCode = normalizeProject(body.project_code);
  const name = String(body.name || `${projectCode} deployment`).trim().slice(0, 180);
  if (!name) throw deploymentError('Adapter name is required');
  const environment = String(body.environment || 'production').trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(environment)) throw deploymentError('Environment is invalid');
  const adapterType = String(body.adapter_type || 'github-actions');
  if (adapterType !== 'github-actions') throw deploymentError('Only the github-actions adapter is currently supported');
  const requiredInputKeys = Array.isArray(body.required_input_keys)
    ? [...new Set(body.required_input_keys.map(String).filter((key) => /^[A-Za-z0-9_.-]{1,100}$/.test(key)))].slice(0, 20)
    : [];
  const healthUrl = body.health_url ? String(body.health_url).trim() : null;
  if (healthUrl && !/^https:\/\//.test(healthUrl)) throw deploymentError('Health URL must use HTTPS');
  return {
    projectCode,
    name,
    environment,
    adapterType,
    repository: normalizeRepository(body.repository),
    workflowFile: normalizeWorkflow(body.workflow_file),
    workflowRef: normalizeRef(body.workflow_ref),
    requiredInputKeys,
    healthUrl,
    buildWorkspace: body.build_workspace ? String(body.build_workspace).trim() : null,
    productionReleaseRoot: body.production_release_root ? String(body.production_release_root).trim() : null,
    processName: body.process_name ? String(body.process_name).trim().slice(0, 120) : null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    actor,
  };
}

export async function createDeploymentAdapter(body, actor = 'jarvis') {
  const values = adapterValues(body, actor);
  const credential = await githubCredentialStatus();
  const status = credential.ready ? 'configured' : 'credential_required';
  const result = await query(`INSERT INTO project_deployment_adapters
    (project_code,name,environment,adapter_type,repository,workflow_file,workflow_ref,required_input_keys,
     health_url,build_workspace,production_release_root,process_name,approval_policy,status,metadata,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'owner',$13,$14,$15)
    ON CONFLICT (project_code,environment,adapter_type) DO UPDATE SET
      name=EXCLUDED.name,repository=EXCLUDED.repository,workflow_file=EXCLUDED.workflow_file,
      workflow_ref=EXCLUDED.workflow_ref,required_input_keys=EXCLUDED.required_input_keys,
      health_url=EXCLUDED.health_url,build_workspace=EXCLUDED.build_workspace,
      production_release_root=EXCLUDED.production_release_root,process_name=EXCLUDED.process_name,
      status=EXCLUDED.status,metadata=project_deployment_adapters.metadata || EXCLUDED.metadata,updated_at=now()
    RETURNING *`,
    [values.projectCode, values.name, values.environment, values.adapterType, values.repository, values.workflowFile, values.workflowRef, JSON.stringify(values.requiredInputKeys), values.healthUrl, values.buildWorkspace, values.productionReleaseRoot, values.processName, status, JSON.stringify(values.metadata), actor]);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'deployment.adapter_configured', 'project_deployment_adapter', result.rows[0].id, { projectCode: values.projectCode, repository: values.repository, workflow: values.workflowFile, status }]);
  return result.rows[0];
}

export async function updateDeploymentAdapter(id, body, actor = 'owner') {
  const current = await query('SELECT * FROM project_deployment_adapters WHERE id=$1', [id]);
  if (!current.rows.length) throw deploymentError('Deployment adapter not found', 404);
  const row = current.rows[0];
  const enabled = body.enabled === undefined ? row.enabled : body.enabled === true;
  const status = enabled ? (row.status === 'credential_required' ? row.status : 'configured') : 'disabled';
  const result = await query('UPDATE project_deployment_adapters SET enabled=$2,status=$3,updated_at=now() WHERE id=$1 RETURNING *', [id, enabled, status]);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'deployment.adapter_updated', 'project_deployment_adapter', id, { enabled, status }]);
  return result.rows[0];
}

export async function listDeploymentAdapters(projectCode = null) {
  const credential = await githubCredentialStatus();
  const result = projectCode
    ? await query('SELECT * FROM project_deployment_adapters WHERE project_code=$1 ORDER BY environment', [normalizeProject(projectCode)])
    : await query('SELECT * FROM project_deployment_adapters ORDER BY project_code,environment');
  return { githubCredential: credential, adapters: result.rows };
}

export async function createDeploymentRequest(body, actor = 'owner') {
  const projectCode = normalizeProject(body.project_code);
  const environment = String(body.environment || 'production').trim().toLowerCase();
  const adapter = await query('SELECT * FROM project_deployment_adapters WHERE project_code=$1 AND environment=$2 AND enabled=true', [projectCode, environment]);
  if (!adapter.rows.length) throw deploymentError('Enabled deployment adapter not found', 404);
  const target = adapter.rows[0];
  const inputs = body.workflow_inputs && typeof body.workflow_inputs === 'object' ? body.workflow_inputs : {};
  const required = Array.isArray(target.required_input_keys) ? target.required_input_keys : [];
  const missing = required.filter((key) => typeof inputs[key] !== 'string' || !inputs[key].trim());
  if (missing.length) throw deploymentError(`Missing required workflow inputs: ${missing.join(', ')}`);
  const safeInputs = Object.fromEntries(Object.entries(inputs).slice(0, 30).map(([key, value]) => [String(key), String(value).slice(0, 1000)]));
  const result = await query("INSERT INTO deployment_runs (adapter_id,project_code,environment,requested_by,status,workflow_inputs) VALUES ($1,$2,$3,$4,'awaiting_approval',$5) RETURNING *", [target.id, projectCode, environment, actor, JSON.stringify(safeInputs)]);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'deployment.requested', 'deployment_run', result.rows[0].id, { projectCode, environment, requiredInputs: required }]);
  await enqueueWorkflowEvent({ eventType: 'deployment.requested', projectCode, entityType: 'deployment', entityId: result.rows[0].id, dedupeKey: `deployment:${result.rows[0].id}:requested`, producer: actor, payload: { title: `${projectCode} ${environment} deployment awaiting approval`, status: 'awaiting_approval', repository: target.repository, workflow: target.workflow_file } });
  return result.rows[0];
}

async function latestWorkflowRun(target, dispatchedAfter) {
  const path = `/repos/${target.repository}/actions/workflows/${encodeURIComponent(target.workflow_file)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(target.workflow_ref)}&per_page=20`;
  const result = await githubRequest(path);
  const runs = Array.isArray(result.body?.workflow_runs) ? result.body.workflow_runs : [];
  return runs.filter((run) => new Date(run.created_at).getTime() >= dispatchedAfter - 5000)
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())[0] || null;
}

export async function approveAndDispatchDeployment(id, actor = 'owner') {
  const claimed = await transaction(async (client) => {
    const current = await client.query("SELECT r.*,a.repository,a.workflow_file,a.workflow_ref,a.status AS adapter_status FROM deployment_runs r JOIN project_deployment_adapters a ON a.id=r.adapter_id WHERE r.id=$1 FOR UPDATE", [id]);
    if (!current.rows.length) throw deploymentError('Deployment request not found', 404);
    const row = current.rows[0];
    if (row.status !== 'awaiting_approval') throw deploymentError(`Deployment request is ${row.status}`, 409);
    if (row.adapter_status === 'credential_required' || row.adapter_status === 'disabled') throw deploymentError('Deployment adapter is not ready', 424);
    const updated = await client.query("UPDATE deployment_runs SET status='dispatched',approved_by=$2,approved_at=now(),dispatched_at=now(),updated_at=now() WHERE id=$1 RETURNING *", [id, actor]);
    await audit(client, actor, 'deployment.approved', 'deployment_run', id, { repository: row.repository, workflow: row.workflow_file });
    return { run: updated.rows[0], target: row };
  });
  const dispatchedAfter = Date.now();
  try {
    const dispatched = await githubRequest(`/repos/${claimed.target.repository}/actions/workflows/${encodeURIComponent(claimed.target.workflow_file)}/dispatches?return_run_details=true`, {
      method: 'POST',
      body: JSON.stringify({ ref: claimed.target.workflow_ref, inputs: claimed.run.workflow_inputs }),
    });
    let remote = dispatched.body?.workflow_run_id ? { id: dispatched.body.workflow_run_id, html_url: dispatched.body.html_url || null, status: 'queued' } : null;
    for (let attempt = 0; !remote && attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      remote = await latestWorkflowRun(claimed.target, dispatchedAfter);
    }
    const updated = await query("UPDATE deployment_runs SET status='running',github_run_id=$2,github_run_url=$3,evidence=$4,updated_at=now() WHERE id=$1 RETURNING *", [id, remote?.id || null, remote?.html_url || null, JSON.stringify({ dispatchAccepted: true, remoteRun: remote ? { id: remote.id, status: remote.status, conclusion: remote.conclusion || null, headSha: remote.head_sha || null, branch: remote.head_branch || null } : null })]);
    if (remote?.id) return await syncDeploymentRun(id).catch(() => updated.rows[0]);
    return updated.rows[0];
  } catch (error) {
    await query("UPDATE deployment_runs SET status='failed',error=$2,completed_at=now(),updated_at=now() WHERE id=$1", [id, String(error.message).slice(0, 3000)]);
    throw error;
  }
}

export async function syncDeploymentRun(id) {
  const current = await query('SELECT r.*,a.repository,a.health_url,a.process_name FROM deployment_runs r JOIN project_deployment_adapters a ON a.id=r.adapter_id WHERE r.id=$1', [id]);
  if (!current.rows.length) throw deploymentError('Deployment request not found', 404);
  const run = current.rows[0];
  if (!run.github_run_id || ['succeeded','failed','cancelled'].includes(run.status)) return run;
  const remote = await githubRequest(`/repos/${run.repository}/actions/runs/${run.github_run_id}`);
  const fields = remote.body || {};
  let status = fields.status === 'completed' ? (fields.conclusion === 'success' ? 'succeeded' : 'failed') : fields.status === 'queued' ? 'dispatched' : 'running';
  let health = null;
  if (status === 'succeeded' && run.health_url) {
    try {
      const response = await fetch(run.health_url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      const body = await response.json().catch(() => null);
      health = { ok: response.ok, httpStatus: response.status, body };
      if (!response.ok || (body?.sourceCommit && fields.head_sha && body.sourceCommit !== fields.head_sha)) status = 'failed';
    } catch (error) {
      health = { ok: false, error: error.message };
      status = 'failed';
    }
  }
  const result = await query("UPDATE deployment_runs SET status=$2,conclusion=$3,github_run_url=$4,evidence=$5,completed_at=CASE WHEN $2 IN ('succeeded','failed','cancelled') THEN now() ELSE completed_at END,updated_at=now() WHERE id=$1 RETURNING *", [id, status, fields.conclusion || null, fields.html_url || run.github_run_url, JSON.stringify({ remote: { id: fields.id, status: fields.status, conclusion: fields.conclusion, headSha: fields.head_sha, branch: fields.head_branch, url: fields.html_url }, health })]);
  if (['succeeded','failed','cancelled'].includes(status)) {
    await enqueueWorkflowEvent({ eventType: status === 'succeeded' ? 'deployment.succeeded' : 'deployment.failed', projectCode: run.project_code, entityType: 'deployment', entityId: id, dedupeKey: `deployment:${id}:${status}`, producer: 'deployment-adapter', payload: { title: `Deployment ${status} for ${run.project_code}`, status, error: status === 'failed' ? 'Deployment workflow or health verification failed' : undefined, evidence: { githubRunUrl: fields.html_url || run.github_run_url, headSha: fields.head_sha || null, health } } });
  }
  return result.rows[0];
}

export async function syncPendingDeployments(limit = 10) {
  const result = await query("SELECT id FROM deployment_runs WHERE status IN ('dispatched','running') AND github_run_id IS NOT NULL ORDER BY updated_at LIMIT $1", [limit]);
  const synced = [];
  for (const row of result.rows) {
    try { synced.push(await syncDeploymentRun(row.id)); }
    catch (error) { synced.push({ id: row.id, error: error.message }); }
  }
  return synced;
}

export async function deploymentState(projectCode = null) {
  const adapters = await listDeploymentAdapters(projectCode);
  const runs = projectCode
    ? await query('SELECT * FROM deployment_runs WHERE project_code=$1 ORDER BY requested_at DESC LIMIT 100', [normalizeProject(projectCode)])
    : await query('SELECT * FROM deployment_runs ORDER BY requested_at DESC LIMIT 100');
  return { ...adapters, deployments: runs.rows };
}
