import { query, transaction, audit } from './db.js';
import { decryptSecret } from './secrets.js';

function clip(value, max) {
  return String(value || '').slice(0, max);
}

async function telegramCredentials() {
  const stored = await query("SELECT * FROM provider_credentials WHERE provider='telegram'");
  if (!stored.rows.length) return null;
  try {
    return { token: decryptSecret(stored.rows[0].encrypted_key), chatId: String(stored.rows[0].metadata?.chat_id || '') };
  } catch {
    return null;
  }
}

async function sendTelegram(token, chatId, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram HTTP ${response.status}`);
  return result.result;
}

export async function escalateToOwner({ job_id = null, project_code = 'STUDIO', title, question, wait_seconds = 300 } = {}, actor = 'jarvis') {
  if (!title || !question) throw Object.assign(new Error('title and question are required'), { statusCode: 400 });
  const wait = Math.min(Number(wait_seconds) || 300, 3600);
  const credentials = await telegramCredentials();
  if (!credentials?.token || !credentials?.chatId) {
    return { ok: false, reason: 'telegram_not_configured', hint: 'Connect Telegram in Settings first.' };
  }
  const header = `JARVIS ESCALATION${job_id ? ` · job ${clip(job_id, 40)}` : ''}`;
  const body = `${header}\n${clip(title, 200)}\n\n${clip(question, 4000)}\n\nReply to this message with your instruction — JARVIS will read it and continue automatically.`;
  const sent = await sendTelegram(credentials.token, credentials.chatId, {
    chat_id: credentials.chatId,
    text: body.slice(0, 4096),
    disable_web_page_preview: true,
  });
  const messageId = sent?.message_id || null;
  const rows = await query(
    `INSERT INTO owner_escalations (job_id,project_code,title,question,telegram_message_id,wait_seconds,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`,
    [clip(job_id, 80), clip(project_code, 40), clip(title, 200), clip(question, 4000), messageId, wait],
  );
  const row = rows.rows[0];
  await transaction(async (client) => {
    await audit(client, actor, 'escalation.requested', 'owner_escalation', String(row.id), { jobId: clip(job_id, 80), messageId });
  });
  const deadline = Date.now() + wait * 1000;
  let reply = null;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const replies = await query(
      `SELECT message_id, text, received_at FROM telegram_messages
       WHERE chat_id=$1 AND reply_to_message_id=$2 AND text IS NOT NULL AND text <> ''
       ORDER BY received_at ASC LIMIT 1`,
      [clip(credentials.chatId, 60), messageId],
    );
    if (replies.rows.length && replies.rows[0].text) {
      reply = replies.rows[0];
      break;
    }
  }
  const answered = Boolean(reply?.text?.trim());
  const updated = await query(
    `UPDATE owner_escalations SET status=$2,reply_text=$3,reply_message_id=$4,answered_at=CASE WHEN $5::boolean THEN now() END,answered_within_wait=$5,updated_at=now() WHERE id=$1 RETURNING *`,
    [row.id, answered ? 'answered' : 'timeout', answered ? clip(reply.text, 4000) : null, reply?.message_id || null, answered],
  );
  const final = updated.rows[0];
  await transaction(async (client) => {
    await audit(client, actor, answered ? 'escalation.answered' : 'escalation.timeout', 'owner_escalation', String(final.id), { jobId: clip(job_id, 80), answered });
  });
  return {
    ok: true,
    escalation_id: final.id,
    job_id: clip(job_id, 80),
    title: final.title,
    question: final.question,
    telegram_message_id: final.telegram_message_id,
    status: final.status,
    answered_within_wait: final.answered_within_wait,
    instruction: final.reply_text,
    wait_seconds: final.wait_seconds,
    created_at: final.created_at,
    answered_at: final.answered_at,
  };
}
