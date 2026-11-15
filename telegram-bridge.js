import { config } from './lib/config.js';
import { pool, query } from './lib/db.js';
import { decryptSecret } from './lib/secrets.js';

let stopping = false;

async function getCredentials() {
  const result = await query("SELECT * FROM provider_credentials WHERE provider='telegram'");
  if (!result.rows.length) return null;
  try {
    return { token: decryptSecret(result.rows[0].encrypted_key), chatId: String(result.rows[0].metadata?.chat_id || '') };
  } catch { return null; }
}

async function getProviderCredentials(provider) {
  const result = await query('SELECT * FROM provider_credentials WHERE provider=$1', [provider]);
  if (!result.rows.length) return null;
  try {
    return { apiKey: decryptSecret(result.rows[0].encrypted_key), agentId: result.rows[0].agent_id || '', metadata: result.rows[0].metadata || {} };
  } catch { return null; }
}

async function getSetting(key, fallback = null) {
  const result = await query('SELECT value FROM runtime_settings WHERE key=$1', [key]);
  const value = result.rows[0]?.value ?? fallback;
  // Older rows may contain JSON encoded as text. Normalize both legacy and
  // native jsonb values so a stale quoted conversation id cannot poison chat.
  if (typeof value === 'string' && /^[\[{"-]/.test(value)) {
    try { return JSON.parse(value); } catch {}
  }
  return value;
}

async function setSetting(key, value) {
  await query('INSERT INTO runtime_settings (key,value,updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()', [key, JSON.stringify(value)]);
}

async function telegram(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  return response.json().catch(() => ({}));
}

async function send(token, chatId, text) {
  for (let offset = 0; offset < text.length; offset += 4000) {
    const result = await telegram(token, 'sendMessage', { chat_id: chatId, text: text.slice(offset, offset + 4000) });
    if (!result.ok) throw new Error(result.description || 'Telegram sendMessage failed');
  }
}

async function sendAudio(token, chatId, bytes, caption = 'JARVIS voice update') {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption.slice(0, 1000));
  form.append('audio', new Blob([bytes], { type: 'audio/mpeg' }), 'jarvis-voice.mp3');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram audio HTTP ${response.status}`);
  return result.result;
}

async function elevenVoiceAudio(text) {
  const eleven = await getProviderCredentials('elevenlabs');
  if (!eleven?.apiKey || !eleven.agentId) throw new Error('ElevenLabs voice is not configured');
  const agentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(eleven.agentId)}`, { headers: { 'xi-api-key': eleven.apiKey }, signal: AbortSignal.timeout(12000) });
  const agent = await agentResponse.json().catch(() => ({}));
  const voiceId = agent.conversation_config?.tts?.voice_id || agent.conversationConfig?.tts?.voiceId;
  if (!voiceId) throw new Error('The ElevenLabs agent has no configured voice');
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': eleven.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`ElevenLabs TTS HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function handleMessage(credentials, message) {
  const chatId = String(message.chat?.id || '');
  const text = String(message.text || '').trim();
  if (chatId !== credentials.chatId) return;
  if (!text) {
    await send(credentials.token, credentials.chatId, 'JARVIS is ready for text messages. Voice notes are not transcribed on the Telegram bridge yet; send a text message or use the Talk control in the JARVIS workspace.');
    return;
  }
  if (message.message_id) {
    try {
      await query('INSERT INTO telegram_messages (message_id,chat_id,from_id,username,text,reply_to_message_id,received_at) VALUES ($1,$2,$3,$4,$5,$6,now()) ON CONFLICT (message_id) DO NOTHING', [Number(message.message_id), chatId, String(message.from?.id || ''), String(message.from?.username || ''), text, message.reply_to_message?.message_id ? Number(message.reply_to_message.message_id) : null]);
    } catch (error) {
      console.error(`telegram log failed: ${error.message}`);
    }
  }
  const wantsVoice = /(voice|audio|spoken|speak to me|voice note|voice message)/i.test(text);
  let conversationId = await getSetting('telegram.conversation_id', null);
  const response = await fetch(`${config.apiBaseUrl}/v1/chat`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId || undefined, message: wantsVoice ? `${text}\n\nRespond with a concise spoken update of no more than 45 words.` : text }),
    signal: AbortSignal.timeout(120000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { await send(credentials.token, credentials.chatId, `JARVIS request failed: ${result.error || response.status}`); return; }
  if (result.conversationId) { conversationId = result.conversationId; await setSetting('telegram.conversation_id', conversationId); }
  const answer = result.message?.content || 'JARVIS returned no response.';
  if (wantsVoice) {
    try {
      const audio = await elevenVoiceAudio(answer);
      await sendAudio(credentials.token, credentials.chatId, audio, 'JARVIS voice update');
    } catch (error) {
      await send(credentials.token, credentials.chatId, `${answer}\n\nVoice delivery failed: ${error.message}`);
    }
  } else {
    await send(credentials.token, credentials.chatId, answer);
  }
}

async function main() {
  while (!stopping) {
    const credentials = await getCredentials();
    if (!credentials?.token || !credentials.chatId) { await new Promise((resolve) => setTimeout(resolve, 10000)); continue; }
    try {
      const offset = Number(await getSetting('telegram.offset', 0)) || 0;
      const result = await telegram(credentials.token, 'getUpdates', { offset: offset || undefined, timeout: 25, allowed_updates: ['message'] });
      if (!result.ok) throw new Error(result.description || 'Telegram getUpdates failed');
      if (result.ok && Array.isArray(result.result)) {
        for (const update of result.result) {
          try {
            await handleMessage(credentials, update.message);
          } catch (error) {
            console.error(`telegram update ${update.update_id} failed: ${error.message}`);
            try { await send(credentials.token, credentials.chatId, `JARVIS could not process that message: ${error.message}`); } catch (sendError) { console.error(`telegram failure notice ${update.update_id} failed: ${sendError.message}`); }
          } finally {
            // Acknowledge each update once its reply attempt is complete so a
            // malformed message cannot block the owner channel indefinitely.
            await setSetting('telegram.offset', update.update_id + 1);
          }
        }
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => { stopping = true; });
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => pool.end());
