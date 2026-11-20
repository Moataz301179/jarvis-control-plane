-- Provider API key pool: multiple keys per provider, rotated daily with
-- cooldown on exhaustion. Keys are encrypted at rest by lib/secrets.js.
CREATE TABLE IF NOT EXISTS provider_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  label text NOT NULL,
  encrypted_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  cooldown_until timestamptz,
  last_used_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, label)
);

CREATE TABLE IF NOT EXISTS provider_key_rotation (
  provider text PRIMARY KEY,
  rotation_day date NOT NULL,
  current_key_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
