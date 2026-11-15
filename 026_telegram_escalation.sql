-- Telegram escalation: inbound message log and owner escalation requests

CREATE TABLE IF NOT EXISTS telegram_messages (
  message_id BIGINT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  from_id TEXT,
  username TEXT,
  text TEXT,
  reply_to_message_id BIGINT,
  received_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_messages_reply_idx ON telegram_messages(reply_to_message_id, received_at DESC);
CREATE INDEX IF NOT EXISTS telegram_messages_chat_idx ON telegram_messages(chat_id, received_at DESC);

CREATE TABLE IF NOT EXISTS owner_escalations (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT,
  project_code TEXT DEFAULT 'STUDIO',
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  telegram_message_id BIGINT,
  status TEXT DEFAULT 'pending',
  reply_text TEXT,
  reply_message_id BIGINT,
  wait_seconds INTEGER NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  answered_within_wait BOOLEAN
);
CREATE INDEX IF NOT EXISTS owner_escalations_job_idx ON owner_escalations(job_id, created_at DESC);
