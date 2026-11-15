BEGIN;

CREATE TABLE IF NOT EXISTS repository_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  repository text NOT NULL,
  repository_url text NOT NULL,
  workspace_path text NOT NULL,
  status text NOT NULL CHECK (status IN ('cloned','ready','dependency_install_failed')),
  commit_sha text NOT NULL DEFAULT '',
  branch text NOT NULL DEFAULT '',
  license text NOT NULL DEFAULT 'UNKNOWN',
  manifests jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependency_status text NOT NULL DEFAULT 'not_requested',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_code, repository)
);

CREATE INDEX IF NOT EXISTS repository_installations_project_idx ON repository_installations(project_code,updated_at DESC);

COMMIT;
