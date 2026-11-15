import { HERMES_ALLOWED_TOOLSETS } from './hermes-capabilities.js';

const PROVIDERS = new Set(['openrouter']);
const POLICIES = new Set(['strict','standard','permissive','experimental']);
const APPROVALS = new Set(['read_only','standing_safe','require_owner']);
const PROJECTS = new Set(['STUDIO','HV']);
const TARGETS = new Set(['cloud','mac']);
const PRIVILEGED_TOOLSETS = new Set(['file','browser','computer_use','connections','terminal','code_execution','delegation','cronjob','a2a','agency_agents','agora','chrome_profiles','davinciresolve','muse','callme']);
const STRICT_DENIED_TOOLSETS = new Set(['file','browser','computer_use','connections','terminal','code_execution','delegation','cronjob','a2a','agency_agents','agora','chrome_profiles','davinciresolve','muse','callme']);
const WORKSPACE_TOOLSETS = new Set(['file','terminal','code_execution','computer_use']);

function clean(value, fallback = '') { return String(value ?? fallback).trim(); }
function list(value) { return Array.isArray(value) ? [...new Set(value.map((item) => clean(item)).filter(Boolean))] : []; }

export function validateAgentDefinition(input = {}) {
  const slug = clean(input.slug).toLowerCase();
  const name = clean(input.name);
  const projectCode = clean(input.project_code || 'STUDIO').toUpperCase();
  const executionTarget = clean(input.execution_target || 'cloud').toLowerCase();
  const modelProvider = clean(input.model_provider || 'openrouter');
  const model = clean(input.model || 'openrouter/free');
  const hermesProfile = clean(input.hermes_profile || 'default');
  const policyProfile = clean(input.policy_profile || 'standard').toLowerCase();
  const approvalPolicy = clean(input.approval_policy || 'require_owner').toLowerCase();
  const tools = list(input.tool_allowlist);
  const skills = list(input.skill_allowlist);
  const memoryScope = list(input.memory_scope);
  const errors = [];
  if (!/^[a-z][a-z0-9-]{2,62}$/.test(slug)) errors.push('slug must be 3-63 lowercase letters, numbers or hyphens');
  if (!name || name.length > 120) errors.push('name is required and must be <= 120 characters');
  if (!PROJECTS.has(projectCode)) errors.push('project_code must be STUDIO or HV');
  if (!TARGETS.has(executionTarget)) errors.push('execution_target must be cloud or mac');
  if (memoryScope.some((scope) => !PROJECTS.has(scope) || scope !== projectCode)) errors.push('memory_scope may include only this agent\'s project code');
  if (!PROVIDERS.has(modelProvider)) errors.push('model_provider must be openrouter; only free cloud models are enabled for JARVIS agents');
  if (!model || model.length > 180) errors.push('model is required and must be <= 180 characters');
  if (modelProvider === 'openrouter' && model !== 'openrouter/free' && !model.endsWith(':free')) errors.push('JARVIS agents may use only OpenRouter free models');
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(hermesProfile)) errors.push('hermes_profile is invalid');
  if (!POLICIES.has(policyProfile)) errors.push('policy_profile is unsupported');
  if (!APPROVALS.has(approvalPolicy)) errors.push('approval_policy is unsupported');
  if (tools.length > 20 || skills.length > 40 || memoryScope.length > 20) errors.push('tool, skill or memory scope exceeds the allowed size');
  if (tools.some((tool) => !HERMES_ALLOWED_TOOLSETS.has(tool))) errors.push('tool_allowlist contains an unregistered Hermes toolset');
  if ([...tools, ...skills, ...memoryScope].some((item) => item.length > 120)) errors.push('tool, skill and memory scope entries must be <= 120 characters');
  if (tools.some((tool) => PRIVILEGED_TOOLSETS.has(tool)) && approvalPolicy !== 'require_owner') errors.push('privileged Hermes toolsets require owner approval');
  if (tools.some((tool) => WORKSPACE_TOOLSETS.has(tool)) && !clean(input.workspace)) errors.push('choose the exact authorized workspace for file, terminal, code or desktop toolsets');
  if (policyProfile === 'strict' && tools.some((tool) => STRICT_DENIED_TOOLSETS.has(tool))) errors.push('strict policy disallows filesystem, browser, computer, account, terminal, delegation and plugin toolsets');
  return {
    valid: errors.length === 0,
    errors,
    definition: {
      slug, name, description: clean(input.description).slice(0,2000), agent_type: clean(input.agent_type || 'specialist'),
      project_code: projectCode, model_provider: modelProvider, model, hermes_profile: hermesProfile,
      execution_target: executionTarget,
      policy_profile: policyProfile, approval_policy: approvalPolicy,
      workspace: clean(input.workspace) || null, memory_scope: memoryScope,
      tool_allowlist: tools, skill_allowlist: skills,
      status: 'draft', created_by: clean(input.created_by || 'owner'), version: 1,
      metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {},
    },
  };
}

