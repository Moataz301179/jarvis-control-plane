BEGIN;

CREATE TABLE IF NOT EXISTS agent_registry (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  agent_type text NOT NULL,
  provider text NOT NULL DEFAULT '',
  endpoint text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'defined',
  manager text NOT NULL DEFAULT 'JARVIS',
  current_project text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_seen timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_provider_routes (
  id bigserial PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL DEFAULT '',
  credential_env text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'defined',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (agent_id, provider, model)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  project_code text,
  objective text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','blocked','completed','failed','cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_step text NOT NULL DEFAULT '',
  next_step text NOT NULL DEFAULT '',
  todo jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS project_controls (
  project_code text PRIMARY KEY,
  target_outcome text NOT NULL DEFAULT '',
  deadline date,
  manager text NOT NULL DEFAULT 'JARVIS',
  next_step text NOT NULL DEFAULT '',
  roadmap jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  enhancements jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  update_type text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  agent_id text,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mac_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk text NOT NULL DEFAULT 'safe' CHECK (risk IN ('safe','review','danger')),
  status text NOT NULL DEFAULT 'awaiting_approval' CHECK (status IN ('awaiting_approval','queued','claimed','running','succeeded','failed','cancelled')),
  requested_by text NOT NULL DEFAULT 'JARVIS',
  approved_by text,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mac_bridge_status (
  id text PRIMARY KEY DEFAULT 'primary',
  hostname text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'not_connected',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_seen timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS agent_runs_status_idx ON agent_runs(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS mac_jobs_status_idx ON mac_jobs(status,created_at);

INSERT INTO agent_registry (id,name,agent_type,provider,endpoint,status,manager,capabilities,allowed_commands)
VALUES
('jarvis','JARVIS','orchestrator','internal','http://127.0.0.1:3100','active','Owner','["plan","delegate","verify","report","manage-projects"]','["create-mission","review-project","open-agent","summarize-status"]'),
('hermes','Hermes','agent-runtime','NousResearch','','not_connected','JARVIS','["employee-dispatch","skills","tools","memory"]','["create-run","pause-run","resume-run","open-project"]'),
('codex','Codex','engineering-agent','OpenAI','/Users/Moatazi/.local/bin/codex','installed_on_mac','FORGE','["code","review","test","repository-work"]','["create-run","review-code","run-tests","open-project"]'),
('grok','Grok','research-agent','xAI','https://api.x.ai','provider_ready','ATLAS','["research","challenge-assumptions","market-analysis"]','["create-run","research-query","compare-options"]'),
('claude','Claude','review-agent','Anthropic','/Users/Moatazi/.local/bin/claude','installed_on_mac','SENTINEL','["architecture-review","security-review","code-review"]','["create-run","review-architecture","review-security"]'),
('claw','OpenClaw','automation-agent','OpenClaw','/usr/bin/openclaw','installed_not_verified','FORGE','["automation","tool-use","browser-workflows"]','["create-run","inspect-capabilities","open-project"]')
ON CONFLICT (id) DO UPDATE SET endpoint=EXCLUDED.endpoint,status=EXCLUDED.status,capabilities=EXCLUDED.capabilities,allowed_commands=EXCLUDED.allowed_commands,updated_at=now();

INSERT INTO agent_provider_routes (agent_id,provider,model,credential_env,status)
VALUES
('jarvis','ollama','llama3.2:3b','','ready'),
('jarvis','openrouter','openrouter/free','OPENROUTER_API_KEY','ready'),
('grok','xai','grok-latest','XAI_API_KEY','configured'),
('codex','openai','local-codex-session','OPENAI_API_KEY','installed_on_mac'),
('claude','anthropic','local-claude-session','ANTHROPIC_API_KEY','local_auth_required'),
('hermes','openrouter','openrouter/free','OPENROUTER_API_KEY','runtime_not_connected'),
('claw','openrouter','openrouter/free','OPENROUTER_API_KEY','runtime_not_verified')
ON CONFLICT (agent_id,provider,model) DO NOTHING;

INSERT INTO project_controls (project_code,target_outcome,manager,next_step,roadmap,blockers,enhancements)
VALUES
('STUDIO','Create and operate a repeatable business-idea factory that produces verified profitable ventures.','JARVIS','Connect Hermes employee execution and complete the first evidence-backed employee mission.','["Operating foundation","Hermes workforce","Model gateway","Shared memory","Control room","Venture validation"]','["Hermes employee runtimes are not connected","Voice signing is not connected on the VPS"]','["Project health rollups","Agent run controls","Mac operations bridge"]'),
('HV','Establish verified technical, commercial and ownership readiness for HotelsVendors.','ATLAS','Complete the technical and commercial evidence inventory.','["Access inventory","Product audit","Workflow audit","Revenue evidence","Financial model","Transition readiness"]','["Current production and revenue evidence remain unverified","Credentials and handover materials must remain isolated"]','["Verified feature maturity register"]')
ON CONFLICT (project_code) DO UPDATE SET target_outcome=EXCLUDED.target_outcome,manager=EXCLUDED.manager,next_step=EXCLUDED.next_step,roadmap=EXCLUDED.roadmap,blockers=EXCLUDED.blockers,enhancements=EXCLUDED.enhancements,updated_at=now();

INSERT INTO mac_bridge_status (id,status,capabilities)
VALUES ('primary','not_connected','[]')
ON CONFLICT (id) DO NOTHING;

COMMIT;
