BEGIN;

INSERT INTO role_permissions (role, permission) VALUES
  ('owner','deployment:write'),
  ('owner','deployment:approve'),
  ('owner','deployment:adapter:write'),
  ('operator','deployment:write'),
  ('operator','deployment:read'),
  ('auditor','deployment:read')
ON CONFLICT (role, permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS project_deployment_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  name text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  adapter_type text NOT NULL DEFAULT 'github-actions' CHECK (adapter_type IN ('github-actions')),
  repository text NOT NULL,
  workflow_file text NOT NULL,
  workflow_ref text NOT NULL DEFAULT 'main',
  credential_provider text NOT NULL DEFAULT 'github',
  required_input_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  health_url text,
  build_workspace text,
  production_release_root text,
  process_name text,
  approval_policy text NOT NULL DEFAULT 'owner' CHECK (approval_policy IN ('owner')),
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'configured' CHECK (status IN ('configured','credential_required','disabled','degraded')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_code, environment, adapter_type)
);

CREATE TABLE IF NOT EXISTS deployment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id uuid NOT NULL REFERENCES project_deployment_adapters(id) ON DELETE RESTRICT,
  project_code text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  requested_by text NOT NULL,
  approved_by text,
  status text NOT NULL DEFAULT 'awaiting_approval' CHECK (status IN ('awaiting_approval','dispatched','running','succeeded','failed','cancelled')),
  workflow_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  github_run_id bigint,
  github_run_url text,
  conclusion text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  dispatched_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deployment_adapters_project_idx ON project_deployment_adapters(project_code,enabled);
CREATE INDEX IF NOT EXISTS deployment_runs_status_idx ON deployment_runs(status,updated_at);
CREATE INDEX IF NOT EXISTS deployment_runs_project_idx ON deployment_runs(project_code,requested_at DESC);

INSERT INTO project_deployment_adapters
  (project_code,name,environment,adapter_type,repository,workflow_file,workflow_ref,credential_provider,
   required_input_keys,health_url,build_workspace,production_release_root,process_name,approval_policy,status,metadata,created_by)
VALUES
  ('HV','HotelsVendors production deployment','production','github-actions',
   'Moataz301179/hotels-vendors-platform','deploy-production.yml','main','github',
   '["production_migration_confirmation"]','https://www.hotelsvendors.com/api/health',
   '/Users/Moatazi/hotels-vendors-new','/var/www/hv-releases','hotels-vendors-production','owner','credential_required',
   '{"workflow":"deploy-production.yml","build_workspace_trace":"f93918b1","live_release_trace":"f7cc07eaaeb703805c1e567297e333573a4f9ead","notes":"Deployment is executed by GitHub Actions; JARVIS records approval and verifies run evidence."}',
   'owner')
ON CONFLICT (project_code, environment, adapter_type) DO UPDATE SET
  repository=EXCLUDED.repository,workflow_file=EXCLUDED.workflow_file,workflow_ref=EXCLUDED.workflow_ref,
  required_input_keys=EXCLUDED.required_input_keys,health_url=EXCLUDED.health_url,
  build_workspace=EXCLUDED.build_workspace,production_release_root=EXCLUDED.production_release_root,
  process_name=EXCLUDED.process_name,metadata=project_deployment_adapters.metadata || EXCLUDED.metadata,
  updated_at=now();

COMMIT;
