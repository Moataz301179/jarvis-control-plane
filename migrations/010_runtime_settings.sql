BEGIN;

CREATE TABLE IF NOT EXISTS runtime_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO runtime_settings (key,value) VALUES
('voice.session_max_seconds','300'::jsonb),
('voice.daily_session_limit','10'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
