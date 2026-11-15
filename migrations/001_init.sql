BEGIN;

CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  objective text NOT NULL,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('awaiting_approval','queued','running','verifying','completed','failed','cancelled')),
  plan jsonb NOT NULL,
  plan_source text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  title text NOT NULL,
  tool text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending','queued','running','executed','verified','failed')),
  idempotency_key text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner uuid,
  lease_until timestamptz,
  evidence jsonb,
  verification jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (objective_id, sequence)
);

CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  role text NOT NULL,
  token_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_seen timestamptz,
  current_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  actor text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_queue_idx ON tasks (status, available_at, created_at);
CREATE INDEX IF NOT EXISTS tasks_objective_idx ON tasks (objective_id, sequence);
CREATE INDEX IF NOT EXISTS objectives_status_idx ON objectives (status, updated_at);

COMMIT;
