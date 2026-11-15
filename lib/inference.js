import { config } from './config.js';
import { query } from './db.js';

export function assertFreeModel(provider, model, catalog) {
  const selected = catalog.find((entry) => entry.provider === provider && entry.id === model);
  const local = provider === 'ollama';
  if (!selected && !local) throw Object.assign(new Error(`Selected model is not in the verified catalog: ${provider}:${model}`), { statusCode: 402 });
  if (config.zeroCostRequired && selected && selected.free !== true) throw Object.assign(new Error('Zero-cost policy blocked a non-free model'), { statusCode: 402 });
  return { provider, model, freeVerified: local || selected?.free === true };
}

export async function recordInferenceUsage({ operation, conversationId = null, provider, model, requestId = null, usage = {}, freeVerified, metadata = {} }) {
  const cost = Number(usage.cost ?? usage.total_cost ?? 0);
  const verifiedZero = freeVerified === true && (!Number.isFinite(cost) || cost === 0);
  const policyResult = config.zeroCostRequired && !verifiedZero ? 'blocked' : 'allowed';
  const result = await query(
    `INSERT INTO inference_usage
      (operation,conversation_id,provider,model,request_id,input_tokens,output_tokens,cost_usd,cost_status,free_verified,policy_result,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [operation, conversationId, provider, model, requestId, Number(usage.prompt_tokens ?? usage.input_tokens ?? 0), Number(usage.completion_tokens ?? usage.output_tokens ?? 0), Number.isFinite(cost) ? cost : 0, verifiedZero ? 'verified_zero' : Number.isFinite(cost) && cost > 0 ? 'provider_reported' : 'unverified', verifiedZero, policyResult, JSON.stringify({ ...metadata, rawUsage: usage })],
  );
  if (policyResult === 'blocked') throw Object.assign(new Error('Zero-cost policy blocked provider usage that could not be verified free'), { statusCode: 402 });
  return result.rows[0];
}

export async function inferenceState() {
  const [recent, totals] = await Promise.all([
    query('SELECT * FROM inference_usage ORDER BY created_at DESC LIMIT 100'),
    query("SELECT count(*)::int AS requests,coalesce(sum(cost_usd),0)::numeric AS cost_usd,count(*) FILTER (WHERE free_verified=false)::int AS unverified FROM inference_usage WHERE created_at>=now()-interval '24 hours'"),
  ]);
  return { recent: recent.rows, last24Hours: totals.rows[0], zeroCostRequired: config.zeroCostRequired };
}
