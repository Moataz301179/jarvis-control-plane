BEGIN;

CREATE TABLE IF NOT EXISTS model_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider text NOT NULL CHECK (provider IN ('ollama','openrouter')),
  model text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO model_settings (id, provider, model)
VALUES (1, 'ollama', 'llama3.2:3b')
ON CONFLICT (id) DO NOTHING;

COMMIT;
