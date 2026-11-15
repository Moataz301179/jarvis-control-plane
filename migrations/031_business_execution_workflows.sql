BEGIN;

CREATE TABLE IF NOT EXISTS business_work_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL CHECK (project_code IN ('STUDIO','HV')),
  product_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','approved','running','completed','failed','rolled_back','cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'jarvis',
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_work_products_lookup_idx ON business_work_products(project_code,product_type,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS business_outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL CHECK (project_code IN ('STUDIO','HV')),
  work_product_id uuid REFERENCES business_work_products(id) ON DELETE SET NULL,
  discovery_id uuid REFERENCES business_discoveries(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  provider text NOT NULL,
  external_id text,
  internet_message_id text,
  in_reply_to text,
  from_address text,
  to_address text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz,
  received_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS business_outreach_messages_lookup_idx ON business_outreach_messages(project_code,direction,status,observed_at DESC);
CREATE INDEX IF NOT EXISTS business_outreach_messages_reply_idx ON business_outreach_messages(internet_message_id,in_reply_to);

CREATE TABLE IF NOT EXISTS business_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL CHECK (project_code IN ('STUDIO','HV')),
  source text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  currency text NOT NULL DEFAULT 'USD',
  revenue_amount numeric(16,2),
  cost_amount numeric(16,2),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_metric_snapshots_lookup_idx ON business_metric_snapshots(project_code,source,observed_at DESC);

UPDATE business_capability_evidence SET status='ready',detail=detail || '{"runtime":"JARVIS business execution endpoints"}'::jsonb,checked_at=now(),updated_at=now()
WHERE capability_key IN ('supplier_discovery','hotel_discovery','email_sending','reply_monitoring','marketing_campaign_preparation','revenue_reporting','performance_diagnosis','grok_execution','deployment_execution');

COMMIT;
