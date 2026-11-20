import { query, transaction, audit } from './db.js';
import { encryptSecret, decryptSecret } from './secrets.js';

export const KEY_POOL_PROVIDERS = new Set(['openrouter', 'ollama-cloud', 'openai', 'anthropic']);

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  if (!KEY_POOL_PROVIDERS.has(provider)) {
    throw Object.assign(new Error('Unsupported provider for the key pool'), { statusCode: 400 });
  }
  return provider;
}

function normalizeLabel(value) {
  const label = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,59}$/.test(label)) {
    throw Object.assign(new Error('Key label must be 1-60 characters (letters, numbers, space, . _ -)'), { statusCode: 400 });
  }
  return label;
}

function normalizeKey(value) {
  const key = String(value || '').trim();
  if (key.length < 20 || key.length > 400 || /\s/.test(key)) {
    throw Object.assign(new Error('API key format is invalid'), { statusCode: 400 });
  }
  return key;
}

export function nextUtcMidnight(now = Date.now()) {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

// Pure selection: keep the current key while the day is the same, otherwise
// advance to the next usable key in creation order (wrapping around).
export function pickKeyForDay(keys, currentId, { advance = false, now = Date.now() } = {}) {
  const usable = (key) => ['active', 'cooldown'].includes(key.status)
    && (!key.cooldown_until || new Date(key.cooldown_until).getTime() <= now);
  const active = keys.filter(usable);
  if (!active.length) return null;
  if (!advance) {
    const current = active.find((key) => key.id === currentId);
    if (current) return current;
  }
  const startIndex = keys.findIndex((key) => key.id === currentId);
  if (startIndex < 0) return active[0];
  for (let step = 1; step <= keys.length; step += 1) {
    const candidate = keys[(startIndex + step) % keys.length];
    if (active.some((key) => key.id === candidate.id)) return candidate;
  }
  return active[0];
}

export async function addProviderKey({ provider, label, key }, actor = 'owner') {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedLabel = normalizeLabel(label);
  const normalizedKey = normalizeKey(key);
  const result = await query(
    `INSERT INTO provider_api_keys (provider,label,encrypted_key,status,cooldown_until,last_error,updated_at)
     VALUES ($1,$2,$3,'active',NULL,NULL,now())
     ON CONFLICT (provider,label) DO UPDATE SET
       encrypted_key=EXCLUDED.encrypted_key,status='active',cooldown_until=NULL,last_error=NULL,updated_at=now()
     RETURNING id,provider,label,status,cooldown_until,last_used_at,created_at,updated_at`,
    [normalizedProvider, normalizedLabel, encryptSecret(normalizedKey)],
  );
  await audit(actor, 'provider_key.upserted', 'provider_api_key', result.rows[0].id, { provider: normalizedProvider, label: normalizedLabel });
  return result.rows[0];
}

export async function listProviderKeys(provider = null) {
  const rows = provider
    ? await query('SELECT id,provider,label,status,cooldown_until,last_used_at,last_error,created_at,updated_at FROM provider_api_keys WHERE provider=$1 ORDER BY created_at,id', [provider])
    : await query('SELECT id,provider,label,status,cooldown_until,last_used_at,last_error,created_at,updated_at FROM provider_api_keys ORDER BY provider,created_at,id');
  const rotation = await query('SELECT provider,rotation_day,current_key_id FROM provider_key_rotation');
  return { keys: rows.rows, rotation: rotation.rows };
}

export async function removeProviderKey(id, actor = 'owner') {
  const result = await query('DELETE FROM provider_api_keys WHERE id=$1 RETURNING id,provider,label', [String(id || '')]);
  if (!result.rows.length) throw Object.assign(new Error('Provider key not found'), { statusCode: 404 });
  await audit(actor, 'provider_key.deleted', 'provider_api_key', result.rows[0].id, { provider: result.rows[0].provider, label: result.rows[0].label });
  return result.rows[0];
}

export async function markProviderKeyExhausted(id, { until = null, error = 'rate limited' } = {}) {
  if (!id) return null;
  const cooldown = until || nextUtcMidnight();
  const result = await query(
    "UPDATE provider_api_keys SET status='cooldown',cooldown_until=$2,last_error=$3,updated_at=now() WHERE id=$1 RETURNING id,provider,label,status,cooldown_until",
    [String(id), cooldown.toISOString(), String(error).slice(0, 300)],
  );
  return result.rows[0] || null;
}

async function usableKeys(provider) {
  return (await query(
    `SELECT id,provider,label,encrypted_key,status,cooldown_until,created_at FROM provider_api_keys WHERE provider=$1 ORDER BY created_at,id`,
    [provider],
  )).rows;
}

// Read-only: current key for checks/listing; never rotates or marks usage.
export async function peekProviderKey(provider) {
  const normalizedProvider = normalizeProvider(provider);
  const keys = await usableKeys(normalizedProvider);
  if (!keys.length) return null;
  const rotation = (await query('SELECT current_key_id,rotation_day FROM provider_key_rotation WHERE provider=$1', [normalizedProvider])).rows[0];
  const sameDay = rotation && utcDay(rotation.rotation_day) === utcDay();
  const chosen = pickKeyForDay(keys, rotation?.current_key_id, { advance: !sameDay });
  if (!chosen) return null;
  return { id: chosen.id, label: chosen.label, key: decryptSecret(chosen.encrypted_key) };
}

// Rotating: advances once per UTC day and on demand (429); records usage.
export async function getProviderKey(provider, { advance = false } = {}) {
  const normalizedProvider = normalizeProvider(provider);
  return transaction(async (client) => {
    await client.query(
      "UPDATE provider_api_keys SET status='active',cooldown_until=NULL,updated_at=now() WHERE provider=$1 AND status='cooldown' AND cooldown_until<=now()",
      [normalizedProvider],
    );
    const keys = (await client.query(
      'SELECT id,provider,label,encrypted_key,status,cooldown_until,created_at FROM provider_api_keys WHERE provider=$1 ORDER BY created_at,id',
      [normalizedProvider],
    )).rows;
    if (!keys.length) return null;
    const rotationResult = await client.query(
      `INSERT INTO provider_key_rotation (provider,rotation_day,current_key_id,updated_at)
       VALUES ($1,$2,NULL,now())
       ON CONFLICT (provider) DO UPDATE SET updated_at=now()
       RETURNING rotation_day,current_key_id`,
      [normalizedProvider, utcDay()],
    );
    const rotation = rotationResult.rows[0];
    const sameDay = utcDay(rotation.rotation_day) === utcDay();
    const chosen = pickKeyForDay(keys, rotation.current_key_id, { advance: advance || !sameDay });
    if (!chosen) return null;
    await client.query(
      `INSERT INTO provider_key_rotation (provider,rotation_day,current_key_id,updated_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (provider) DO UPDATE SET rotation_day=EXCLUDED.rotation_day,current_key_id=EXCLUDED.current_key_id,updated_at=now()`,
      [normalizedProvider, utcDay(), chosen.id],
    );
    await client.query('UPDATE provider_api_keys SET last_used_at=now() WHERE id=$1', [chosen.id]);
    return { id: chosen.id, label: chosen.label, key: decryptSecret(chosen.encrypted_key) };
  });
}
