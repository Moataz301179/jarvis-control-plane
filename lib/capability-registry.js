const CAPABILITY_TYPES = new Set(['skill','toolset','mcp','plugin','connection','expertise']);
const CAPABILITY_STATUSES = new Set(['declared','connected','verified','degraded','unavailable','stale']);
const AUTONOMY_CLASSES = new Set(['read','sandbox','external_write','privileged']);

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeCapabilityBatch(body = {}) {
  const agentId = clean(body.agent_id, 80).toLowerCase();
  const source = clean(body.source, 160) || 'runtime-sync';
  const projectCode = clean(body.project_code || '*', 32).toUpperCase();
  const capabilities = Array.isArray(body.capabilities) ? body.capabilities : [];
  if (!/^[a-z0-9_-]{2,80}$/.test(agentId)) throw Object.assign(new Error('A valid agent_id is required'), { statusCode: 400 });
  if (!/^([A-Z0-9_-]+|\*)$/.test(projectCode)) throw Object.assign(new Error('A valid project_code is required'), { statusCode: 400 });
  if (!capabilities.length || capabilities.length > 2500) throw Object.assign(new Error('Capability batches must contain 1 to 2500 entries'), { statusCode: 400 });
  const unique = new Map();
  for (const entry of capabilities) {
    const capabilityKey = clean(entry.capability_key || entry.name || entry.id, 240).toLowerCase();
    const capabilityType = clean(entry.capability_type || entry.type, 40).toLowerCase();
    const status = clean(entry.status || 'connected', 40).toLowerCase();
    const autonomyClass = clean(entry.autonomy_class || 'read', 40).toLowerCase();
    if (!capabilityKey || !CAPABILITY_TYPES.has(capabilityType) || !CAPABILITY_STATUSES.has(status) || !AUTONOMY_CLASSES.has(autonomyClass)) continue;
    unique.set(`${capabilityType}:${capabilityKey}`, {
      capability_key: capabilityKey,
      capability_type: capabilityType,
      display_name: clean(entry.display_name || entry.name || capabilityKey, 240),
      description: clean(entry.description, 1200),
      source_ref: clean(entry.source_ref, 1000),
      status,
      autonomy_class: autonomyClass,
      metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
    });
  }
  if (!unique.size) throw Object.assign(new Error('No valid capabilities were supplied'), { statusCode: 400 });
  return { agentId, projectCode, source, replace: body.replace === true, capabilities: [...unique.values()] };
}

export function normalizeAccountLoginUrl(value) {
  let url;
  try { url = new URL(String(value)); }
  catch { throw Object.assign(new Error('Enter a complete HTTPS login URL'), { statusCode: 400 }); }
  if (url.protocol !== 'https:') throw Object.assign(new Error('Account login links must use HTTPS'), { statusCode: 400 });
  if (url.username || url.password) throw Object.assign(new Error('Login URLs cannot contain embedded credentials'), { statusCode: 400 });
  return url.href;
}

export function isProhibitedFinancialExecution(value) {
  const text = String(value || '').toLowerCase();
  if (/\b(card number|card details|cvv|cvc|pin|bank account|iban|routing number|payment credential|security code)\b/.test(text)) return true;
  if (/\b(paypal|wise|revolut|bunq|coinbase|binance|bank(?:ing)?|financial account|credit card|debit card|payment card)\b/.test(text)) return true;
  const directTransaction = /\b(pay(?:ing)? (?:the )?(?:supplier|vendor|invoice|bill)|transfer(?:ring)? (?:funds|money)|send(?:ing)? (?:funds|money)|complete (?:the )?checkout|make (?:a )?payment|place (?:an )?order|withdraw(?:al)?|issue (?:a )?refund|charge (?:my|the|a) card)\b/.test(text);
  if (!directTransaction) return false;
  return !/\b(review|implement|debug|test|document|readme|integration|schema|source code|api design)\b/.test(text);
}

export function assertAccountConnectionAllowed(service, loginUrl) {
  const target = `${service} ${loginUrl}`.toLowerCase();
  if (isProhibitedFinancialExecution(target) || /\b(paypal|stripe|wise|revolut|bunq|bank(?:ing)?|credit card|debit card|wallet|coinbase|binance|crypto exchange)\b/.test(target)) {
    throw Object.assign(new Error('JARVIS is not allowed to access payments, cards, bank accounts or financial wallets'), { statusCode: 403 });
  }
}

export function accountVerificationMatches(job, result) {
  if (!String(job?.title || '').startsWith('Verify account connection:')) return true;
  const requestedService = String(String(job?.instruction || '').match(/account alias .*? for (.+?) is signed in/i)?.[1] || '').trim().toLowerCase();
  const output = String(result || '');
  const lower = output.toLowerCase();
  return Boolean(requestedService && lower.includes(requestedService) && !/example domain|welcome to example\.com/i.test(lower) && /"signed_in"\s*:\s*true|\bsigned_in\s*[:=]\s*true\b|\bsigned in\b/i.test(output));
}
