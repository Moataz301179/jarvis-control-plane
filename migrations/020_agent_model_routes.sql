BEGIN;

CREATE TABLE IF NOT EXISTS agent_model_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  project_code text NOT NULL DEFAULT '*',
  task_class text NOT NULL DEFAULT 'general',
  provider text NOT NULL CHECK (provider IN ('inherit','ollama','openrouter','ollama-cloud','anthropic')),
  model text NOT NULL DEFAULT '',
  free_only boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, project_code, task_class)
);

CREATE INDEX IF NOT EXISTS agent_model_routes_lookup_idx ON agent_model_routes(agent_id,project_code,task_class,enabled);

INSERT INTO agent_model_routes (agent_id,project_code,task_class,provider,model,free_only,metadata)
VALUES
  ('codex','*','build','openrouter','openrouter/free',true,'{"purpose":"verified working Codex route through OpenRouter free models; requires secure Mac Keychain item jarvis-openrouter"}'),
  ('codex','*','review','openrouter','openrouter/free',true,'{"purpose":"Codex review work uses the same centrally managed free-model route"}'),
  ('hermes','HV','build','ollama','llama3.2:latest',true,'{"purpose":"safe default for HotelsVendors build work on the Mac bridge"}'),
  ('hermes','*','general','ollama','llama3.2:latest',true,'{"purpose":"local zero-cost route for Mac-side Hermes operations; change centrally when OpenRouter is available on the bridge"}'),
  ('claude','*','review','openrouter','openrouter/free',true,'{"purpose":"Claude Code review and architecture work through the zero-cost OpenRouter route"}'),
  ('claude','*','build','openrouter','openrouter/free',true,'{"purpose":"optional second implementation route; use only when explicitly selected"}')
ON CONFLICT (agent_id,project_code,task_class) DO UPDATE SET
  provider=EXCLUDED.provider,model=EXCLUDED.model,free_only=EXCLUDED.free_only,
  metadata=agent_model_routes.metadata || EXCLUDED.metadata,updated_at=now();

ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS model_provider text;
ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS model_provider text;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS model text;

CREATE TABLE IF NOT EXISTS autonomy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL,
  project_code text NOT NULL DEFAULT '*',
  decision text NOT NULL CHECK (decision IN ('autonomous','owner_approval')),
  risk_level text NOT NULL DEFAULT 'safe' CHECK (risk_level IN ('safe','review','danger')),
  description text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (action_key, project_code)
);

CREATE INDEX IF NOT EXISTS autonomy_rules_lookup_idx ON autonomy_rules(action_key,project_code,enabled);

INSERT INTO autonomy_rules (action_key,project_code,decision,risk_level,description) VALUES
  ('routine_read','*','autonomous','safe','Read-only diagnostics, status checks, inventories and evidence collection.'),
  ('backup_verify','*','autonomous','safe','Create and verify isolated JARVIS backups without modifying source systems.'),
  ('sandbox_build','*','autonomous','review','Build and test project code in an isolated project workspace.'),
  ('branch_commit','*','owner_approval','review','Commit project changes to a branch.'),
  ('pull_request','*','owner_approval','review','Open or update an external pull request.'),
  ('merge_main','*','owner_approval','danger','Merge into a protected or production branch.'),
  ('production_deploy','*','owner_approval','danger','Dispatch or perform a production deployment.'),
  ('production_db_migration','*','owner_approval','danger','Apply a production database migration.'),
  ('credential_change','*','owner_approval','danger','Create, rotate or expose a credential.'),
  ('permission_change','*','owner_approval','danger','Change SSH, firewall, database or application permissions.'),
  ('destructive_change','*','owner_approval','danger','Delete or irreversibly modify data or infrastructure.'),
  ('paid_service','*','owner_approval','danger','Create a paid resource or enable a non-free provider.'),
  ('financial_action','*','owner_approval','danger','Move money, issue a refund or bind a financial commitment.'),
  ('external_commitment','*','owner_approval','danger','Send an external commitment to a customer, supplier, funder or carrier.'),
  ('customer_message','*','owner_approval','danger','Send a message to a customer or other external party.')
ON CONFLICT (action_key,project_code) DO UPDATE SET
  description=EXCLUDED.description, risk_level=EXCLUDED.risk_level,
  updated_at=now();

UPDATE employee_runtimes
SET role='Operations, Skills & Tool Supervisor',
    capabilities='["skills","tool-routing","scheduling","browser","research","monitoring","memory","kanban","fallback-models","operations-supervision"]'::jsonb,
    metadata=metadata || '{"operating_model":"Hermes supervises operations, skills, tools, schedules and evidence; Codex and Claude Code remain distinct specialist build/review runtimes."}'::jsonb,
    updated_at=now()
WHERE id='hermes-cto';

COMMIT;
