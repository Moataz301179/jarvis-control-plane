BEGIN;

CREATE TABLE IF NOT EXISTS api_principals (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  token_hash text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);

INSERT INTO role_permissions (role, permission) VALUES
  ('owner','read'), ('owner','mission:write'), ('owner','objective:approve'),
  ('owner','agent:write'), ('owner','memory:write'), ('owner','repository:write'),
  ('owner','provider:write'), ('owner','model:write'), ('owner','mac:write'),
  ('owner','schedule:write'), ('owner','backup:run'), ('owner','access:write'),
  ('operator','read'), ('operator','mission:write'), ('operator','memory:write'),
  ('operator','mac:write'), ('operator','schedule:write'),
  ('auditor','read'), ('scheduler','read'), ('scheduler','schedule:write')
ON CONFLICT (role, permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS inference_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  request_id text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  cost_status text NOT NULL CHECK (cost_status IN ('verified_zero','provider_reported','unverified')),
  free_verified boolean NOT NULL DEFAULT false,
  policy_result text NOT NULL CHECK (policy_result IN ('allowed','blocked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inference_usage_created_idx ON inference_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS inference_usage_policy_idx ON inference_usage(policy_result,created_at DESC);

CREATE TABLE IF NOT EXISTS automation_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  title text NOT NULL,
  details text NOT NULL,
  owner_agent text NOT NULL DEFAULT 'Reliability & Recovery Lead',
  priority text NOT NULL DEFAULT 'medium',
  interval_minutes integer NOT NULL DEFAULT 1440 CHECK (interval_minutes BETWEEN 5 AND 10080),
  approval_policy text NOT NULL DEFAULT 'require_owner' CHECK (approval_policy IN ('require_owner','standing_safe')),
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  last_objective_id uuid REFERENCES objectives(id) ON DELETE SET NULL,
  last_status text NOT NULL DEFAULT 'never_run',
  last_error text,
  created_by text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_schedules_due_idx ON automation_schedules(enabled,next_run_at);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'telegram',
  project_code text NOT NULL DEFAULT 'STUDIO',
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_outbox_due_idx ON notification_outbox(status,next_attempt_at);

CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('running','succeeded','failed')),
  backup_path text,
  backup_sha256 text,
  backup_bytes bigint,
  restore_schema text,
  table_count integer,
  row_count bigint,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS backup_runs_created_idx ON backup_runs(started_at DESC);

ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

INSERT INTO employee_runtimes (id,employee_name,office,role,runtime_type,status,capabilities,project_scope,metadata)
VALUES
  ('hermes-cto','Hermes CTO','Engineering','Execution supervisor','hermes','defined',
   '["specialist-dispatch","toolsets","shared-memory","usage-evidence"]','["STUDIO","HV"]',
   '{"profile":"default","provider":"ollama"}')
ON CONFLICT (id) DO UPDATE SET
  capabilities=EXCLUDED.capabilities,project_scope=EXCLUDED.project_scope,
  metadata=employee_runtimes.metadata || EXCLUDED.metadata,updated_at=now();

COMMIT;
