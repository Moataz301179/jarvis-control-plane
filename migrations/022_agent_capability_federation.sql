BEGIN;

CREATE TABLE IF NOT EXISTS agent_capability_registry (
  id bigserial PRIMARY KEY,
  agent_id text NOT NULL,
  project_code text NOT NULL DEFAULT '*',
  capability_key text NOT NULL,
  capability_type text NOT NULL CHECK (capability_type IN ('skill','toolset','mcp','plugin','connection','expertise')),
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  source text NOT NULL,
  source_ref text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('declared','connected','verified','degraded','unavailable','stale')),
  autonomy_class text NOT NULL DEFAULT 'read' CHECK (autonomy_class IN ('read','sandbox','external_write','privileged')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id,project_code,capability_type,capability_key)
);

CREATE INDEX IF NOT EXISTS agent_capability_agent_idx ON agent_capability_registry(agent_id,status,capability_type);
CREATE INDEX IF NOT EXISTS agent_capability_search_idx ON agent_capability_registry USING gin(to_tsvector('simple',capability_key || ' ' || display_name || ' ' || description));

CREATE TABLE IF NOT EXISTS account_connection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL DEFAULT 'STUDIO',
  service text NOT NULL,
  account_alias text NOT NULL,
  login_url text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','opened','awaiting_verification','verified','failed','expired','cancelled')),
  hermes_job_id uuid,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  opened_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_connection_sessions_status_idx ON account_connection_sessions(status,created_at DESC);

CREATE TABLE IF NOT EXISTS owner_profile (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  display_name text NOT NULL,
  preferred_address text NOT NULL,
  background_summary text NOT NULL,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  boundaries jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO owner_profile (id,display_name,preferred_address,background_summary,roles,preferences,boundaries)
VALUES (
  1,
  'Moataz Abdelghani',
  'MOzi or Boss',
  'Senior compliance and internal audit leader with experience across Egypt, UAE and Qatar; CEO/Owner of the JARVIS Venture Studio.',
  '["Director of Internal Audit","Vice President Internal Audit","Group Internal Auditor","Head of Compliance","CEO/Owner of JARVIS Venture Studio"]',
  '{"communication":"calm, clear, slower verbal delivery, concise but complete","planning":"show the big picture, dependencies, ownership and evidence","execution":"autonomous within approved boundaries, with one clear yes/no at defined approval points","progress":"use green check marks for done and hourglass markers for pending","quality":"detect errors early, repair them, avoid overlap, broken or dead code","cost":"zero additional paid services unless explicitly approved","delivery":"work directly in the canonical VPS source and publish atomically"}',
  '{"credentials":"never request or store passwords, tokens or cookies in chat","finance":"never access payments, cards, bank accounts, financial wallets, purchases, transfers, refunds or checkout actions","permissions":"never change its own authority or expand permissions without explicit owner approval","production":"deployment, destructive changes, production migrations and external commitments require explicit owner approval","data":"preserve existing projects and unrelated HotelsVendors services"}'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
