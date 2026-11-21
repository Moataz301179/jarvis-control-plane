import crypto from 'node:crypto';
import { query } from './db.js';
import { config } from './config.js';
import { decryptSecret } from './secrets.js';

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizePhone(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(raw)) {
    throw Object.assign(new Error('Phone number must be in international format, e.g. +201234567890'), { statusCode: 400 });
  }
  return raw;
}

export function twimlEscape(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]));
}

async function twilioCredentials() {
  const row = (await query("SELECT encrypted_key,metadata FROM provider_credentials WHERE provider='twilio'")).rows[0];
  if (!row) return null;
  try {
    return {
      sid: String(row.metadata?.account_sid || ''),
      token: decryptSecret(row.encrypted_key),
      from: String(row.metadata?.from_number || ''),
      defaultTo: String(row.metadata?.default_to || ''),
    };
  } catch {
    return null;
  }
}

function basicAuth(sid, token) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

export async function agentRingConfigured() {
  const bridgeUrl = config.agentRingUrl;
  if (bridgeUrl) {
    return {
      configured: true,
      mode: 'bridge',
      bridge_url: bridgeUrl.replace(/\/\/[^/]+@/, '//[redacted]@'),
      call_url: `${bridgeUrl.replace(/\/+$/, '')}/call`,
    };
  }
  const twilio = await twilioCredentials().catch(() => null);
  return {
    configured: Boolean(twilio?.sid && twilio?.token && twilio?.from),
    mode: 'twilio',
    from_number: twilio?.from || null,
    default_to: twilio?.defaultTo || null,
    call_url: null,
  };
}

export async function twilioStatus() {
  const credentials = await twilioCredentials();
  if (!credentials?.sid || !credentials?.token) {
    return { configured: false, ready: false, mode: 'twilio', from_number: null, default_to: null };
  }
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(credentials.sid)}.json`, {
      headers: { authorization: basicAuth(credentials.sid, credentials.token) },
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.json().catch(() => ({}));
    return {
      configured: true,
      ready: response.ok,
      mode: 'twilio',
      account: body.friendly_name || null,
      account_status: body.status || null,
      from_number: credentials.from || null,
      default_to: credentials.defaultTo || null,
      error: response.ok ? null : (body.message || `HTTP ${response.status}`),
    };
  } catch (error) {
    return { configured: true, ready: false, mode: 'twilio', from_number: credentials.from || null, default_to: credentials.defaultTo || null, error: error.message };
  }
}

async function placeTwilioCall({ toPhone, message }) {
  const credentials = await twilioCredentials();
  if (!credentials?.sid || !credentials?.token || !credentials?.from) {
    return { external: null, reason: 'agent_ring_not_configured', hint: 'Add Twilio credentials in Settings → Phone calls.' };
  }
  const to = normalizePhone(toPhone || credentials.defaultTo);
  const twiml = `<Response><Say voice="alice" language="en-GB">${twimlEscape(message)}</Say><Pause length="1"/><Say voice="alice" language="en-GB">This message was delivered by JARVIS.</Say></Response>`;
  const form = new URLSearchParams({ To: to, From: credentials.from, Twiml: twiml });
  let external = null;
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(credentials.sid)}/Calls.json`, {
      method: 'POST',
      headers: { authorization: basicAuth(credentials.sid, credentials.token), 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.json().catch(() => ({}));
    external = { status: response.status, body: { sid: body.sid || null, status: body.status || null, error: response.ok ? null : (body.message || `HTTP ${response.status}`) } };
  } catch (error) {
    external = { error: error.message };
  }
  return { external, to };
}

export async function placeAgentRingCall({ job_id = null, to_phone = null, message, resume_url = null, callback_url = null, meta = {} }) {
  const payload = {
    to: to_phone ? clean(to_phone, 32) : undefined,
    message: clean(message, 1500),
    job_id: job_id ? String(job_id) : null,
    resume_url: resume_url ? clean(resume_url, 500) : null,
    callback_url: callback_url ? clean(callback_url, 500) : null,
    meta,
    nonce: crypto.randomBytes(6).toString('hex'),
    sent_at: new Date().toISOString(),
  };
  if (!payload.message) throw Object.assign(new Error('A call message is required'), { statusCode: 400 });

  const cfg = await agentRingConfigured();
  let external = null;
  let storedTo = payload.to ? clean(payload.to, 32) : null;

  if (cfg.mode === 'bridge' && cfg.configured) {
    try {
      const response = await fetch(cfg.call_url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      let body = null;
      try { body = await response.json(); } catch { /* non-JSON bridge response */ }
      external = { status: response.status, body };
    } catch (error) {
      external = { error: error.message };
    }
  } else if (cfg.mode === 'twilio') {
    const result = await placeTwilioCall({ toPhone: to_phone || cfg.default_to, message: payload.message });
    if (result.reason) return { placed: false, reason: result.reason, hint: result.hint, job_id };
    external = result.external;
    storedTo = result.to || storedTo;
  } else {
    return { placed: false, reason: 'agent_ring_not_configured', hint: 'Add Twilio credentials in Settings → Phone calls, or set AGENT_RING_URL.', job_id };
  }

  const rows = await query(
    `INSERT INTO agent_ring_calls (job_id,message,to_phone,request_payload,response,placed_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,job_id,message,to_phone,response,placed_at`,
    [job_id ? String(job_id) : null, payload.message, storedTo, JSON.stringify(payload), JSON.stringify(external), new Date()],
  );
  const row = rows.rows[0];
  return {
    placed: Boolean(external && external.status >= 200 && external.status < 300),
    mode: cfg.mode,
    call_id: row.id,
    job_id: row.job_id,
    message_sent: row.message,
    to_phone: storedTo ? '[stored]' : null,
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
