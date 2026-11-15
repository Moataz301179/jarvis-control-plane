BEGIN;

CREATE TABLE IF NOT EXISTS workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  project_code text NOT NULL DEFAULT 'STUDIO',
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  producer text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','dead')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS workflow_events_due_idx ON workflow_events(status,available_at,created_at);
CREATE INDEX IF NOT EXISTS workflow_events_entity_idx ON workflow_events(entity_type,entity_id,created_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  project_code text NOT NULL DEFAULT 'STUDIO',
  source_type text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  failure_class text NOT NULL CHECK (failure_class IN ('transient','model_route','tool_contract','workspace','evidence','policy','infrastructure','unknown')),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','diagnosing','repairing','waiting_owner','resolved','failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  repair_action text,
  next_action text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status,severity,created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_project_idx ON incidents(project_code,created_at DESC);

COMMIT;
