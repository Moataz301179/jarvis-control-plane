import crypto from 'node:crypto';
import { query } from './db.js';
import { config } from './config.js';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export async function agentRingConfigured() {
  const bridgeUrl = config.agentRingUrl;
  return {
    configured: Boolean(bridgeUrl),
    bridge_url: bridgeUrl ? bridgeUrl.replace(/\/\/[^/]+@/, '//[redacted]@') : null,
    call_url: bridgeUrl ? `${bridgeUrl.replace(/\/+$/, '')}/call` : null,
  };
}

export async function placeAgentRingCall({ job_id = null, to_phone = null, message, resume_url = null, callback_url = null, meta = {} }) {
  const cfg = await agentRingConfigured();
  if (!cfg.configured) {
    return { placed: false, reason: 'agent_ring_not_configured', hint: 'Set AGENT_RING_URL in config to enable phone escalation.', job_id };
  }
  const payload = {
    to: to_phone ? clean(to_phone, 32) : undefined,
    message: clean(message, 4000),
    job_id: job_id ? String(job_id) : null,
    resume_url: resume_url ? clean(resume_url, 500) : null,
    callback_url: callback_url ? clean(callback_url, 500) : null,
    meta,
    nonce: crypto.randomBytes(6).toString('hex'),
    sent_at: new Date().toISOString(),
  };
  let external = null;
  try {
    const response = await fetch(cfg.call_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    let body = null;
    try { body = await response.json(); } catch {}
    external = { status: response.status, body };
  } catch (error) {
    external = { error: error.message };
  }
  const rows = await query(
    `INSERT INTO agent_ring_calls (job_id,message,to_phone,request_payload,response,placed_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,job_id,message,to_phone,response,placed_at`,
    [job_id ? String(job_id) : null, payload.message, to_phone ? clean(to_phone, 32) : null, JSON.stringify(payload), JSON.stringify(external), new Date()],
  );
  const row = rows.rows[0];
  return {
    placed: Boolean(external && external.status >= 200 && external.status < 300),
    call_id: row.id,
    job_id: row.job_id,
    message_sent: row.message,
    to_phone: to_phone ? '[stored]' : null,
    bridge_response_status: external?.status || null,
    external,
    placed_at: row.placed_at,
  };
}

export async function agentRingCalls(limit = 20) {
  const rows = await query(
    `SELECT id,job_id,message,to_phone,request_payload,response,transcript,instruction,placed_at,answered_at
     FROM agent_ring_calls ORDER BY id DESC LIMIT $1`,
    [Math.min(Number(limit) || 20, 100)],
  );
  return rows.rows;
}
