BEGIN;

CREATE TABLE IF NOT EXISTS shared_memory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  agent_id text NOT NULL,
  memory_type text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  content text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_ref text,
  confidence text NOT NULL DEFAULT 'verified' CHECK (confidence IN ('verified','estimated','hypothesis','unverified')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_memory_project_idx ON shared_memory_entries(project_code,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS shared_memory_search_idx ON shared_memory_entries USING gin(search_vector);

CREATE TABLE IF NOT EXISTS agent_memory_permissions (
  agent_id text NOT NULL,
  project_code text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_write boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, project_code)
);

CREATE TABLE IF NOT EXISTS hermes_bridge_status (
  id text PRIMARY KEY DEFAULT 'primary',
  hostname text NOT NULL DEFAULT '',
  profile text NOT NULL DEFAULT 'default',
  gateway_status text NOT NULL DEFAULT 'unknown',
  gateway_url text NOT NULL DEFAULT '',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hermes_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  title text NOT NULL,
  instruction text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','claimed','running','succeeded','failed','cancelled','awaiting_approval')),
  risk text NOT NULL DEFAULT 'safe' CHECK (risk IN ('safe','review','danger')),
  toolsets jsonb NOT NULL DEFAULT '["file","web","memory","todo","clarify"]'::jsonb,
  working_directory text NOT NULL,
  requested_by text NOT NULL DEFAULT 'owner',
  claimed_by text,
  lease_until timestamptz,
  result text,
  evidence jsonb,
  usage jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS hermes_jobs_queue_idx ON hermes_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS hermes_jobs_project_idx ON hermes_jobs(project_code,updated_at DESC);

INSERT INTO agent_memory_permissions (agent_id,project_code,can_read,can_write) VALUES
('jarvis','STUDIO',true,true),
('jarvis','HV',true,true),
('hermes-cto','STUDIO',true,true),
('hermes-employee-pool','STUDIO',true,true),
('atlas-office','STUDIO',true,false),
('forge-office','STUDIO',true,true),
('sentinel-office','STUDIO',true,false),
('sentinel-office','HV',true,false)
ON CONFLICT (agent_id,project_code) DO UPDATE SET can_read=EXCLUDED.can_read,can_write=EXCLUDED.can_write,updated_at=now();

INSERT INTO hermes_bridge_status (id,profile,gateway_status,gateway_url,capabilities)
VALUES ('primary','default','not_connected','http://127.0.0.1:8644','[]')
ON CONFLICT (id) DO NOTHING;

COMMIT;
