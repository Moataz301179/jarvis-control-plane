import { query } from './db.js';
import { resolveAutonomyRule, classifyAction } from './routing-policy.js';
export { resolveAutonomyRule, classifyAction };

export async function autonomyRules() {
  const result = await query('SELECT * FROM autonomy_rules ORDER BY action_key,project_code');
  return { rules: result.rows };
}

export async function decideAutonomy(request) {
  const result = await query('SELECT * FROM autonomy_rules WHERE enabled=true');
  return resolveAutonomyRule(result.rows, request);
}

export async function updateAutonomyRule(body, actor = 'owner') {
  const actionKey = String(body.action_key || '').trim();
  const projectCode = String(body.project_code || '*').trim().toUpperCase();
  const decision = String(body.decision || '').trim();
  const riskLevel = String(body.risk_level || 'safe').trim();
  const description = String(body.description || '').trim();
  if (!/^[a-z0-9_]{2,80}$/.test(actionKey)) throw Object.assign(new Error('Invalid action key'), { statusCode: 400 });
  if (!/^([A-Z0-9_-]+|\*)$/.test(projectCode)) throw Object.assign(new Error('Invalid project code'), { statusCode: 400 });
  if (!['autonomous','owner_approval'].includes(decision)) throw Object.assign(new Error('Decision must be autonomous or owner_approval'), { statusCode: 400 });
  if (!['safe','review','danger'].includes(riskLevel)) throw Object.assign(new Error('Invalid risk level'), { statusCode: 400 });
  if (!description || description.length > 1000) throw Object.assign(new Error('A description is required'), { statusCode: 400 });
  const enabled = body.enabled !== false;
  const result = await query(`INSERT INTO autonomy_rules (action_key,project_code,decision,risk_level,description,enabled,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,now())
    ON CONFLICT (action_key,project_code) DO UPDATE SET decision=EXCLUDED.decision,risk_level=EXCLUDED.risk_level,
      description=EXCLUDED.description,enabled=EXCLUDED.enabled,updated_at=now()
    RETURNING *`, [actionKey, projectCode, decision, riskLevel, description, enabled]);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'autonomy.rule_updated', 'autonomy_rule', result.rows[0].id, { actionKey, projectCode, decision, riskLevel, enabled }]);
  return result.rows[0];
}
