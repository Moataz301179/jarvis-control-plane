BEGIN;

CREATE TABLE IF NOT EXISTS provider_credentials (
  provider text PRIMARY KEY,
  encrypted_key text NOT NULL,
  agent_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jarvis_voice_guard (
  voice_day date PRIMARY KEY,
  sessions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
