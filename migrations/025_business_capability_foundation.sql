-- Business profile, durable checkpoints, profit ledger, Agent Ring calls

CREATE TABLE IF NOT EXISTS business_profile (
  id BIGSERIAL PRIMARY KEY,
  version INTEGER NOT NULL,
  profile JSONB NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execution_checkpoints (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL,
  run_id TEXT,
  step TEXT,
  status TEXT DEFAULT 'checkpointed',
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_digest TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS execution_checkpoints_job_idx ON execution_checkpoints(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS execution_checkpoints_run_idx ON execution_checkpoints(run_id);

CREATE TABLE IF NOT EXISTS checkpoint_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  resume_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkpoint_runs_job_idx ON checkpoint_runs(job_id, started_at DESC);

CREATE TABLE IF NOT EXISTS profit_ledger (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT,
  venture TEXT NOT NULL,
  action TEXT NOT NULL,
  revenue_amount NUMERIC(14,2) DEFAULT 0,
  cost_amount NUMERIC(14,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  source TEXT,
  evidence_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profit_ledger_job_idx ON profit_ledger(job_id);
CREATE INDEX IF NOT EXISTS profit_ledger_venture_idx ON profit_ledger(venture);

CREATE TABLE IF NOT EXISTS agent_ring_calls (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT,
  message TEXT NOT NULL,
  to_phone TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB,
  transcript TEXT,
  instruction TEXT,
  placed_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS agent_ring_calls_job_idx ON agent_ring_calls(job_id, placed_at DESC);
