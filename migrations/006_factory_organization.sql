BEGIN;

CREATE TABLE IF NOT EXISTS venture_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  thesis text NOT NULL DEFAULT '',
  problem text NOT NULL DEFAULT '',
  target_customer text NOT NULL DEFAULT '',
  value_proposition text NOT NULL DEFAULT '',
  business_model text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea','research','validation','business_case','build','launch','operate','scale','paused','rejected')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','rejected')),
  owner_office text NOT NULL DEFAULT 'JARVIS',
  project_code text,
  score numeric(5,2),
  target_kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venture_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES venture_ideas(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  summary text NOT NULL,
  source_url text,
  confidence text NOT NULL DEFAULT 'unverified' CHECK (confidence IN ('verified','estimated','hypothesis','unverified')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_runtimes (
  id text PRIMARY KEY,
  employee_name text NOT NULL,
  office text NOT NULL,
  runtime_type text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'defined',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  project_scope jsonb NOT NULL DEFAULT '["STUDIO"]'::jsonb,
  last_seen timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jarvis_capability_sources (
  id text PRIMARY KEY,
  repository text NOT NULL,
  source_url text NOT NULL,
  source_kind text NOT NULL,
  license text NOT NULL DEFAULT 'UNKNOWN',
  upstream_commit text NOT NULL DEFAULT '',
  skill_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'catalogued',
  integration_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jarvis_skill_catalog (
  id text PRIMARY KEY,
  skill_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  repository text NOT NULL,
  source_path text NOT NULL,
  source_commit text NOT NULL,
  source_blob_sha text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  license text NOT NULL DEFAULT 'UNKNOWN',
  status text NOT NULL DEFAULT 'catalogued',
  dependency_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS office_skill_assignments (
  id bigserial PRIMARY KEY,
  office text NOT NULL,
  skill_id text NOT NULL REFERENCES jarvis_skill_catalog(id) ON DELETE CASCADE,
  requirement text NOT NULL DEFAULT 'available',
  UNIQUE (office, skill_id)
);

CREATE TABLE IF NOT EXISTS inference_reserves (
  id text PRIMARY KEY,
  layer text NOT NULL CHECK (layer IN ('executive','employee')),
  owner text NOT NULL,
  daily_requests integer NOT NULL,
  monthly_cost_limit_usd numeric(10,2) NOT NULL DEFAULT 0,
  paid_fallback_allowed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'defined',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venture_ideas_stage_idx ON venture_ideas(stage,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS employee_runtimes_office_idx ON employee_runtimes(office,status);
CREATE INDEX IF NOT EXISTS jarvis_skill_catalog_name_idx ON jarvis_skill_catalog(skill_name);

INSERT INTO venture_ideas (title,thesis,problem,target_customer,value_proposition,business_model,stage,status,owner_office,project_code,target_kpis)
VALUES
('HotelsVendors','Digitize hospitality procurement and connect hotels, suppliers, logistics and finance partners.','Hotels rely on fragmented buying, unclear availability and manual approval workflows.','Egyptian hotels and hospitality groups','One procurement workflow with fixed pricing, delivery evidence and finance integration.','Transactional fees, supplier subscriptions and embedded finance','operate','active','ATLAS','HV','["Verified procurement journey","Active buyer and supplier usage","Contribution margin evidence","Verified revenue"]'),
('AI Venture Studio','Create repeatable profitable businesses through evidence-gated automation.','New business ideas need structured qualification, execution and operating oversight.','The owner and future portfolio ventures','A factory that converts ideas into validated, launched and measured businesses.','Portfolio profit and venture services','build','active','JARVIS','STUDIO','["Five validated ideas","One paid proof","Repeatable acquisition","Operating profitability"]')
ON CONFLICT DO NOTHING;

INSERT INTO employee_runtimes (id,employee_name,office,runtime_type,role,status,capabilities,project_scope,metadata)
VALUES
('jarvis-coo','JARVIS','Executive','orchestrator','Chief Operating Officer','active_control_plane','["plan","prioritize","delegate","approve","verify","report"]','["STUDIO","HV"]','{"authority":"executive"}'),
('hermes-cto','Hermes','Technology','agent-runtime','Chief Technology Officer and execution supervisor','not_connected','["employee-dispatch","tool-use","engineering","recovery"]','["STUDIO","NON_HV"]','{"authority":"execution_layer"}'),
('atlas-office','ATLAS','Commercial Intelligence','executive-office','Market and commercial intelligence office','defined','["market-research","competitor-analysis","customer-discovery","pricing"]','["STUDIO","NON_HV"]','{"authority":"research_and_recommend"}'),
('forge-office','FORGE','Engineering','executive-office','Engineering and integration office','defined','["engineering","repositories","testing","deployment-planning"]','["STUDIO","NON_HV"]','{"authority":"build_in_sandbox"}'),
('sentinel-office','SENTINEL','Governance','executive-office','Security and evidence gate','defined','["security-review","quality","evidence-verification"]','["STUDIO","HV"]','{"authority":"block_unsafe_changes"}'),
('hermes-employee-pool','Hermes Employee Pool','Technology','employee-pool','Specialist execution employees','not_connected','["bounded-tasks","tools","skills","memory"]','["STUDIO"]','{"authority":"execute_approved_missions"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO jarvis_capability_sources (id,repository,source_url,source_kind,license,upstream_commit,skill_count,status,integration_notes)
VALUES
('marketing-skills','kostja94/marketing-skills','https://github.com/kostja94/marketing-skills','agent-skills','MIT','ac823a127782355339f21aef6c87f1ccff751c84',177,'catalogued','Index only initially. Install selected skills after review and task need.'),
('google-maps-scraper','gosom/google-maps-scraper','https://github.com/gosom/google-maps-scraper','agent-skills','MIT','e0c1d501e49cdcd5c6b2cecd2a032831f6ee9ba8',1,'catalogued','Conditional prospecting tool after legal/privacy review.'),
('frappe-crm','frappe/crm','https://github.com/frappe/crm','application-skill','AGPL-3.0','2cecd300c8291d5abe6793e20fafe7e81a77d989',1,'catalogued','Requires a separate Frappe CRM deployment.'),
('papermark','papermark/papermark','https://github.com/papermark/papermark','agent-skills','AGPL-3.0','ed19717ec02a1ac79aecf5569159aa9d2d869312',11,'catalogued','Inspect individual app-specific skills before use.'),
('contextus','kostja94/contextus','https://github.com/kostja94/contextus','agent-skills','UNKNOWN','25ff40ed98e85ed1130a41e7e704a52953cfba3d',1,'catalogued','Review per-skill license and dependencies.'),
('conductor','microsoft/conductor','https://github.com/microsoft/conductor','agent-skills','MIT','ac81d7fb7e48b4fc2538486611762a5d697a01c1',2,'catalogued','Review plugin and demo skill packs before use.')
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,integration_notes=EXCLUDED.integration_notes,updated_at=now();

INSERT INTO jarvis_skill_catalog (id,skill_name,description,repository,source_path,source_commit,category,license,status)
VALUES
('skill-competitor-research','competitor-research','Evidence-backed competitor and alternative mapping.','kostja94/marketing-skills','/competitor-research/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','research','MIT','catalogued'),
('skill-keyword-research','keyword-research','Search demand, intent and keyword opportunity analysis.','kostja94/marketing-skills','/keyword-research/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','marketing','MIT','catalogued'),
('skill-content-strategy','content-strategy','Content themes, audiences and editorial planning.','kostja94/marketing-skills','/content-strategy/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','marketing','MIT','catalogued'),
('skill-seo-strategy','seo-strategy','Technical and on-page SEO planning.','kostja94/marketing-skills','/seo-strategy/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','marketing','MIT','catalogued'),
('skill-product-launch','product-launch','Launch readiness and release planning.','kostja94/marketing-skills','/product-launch/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','launch','MIT','catalogued'),
('skill-gtm-strategy','gtm-strategy','Segment, positioning and go-to-market strategy.','kostja94/marketing-skills','/gtm-strategy/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','strategy','MIT','catalogued'),
('skill-pricing-strategy','pricing-strategy','Pricing hypotheses, packaging and validation.','kostja94/marketing-skills','/pricing-strategy/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','finance','MIT','catalogued'),
('skill-cold-start-strategy','cold-start-strategy','First-customer acquisition and cold-start experiments.','kostja94/marketing-skills','/cold-start-strategy/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','growth','MIT','catalogued'),
('skill-analytics-tracking','analytics-tracking','Event and measurement architecture.','kostja94/marketing-skills','/analytics-tracking/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','analytics','MIT','catalogued'),
('skill-google-search-console','google-search-console','Search performance evidence workflow.','kostja94/marketing-skills','/google-search-console/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','analytics','MIT','catalogued'),
('skill-ai-traffic-tracking','ai-traffic-tracking','AI-search referral and discovery measurement.','kostja94/marketing-skills','/ai-traffic-tracking/SKILL.md','ac823a127782355339f21aef6c87f1ccff751c84','analytics','MIT','catalogued')
ON CONFLICT (id) DO NOTHING;

INSERT INTO office_skill_assignments (office,skill_id,requirement)
SELECT office,id,'recommended' FROM jarvis_skill_catalog c
CROSS JOIN (VALUES ('ATLAS'),('FORGE'),('SENTINEL')) AS offices(office)
WHERE c.skill_name IN ('competitor-research','gtm-strategy','pricing-strategy','cold-start-strategy','seo-strategy','analytics-tracking')
ON CONFLICT (office,skill_id) DO NOTHING;

INSERT INTO inference_reserves (id,layer,owner,daily_requests,monthly_cost_limit_usd,paid_fallback_allowed,status,metadata)
VALUES
('executive-reserve','executive','JARVIS',100,0,false,'defined','{"priority":"critical_decisions_and_recovery"}'),
('employee-pool','employee','Hermes Employee Pool',1000,0,false,'defined','{"priority":"bounded_employee_tasks"}')
ON CONFLICT (id) DO NOTHING;

COMMIT;
