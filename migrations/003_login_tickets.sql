BEGIN;

CREATE TABLE IF NOT EXISTS login_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_tickets_expiry_idx ON login_tickets (expires_at) WHERE used_at IS NULL;

COMMIT;
