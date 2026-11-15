BEGIN;

CREATE TABLE IF NOT EXISTS agent_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  agent_type text NOT NULL DEFAULT 'specialist',
  project_code text NOT NULL CHECK (project_code IN ('STUDIO','HV')),
  model_provider text NOT NULL CHECK (model_provider = 'ollama-cloud'),
  model text NOT NULL,
  hermes_profile text NOT NULL DEFAULT 'default',
  policy_profile text NOT NULL DEFAULT 'standard' CHECK (policy_profile IN ('strict','standard','permissive','experimental')),
  approval_policy text NOT NULL DEFAULT 'require_owner' CHECK (approval_policy IN ('read_only','standing_safe','require_owner')),
  workspace text,
  memory_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb,
  skill_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','testing','active','paused','retired','failed')),
  created_by text NOT NULL DEFAULT 'owner',
  version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_factory_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_definition_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  objective text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','awaiting_approval','running','succeeded','failed','cancelled')),
  hermes_job_id uuid REFERENCES hermes_jobs(id) ON DELETE SET NULL,
  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_definitions_status_idx ON agent_definitions(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS agent_factory_runs_status_idx ON agent_factory_runs(status,created_at DESC);
CREATE INDEX IF NOT EXISTS agent_factory_runs_hermes_job_idx ON agent_factory_runs(hermes_job_id);

ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS agent_factory_context jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS agent_skill_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS execution_target text NOT NULL DEFAULT 'cloud' CHECK (execution_target IN ('cloud','mac'));
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS execution_target text NOT NULL DEFAULT 'cloud' CHECK (execution_target IN ('cloud','mac'));
CREATE INDEX IF NOT EXISTS hermes_jobs_target_queue_idx ON hermes_jobs(execution_target,status,created_at);

CREATE TABLE IF NOT EXISTS agent_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_definition_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  title text NOT NULL,
  objective text NOT NULL,
  interval_minutes integer NOT NULL CHECK (interval_minutes BETWEEN 5 AND 10080),
  enabled boolean NOT NULL DEFAULT true,
  approval_policy text NOT NULL DEFAULT 'require_owner' CHECK (approval_policy IN ('require_owner','standing_safe')),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_id uuid REFERENCES agent_factory_runs(id) ON DELETE SET NULL,
  last_status text NOT NULL DEFAULT 'never_run',
  last_error text,
  created_by text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_schedules_due_idx ON agent_schedules(enabled,next_run_at);

CREATE TABLE IF NOT EXISTS agent_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  to_agent_id uuid NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  from_run_id uuid REFERENCES agent_factory_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','completed','failed','cancelled','rejected')),
  accepted_by_run_id uuid REFERENCES agent_factory_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  CHECK (from_agent_id <> to_agent_id)
);
CREATE INDEX IF NOT EXISTS agent_handoffs_inbox_idx ON agent_handoffs(to_agent_id,status,created_at);

COMMIT;