export function buildAgentAcceptance(agent) {
  return [
    `Agent ${agent.slug} is registered as a draft.`,
    `Hermes profile ${agent.hermes_profile} and route ${agent.model_provider}:${agent.model} resolve.`,
    `Only selected Hermes toolsets and installed skills are passed to the job.`,
    `A smoke run succeeds through Hermes and passes JARVIS delivery verification.`,
    `Owner activates the agent after reviewing run evidence.`,
  ];
}

export async function createAgentDefinition(input, actor = 'owner') {
  const { query } = await import('./db.js');
  const checked = validateAgentDefinition({ ...input, created_by: actor });
  if (!checked.valid) throw Object.assign(new Error(checked.errors.join('; ')), { statusCode: 400, details: checked.errors });
  const d = checked.definition;
  const bridgeId = d.execution_target === 'cloud' ? 'cloud' : 'primary';
  const bridge = await query('SELECT metadata FROM hermes_bridge_status WHERE id=$1 AND gateway_status IN (\'online\',\'degraded\') AND last_seen>now()-interval \'2 minutes\'', [bridgeId]);
  const profiles = Array.isArray(bridge.rows[0]?.metadata?.profiles) ? bridge.rows[0].metadata.profiles : [];
  if (!profiles.includes(d.hermes_profile)) throw Object.assign(new Error(`Hermes profile ${d.hermes_profile} is not present in the live bridge inventory`), { statusCode: 424 });
  if (d.skill_allowlist.length) {
    const capabilityAgent = d.execution_target === 'cloud' ? 'hermes-cloud' : 'hermes';
    const found = await query('SELECT DISTINCT display_name FROM agent_capability_registry WHERE agent_id=$1 AND capability_type=\'skill\' AND status=\'connected\' AND lower(display_name)=ANY($2::text[])', [capabilityAgent, d.skill_allowlist.map((skill) => skill.toLowerCase())]);
    const names = new Set(found.rows.map((row) => row.display_name.toLowerCase()));
    const missing = d.skill_allowlist.filter((skill) => !names.has(skill.toLowerCase()));
    if (missing.length) throw Object.assign(new Error(`Skills are indexed or assigned but not confirmed present in the live Hermes bridge: ${missing.join(', ')}`), { statusCode: 424 });
  }
  const result = await query(`INSERT INTO agent_definitions
    (slug,name,description,agent_type,project_code,model_provider,model,hermes_profile,execution_target,policy_profile,approval_policy,workspace,memory_scope,tool_allowlist,skill_allowlist,status,created_by,version,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
  [d.slug,d.name,d.description,d.agent_type,d.project_code,d.model_provider,d.model,d.hermes_profile,d.execution_target,d.policy_profile,d.approval_policy,d.workspace,JSON.stringify(d.memory_scope),JSON.stringify(d.tool_allowlist),JSON.stringify(d.skill_allowlist),d.status,d.created_by,d.version,JSON.stringify(d.metadata)]);
  const agent = result.rows[0];
  await query('INSERT INTO audit_events(actor,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5)', [actor,'agent.definition_created','agent_definition',agent.id,{ slug:agent.slug,projectCode:agent.project_code,provider:agent.model_provider,model:agent.model,hermesProfile:agent.hermes_profile }]);
  return { ...agent, acceptanceCriteria: buildAgentAcceptance(agent) };
}

export async function listAgentDefinitions(projectCode = null) {
  const { query } = await import('./db.js');
  const result = projectCode
    ? await query('SELECT * FROM agent_definitions WHERE project_code=$1 ORDER BY updated_at DESC',[String(projectCode).toUpperCase()])
    : await query('SELECT * FROM agent_definitions ORDER BY updated_at DESC');
  return result.rows.map((agent) => ({ ...agent, acceptanceCriteria: buildAgentAcceptance(agent) }));
}

export async function listAgentFactoryRuns(limit = 50) {
  const { query } = await import('./db.js');
  const bounded = Math.max(1,Math.min(100,Number(limit)||50));
  return (await query(`SELECT r.*,d.slug,d.name,d.model_provider,d.model,j.status AS hermes_status,j.result AS hermes_result,j.evidence AS hermes_evidence,j.usage AS hermes_usage,j.verification AS hermes_verification
    FROM agent_factory_runs r JOIN agent_definitions d ON d.id=r.agent_definition_id LEFT JOIN hermes_jobs j ON j.id=r.hermes_job_id
    ORDER BY r.created_at DESC LIMIT $1`, [bounded])).rows;
}

export async function createAgentRun(definitionId, input = {}, actor = 'owner') {
  const { query, transaction } = await import('./db.js');
  const objective = clean(input.objective);
  if (!objective || objective.length > 4000) throw Object.assign(new Error('objective is required and must be <= 4000 characters'), { statusCode:400 });
  const criteria = list(input.acceptance_criteria).slice(0,20);
  return transaction(async (client) => {
    const found = await client.query('SELECT * FROM agent_definitions WHERE id=$1 FOR UPDATE',[definitionId]);
    if (!found.rows.length) throw Object.assign(new Error('agent definition not found'), { statusCode:404 });
    const agent = found.rows[0];
    if (!['draft','testing','active'].includes(agent.status)) throw Object.assign(new Error(`agent cannot run while status is ${agent.status}`), { statusCode:409 });
    const run = await client.query("INSERT INTO agent_factory_runs(agent_definition_id,objective,acceptance_criteria,status) VALUES($1,$2,$3,'queued') RETURNING *",[agent.id,objective,JSON.stringify(criteria)]);
    await client.query('INSERT INTO audit_events(actor,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5)',[actor,'agent.run_queued','agent_factory_run',run.rows[0].id,{slug:agent.slug,projectCode:agent.project_code}]);
    return { ...run.rows[0], agent };
  });
}

export async function attachHermesJob(runId, job) {
  const { query } = await import('./db.js');
  const status = job.status === 'awaiting_approval' ? 'awaiting_approval' : 'queued';
  const result = await query('UPDATE agent_factory_runs SET hermes_job_id=$2,status=$3 WHERE id=$1 AND status IN (\'queued\',\'awaiting_approval\') RETURNING *',[runId,job.id,status]);
  if (!result.rows.length) throw Object.assign(new Error('agent factory run cannot attach Hermes job'), { statusCode:409 });
  return result.rows[0];
}

export async function activateAgent(definitionId, actor = 'owner') {
  const { query } = await import('./db.js');
  const result = await query(`UPDATE agent_definitions d SET status='active',updated_at=now()
    WHERE d.id=$1 AND d.status IN ('testing','draft') AND EXISTS (
      SELECT 1 FROM agent_factory_runs r WHERE r.agent_definition_id=d.id AND r.status='succeeded' AND r.evidence->>'independently_verified'='true'
    ) RETURNING *`,[definitionId]);
  if (!result.rows.length) throw Object.assign(new Error('agent activation requires a successful independently verified Hermes run'), { statusCode:409 });
  await query('INSERT INTO audit_events(actor,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5)',[actor,'agent.activated','agent_definition',definitionId,{slug:result.rows[0].slug}]);
  return result.rows[0];
}

export async function createAgentSchedule(agentId, input = {}, actor = 'owner') {
  const { query } = await import('./db.js');
  const title=clean(input.title); const objective=clean(input.objective); const interval=Number(input.interval_minutes||1440);
  if (!title||title.length>180||!objective||objective.length>4000) throw Object.assign(new Error('title and objective are required'),{statusCode:400});
  if (!Number.isInteger(interval)||interval<5||interval>10080) throw Object.assign(new Error('interval_minutes must be between 5 and 10080'),{statusCode:400});
  const approval=clean(input.approval_policy||'require_owner');
  if (!['require_owner','standing_safe'].includes(approval)) throw Object.assign(new Error('unsupported schedule approval policy'),{statusCode:400});
  const result=await query(`INSERT INTO agent_schedules(agent_definition_id,title,objective,interval_minutes,approval_policy,created_by)
    SELECT id,$2,$3,$4,$5,$6 FROM agent_definitions WHERE id=$1 AND status='active' RETURNING *`,[agentId,title,objective,interval,approval,actor]);
  if (!result.rows.length) throw Object.assign(new Error('agent must be active before it can be scheduled'),{statusCode:409});
  return result.rows[0];
}

export async function listAgentSchedules() {
  const { query } = await import('./db.js');
  return (await query('SELECT s.*,d.slug,d.name FROM agent_schedules s JOIN agent_definitions d ON d.id=s.agent_definition_id ORDER BY s.enabled DESC,s.next_run_at')).rows;
}

export async function setAgentScheduleEnabled(scheduleId, enabled, actor = 'owner') {
  const { query } = await import('./db.js');
  const result = await query('UPDATE agent_schedules SET enabled=$2,updated_at=now() WHERE id=$1 RETURNING *', [scheduleId, Boolean(enabled)]);
  if (!result.rows.length) throw Object.assign(new Error('agent schedule not found'), { statusCode: 404 });
  await query('INSERT INTO audit_events(actor,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5)', [actor, enabled ? 'agent.schedule_enabled' : 'agent.schedule_paused', 'agent_schedule', scheduleId, {}]);
  return result.rows[0];
}

export async function createAgentHandoff(input = {}, actor = 'owner') {
  const { query } = await import('./db.js');
  const title=clean(input.title); const payload=input.payload&&typeof input.payload==='object'&&!Array.isArray(input.payload)?input.payload:{};
  if (!title||title.length>180||JSON.stringify(payload).length>20000) throw Object.assign(new Error('handoff title or payload is invalid'),{statusCode:400});
  if (!input.from_agent_id||!input.to_agent_id||input.from_agent_id===input.to_agent_id) throw Object.assign(new Error('handoff requires two different agents'),{statusCode:400});
  const result=await query(`INSERT INTO agent_handoffs(from_agent_id,to_agent_id,from_run_id,title,payload)
    SELECT a.id,b.id,$3,$4,$5::jsonb FROM agent_definitions a,agent_definitions b WHERE a.id=$1 AND b.id=$2 AND a.status='active' AND b.status='active' RETURNING *`,
  [input.from_agent_id,input.to_agent_id,input.from_run_id||null,title,JSON.stringify(payload)]);
  if (!result.rows.length) throw Object.assign(new Error('both agents must be active before handoff'),{statusCode:409});
  await query('INSERT INTO audit_events(actor,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5)',[actor,'agent.handoff_created','agent_handoff',result.rows[0].id,{from:input.from_agent_id,to:input.to_agent_id}]);
  return result.rows[0];
}

export async function acceptAgentHandoff(handoffId, actor = 'owner') {
  const { query } = await import('./db.js');
  const result=await query("UPDATE agent_handoffs SET status='accepted',accepted_at=now() WHERE id=$1 AND status='pending' RETURNING *",[handoffId]);
  if (!result.rows.length) throw Object.assign(new Error('pending handoff not found'),{statusCode:409});
  const handoff=result.rows[0];
  const detail=await query('SELECT slug FROM agent_definitions WHERE id=$1',[handoff.from_agent_id]);
  const objective=`Handoff from ${detail.rows[0]?.slug||'agent'}: ${handoff.title}\nWork package: ${JSON.stringify(handoff.payload)}`.slice(0,4000);
  const run=await createAgentRun(handoff.to_agent_id,{objective,acceptance_criteria:['Complete the handed-off work and report evidence']},actor);
  await query('UPDATE agent_handoffs SET accepted_by_run_id=$2 WHERE id=$1',[handoffId,run.id]);
  return {handoff:{...handoff,accepted_by_run_id:run.id},run};
}

export async function listAgentHandoffs(agentId = null) {
  const { query } = await import('./db.js');
  const sql=`SELECT h.*,a.slug AS from_slug,b.slug AS to_slug FROM agent_handoffs h JOIN agent_definitions a ON a.id=h.from_agent_id JOIN agent_definitions b ON b.id=h.to_agent_id`;
  return (agentId ? await query(`${sql} WHERE h.to_agent_id=$1 ORDER BY h.created_at DESC LIMIT 200`,[agentId]) : await query(`${sql} ORDER BY h.created_at DESC LIMIT 200`)).rows;
}

export async function reconcileAgentFactoryRun(hermesJob) {
  const { query, transaction } = await import('./db.js');
  return transaction(async (client) => {
    const current=await client.query('SELECT r.*,d.id AS definition_id,d.status AS definition_status FROM agent_factory_runs r JOIN agent_definitions d ON d.id=r.agent_definition_id WHERE r.hermes_job_id=$1 FOR UPDATE OF r,d',[hermesJob.id]);
    if (!current.rows.length) return null;
    const row=current.rows[0];
    const status=hermesJob.status==='succeeded'?'succeeded':hermesJob.status==='cancelled'?'cancelled':'failed';
    const evidence={hermes_job_id:hermesJob.id,hermes_status:hermesJob.status,verification:hermesJob.verification||null,usage:hermesJob.usage||{},independently_verified:status==='succeeded'&&hermesJob.verification?.verified===true};
    const result=await client.query('UPDATE agent_factory_runs SET status=$2,evidence=$3,error=$4,completed_at=now() WHERE id=$1 RETURNING *',[row.id,status,JSON.stringify(evidence),status==='failed'?(hermesJob.error||'Hermes delivery verification failed'):null]);
    if (status==='succeeded'&&row.definition_status==='draft') await client.query("UPDATE agent_definitions SET status='testing',updated_at=now() WHERE id=$1",[row.definition_id]);
    await client.query("UPDATE agent_schedules SET last_status=$2,last_error=$3,updated_at=now() WHERE last_run_id=$1",[row.id,status,status==='failed'?hermesJob.error||'Hermes run failed':null]);
    await client.query("UPDATE agent_handoffs SET status=$2,completed_at=now() WHERE accepted_by_run_id=$1 AND $2 IN ('succeeded','failed','cancelled')",[row.id,status]);
    return result.rows[0];
  });
}
