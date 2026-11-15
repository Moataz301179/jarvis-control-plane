import { query } from './db.js';
import { resolveAgentModelRoute } from './routing-policy.js';

export const MODEL_ROUTE_PROVIDERS = new Set(['inherit','ollama','openrouter','ollama-cloud','anthropic']);

function normalized(value) {
  return String(value || '').trim();
}

export async function getGlobalModelSettings() {
  const result = await query('SELECT provider,model,updated_at FROM model_settings WHERE id=1');
  return result.rows[0];
}

export async function listAgentModelRoutes() {
  const [routes, global] = await Promise.all([
    query('SELECT * FROM agent_model_routes ORDER BY agent_id,project_code,task_class'),
    getGlobalModelSettings(),
  ]);
  return { global, routes: routes.rows };
}

export async function resolveCentralModelRoute(request) {
  const [routes, global] = await Promise.all([
    query('SELECT * FROM agent_model_routes WHERE enabled=true'),
    getGlobalModelSettings(),
  ]);
  return resolveAgentModelRoute(routes.rows, global, request);
}

export async function upsertAgentModelRoute(body, actor = 'owner') {
  const agentId = normalized(body.agent_id || '*');
  const projectCode = normalized(body.project_code || '*').toUpperCase();
  const taskClass = normalized(body.task_class || 'general');
  const provider = normalized(body.provider || 'inherit');
  const model = normalized(body.model);
  if (!/^([A-Za-z0-9_-]+|\*)$/.test(agentId)) throw Object.assign(new Error('Invalid agent id'), { statusCode: 400 });
  if (!/^([A-Z0-9_-]+|\*)$/.test(projectCode)) throw Object.assign(new Error('Invalid project code'), { statusCode: 400 });
  if (!/^([A-Za-z0-9_-]+|\*)$/.test(taskClass)) throw Object.assign(new Error('Invalid task class'), { statusCode: 400 });
  if (!MODEL_ROUTE_PROVIDERS.has(provider)) throw Object.assign(new Error('Unsupported model provider'), { statusCode: 400 });
  if (provider !== 'inherit' && !model) throw Object.assign(new Error('A model is required for an explicit provider route'), { statusCode: 400 });
  if (provider === 'inherit' && model) throw Object.assign(new Error('Inherited routes must not define a model'), { statusCode: 400 });
  const freeOnly = body.free_only !== false;
  const enabled = body.enabled !== false;
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const result = await query(`INSERT INTO agent_model_routes
    (agent_id,project_code,task_class,provider,model,free_only,enabled,metadata,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
    ON CONFLICT (agent_id,project_code,task_class) DO UPDATE SET
      provider=EXCLUDED.provider,model=EXCLUDED.model,free_only=EXCLUDED.free_only,
      enabled=EXCLUDED.enabled,metadata=agent_model_routes.metadata || EXCLUDED.metadata,updated_at=now()
    RETURNING *`, [agentId, projectCode, taskClass, provider, model, freeOnly, enabled, JSON.stringify(metadata)]);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'model.route_updated', 'agent_model_route', result.rows[0].id, { agentId, projectCode, taskClass, provider, model, freeOnly, enabled }]);
  return result.rows[0];
}
