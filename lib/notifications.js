import { query, transaction } from './db.js';
import { decryptSecret } from './secrets.js';

function clip(value, max) {
  return String(value || '').slice(0, max);
}

export async function queueNotification({ dedupeKey, projectCode = 'STUDIO', eventType, severity = 'info', title, detail = '', channel = 'telegram' }) {
  const result = await query(
    `INSERT INTO notification_outbox (dedupe_key,channel,project_code,event_type,severity,title,detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (dedupe_key) DO UPDATE SET title=EXCLUDED.title,detail=EXCLUDED.detail,updated_at=now()
     RETURNING *`,
    [clip(dedupeKey, 500), channel, projectCode, eventType, severity, clip(title, 500), clip(detail, 5000)],
  );
  return result.rows[0];
}

async function telegramCredentials() {
  const stored = await query("SELECT * FROM provider_credentials WHERE provider='telegram'");
  if (!stored.rows.length) return null;
  try {
    return { token: decryptSecret(stored.rows[0].encrypted_key), chatId: stored.rows[0].metadata?.chat_id || '' };
  } catch {
    return null;
  }
}

async function sendTelegram(credentials, item) {
  const response = await fetch(`https://api.telegram.org/bot${credentials.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: credentials.chatId,
      text: `JARVIS ${item.severity.toUpperCase()}\n${item.title}\n\n${item.detail}`.slice(0, 4096),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.description || `Telegram HTTP ${response.status}`);
  return body.result;
}

export async function drainNotifications(limit = 10) {
  const credentials = await telegramCredentials();
  if (!credentials?.token || !credentials?.chatId) return { attempted: 0, sent: 0, failed: 0, unavailable: true };
  let attempted = 0;
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < limit; index += 1) {
    const claimed = await transaction(async (client) => {
      const item = await client.query("SELECT * FROM notification_outbox WHERE status='queued' AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
      if (!item.rows.length) return null;
      await client.query("UPDATE notification_outbox SET status='sending',attempts=attempts+1,updated_at=now() WHERE id=$1", [item.rows[0].id]);
      return item.rows[0];
    });
    if (!claimed) break;
    attempted += 1;
    try {
      const message = await sendTelegram(credentials, claimed);
      await query("UPDATE notification_outbox SET status='sent',provider_message_id=$2,error=NULL,updated_at=now() WHERE id=$1", [claimed.id, message?.message_id ? String(message.message_id) : null]);
      sent += 1;
    } catch (error) {
      const attempts = claimed.attempts + 1;
      const retry = attempts < 5;
      await query("UPDATE notification_outbox SET status=$2,error=$3,next_attempt_at=now()+($4::text||' seconds')::interval,updated_at=now() WHERE id=$1", [claimed.id, retry ? 'queued' : 'failed', clip(error.message, 2000), String(Math.min(300, 2 ** attempts))]);
      failed += 1;
    }
  }
  return { attempted, sent, failed, unavailable: false };
}

export async function notificationState() {
  const [outbox, providers] = await Promise.all([
    query('SELECT * FROM notification_outbox ORDER BY created_at DESC LIMIT 100'),
    query("SELECT provider,metadata,updated_at FROM provider_credentials WHERE provider='telegram'"),
  ]);
  return { outbox: outbox.rows, telegramConfigured: providers.rows.length > 0, telegramChatId: providers.rows[0]?.metadata?.chat_id || null };
}
