BEGIN;

CREATE TABLE IF NOT EXISTS studio_projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'planning',
  stage text NOT NULL DEFAULT 'discovery',
  summary text NOT NULL DEFAULT '',
  evidence_state text NOT NULL DEFAULT 'unverified',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_agents (
  id text PRIMARY KEY,
  project_code text NOT NULL DEFAULT 'STUDIO',
  name text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  responsibility text NOT NULL DEFAULT '',
  autonomy text NOT NULL DEFAULT 'recommend',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_milestones (
  id text PRIMARY KEY,
  project_code text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  priority text NOT NULL DEFAULT 'medium',
  owner text NOT NULL DEFAULT '',
  due_date date,
  evidence text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_tasks (
  id text PRIMARY KEY,
  project_code text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  owner_agent text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  objective_id uuid REFERENCES objectives(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_alerts (
  id text PRIMARY KEY,
  project_code text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL DEFAULT 'STUDIO',
  actor text NOT NULL,
  event_type text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_tasks_project_status_idx ON studio_tasks(project_code,status,priority);
CREATE INDEX IF NOT EXISTS studio_alerts_status_idx ON studio_alerts(status,severity,updated_at DESC);
CREATE INDEX IF NOT EXISTS studio_activity_created_idx ON studio_activity(created_at DESC);

INSERT INTO studio_projects (id,name,code,status,stage,summary,evidence_state) VALUES
('p-studio','AI Venture Studio','STUDIO','foundation','architecture','Building the operating platform, strategy function, agent governance and executive control room.','partially_defined'),
('p-hv','HotelsVendors','HV','handover_required','commercial_and_technical_audit','Separate venture. Hotel procurement workflow connecting hotels, suppliers, receiving/logistics and potential finance partners. Current implementation, usage, revenue and ownership evidence have not yet been re-verified.','historical_baseline_only')
ON CONFLICT (id) DO NOTHING;

INSERT INTO studio_agents (id,project_code,name,role,status,responsibility,autonomy) VALUES
('a-chief','STUDIO','Executive Orchestrator','Chief of Staff / Mission Control','designing','Translate owner objectives into missions; coordinate priorities, dependencies, reporting and approvals.','coordinate_within_policy'),
('a-strategy','STUDIO','Strategy & Planning Lead','Strategy Office Director','designing','Own portfolio strategy, evidence gates, operating plans and decision reviews.','recommend_and_plan'),
('a-commercial','STUDIO','Commercial Intelligence Lead','Customer / Competitor / Acquisition Intelligence','proposed','Research demand, buying triggers, competitors, channels and willingness to pay.','research_and_recommend'),
('a-hv-transition','HV','HotelsVendors Transition Lead','Business Handover Director','proposed','Build a verified current-state picture of HV, collect evidence and map risks and dependencies.','read_and_recommend'),
('a-hv-product','HV','HV Product & Technical Auditor','Product / Architecture / QA','proposed','Audit flows, repositories, deployments, security, integrations and feature maturity.','read_only_until_authorized'),
('a-hv-growth','HV','HV Revenue & Market Lead','Sales / Partnerships / GTM','proposed','Validate buyer segments, pipeline, objections, positioning and repeatable revenue paths.','research_and_recommend'),
('a-hv-finance','HV','HV Financial Intelligence Lead','Unit Economics / Finance','proposed','Establish revenue, cost, margin, CAC, runway and financial targets from evidence.','read_and_model'),
('a-reliability','STUDIO','Reliability & Recovery Lead','SRE / Incident Commander','proposed','Monitor health, diagnose failures, coordinate repair and verify recovery.','repair_in_sandbox'),
('a-governance','STUDIO','Security & Evidence Gate','Independent Governance / QA','proposed','Review permissions, provenance, evidence, sensitive actions and releases.','block_unsafe_changes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO studio_milestones (id,project_code,title,status,priority,owner,evidence) VALUES
('m-01','STUDIO','Confirm operating constitution and decision/approval boundaries','in_progress','critical','Strategy & Planning Lead','Requirements captured; formal specification not yet approved.'),
('m-02','STUDIO','Deploy first private control-room dashboard','in_progress','high','Executive Orchestrator','Initial dashboard build underway.'),
('m-03','STUDIO','Establish secure project memory and credential architecture','not_started','high','Product & Technical Architecture','Design required; credentials not yet connected.'),
('m-04','STUDIO','Validate agent runtime, durable workflows and recovery architecture','in_progress','high','Product & Technical Architecture','VPS API, worker and verifier are operational; Hermes role binding remains incomplete.'),
('hv-01','HV','Collect current owner handover and access inventory','blocked_external','critical','HotelsVendors Transition Lead','Requires current project records and owner-provided context.'),
('hv-02','HV','Verify live product workflows and technical architecture','not_started','critical','HV Product & Technical Auditor','Historical descriptions are not proof of current implementation.'),
('hv-03','HV','Verify customers, active usage, pipeline and revenue','not_started','critical','HV Revenue & Market Lead','No live CRM, analytics, billing or financial source connected.'),
('hv-04','HV','Rebuild stage-based financial model and commercial priorities','not_started','high','HV Financial Intelligence Lead','Requires actual costs, pricing, usage and customer evidence.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO studio_tasks (id,project_code,title,status,priority,owner_agent,details,acceptance_criteria) VALUES
('t-01','HV','Prepare HotelsVendors handover checklist and evidence request','in_progress','critical','HotelsVendors Transition Lead','Inventory product, code, hosting, domains, databases, integrations, credentials, customers, contracts, suppliers, financials, roadmap and known incidents. Never request secrets in chat.','["Inventory is complete","Every source is identified","Unknowns are explicitly listed"]'),
('t-02','HV','Create feature maturity register: claimed / implemented / used / commercially proven','open','critical','HV Product & Technical Auditor','Each capability needs a source, last verified date, test evidence and confidence.','["Every claimed capability has evidence","Verification date is recorded"]'),
('t-03','HV','Map end-to-end procurement workflow and identify breakpoints','open','high','HV Product & Technical Auditor','Trace requirement to RFQ, offers, PO, delivery/GRN, invoice and payment/funding.','["Every transition is tested","Breakpoints have evidence"]'),
('t-04','HV','Establish baseline customer and revenue metrics','open','critical','HV Revenue & Market Lead','Separate actuals, estimates and unknowns; identify source systems and date ranges.','["Source systems are identified","Actuals and estimates are separated"]'),
('t-05','STUDIO','Review nominated repositories for fit, security and license','in_progress','high','Commercial Intelligence Lead','Assess candidate repositories before any production installation.','["Security reviewed","License reviewed","Fit decision recorded"]'),
('t-06','STUDIO','Specify first founding agents and project operating environment','open','high','Strategy & Planning Lead','Define memory, secrets, tools, permissions, workflow persistence, observability and recovery.','["Each role has a tool allowlist","Runtime and recovery policy are approved"]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO studio_alerts (id,project_code,severity,title,detail,status) VALUES
('al-01','HV','warning','HotelsVendors current state is not yet verified','The control room contains historical analysis and a handover plan, not verified live product, customer, financial or deployment telemetry.','open'),
('al-02','STUDIO','info','Agent roles are defined but not fully provisioned','Most roles remain planning records. The generic VPS operations worker is connected, but specialist role bindings are not yet verified.','open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO studio_activity (project_code,actor,event_type,detail) VALUES
('STUDIO','System','foundation_created','Studio and HotelsVendors project records imported from the owner source archive.'),
('HV','Transition Office','handover_opened','HotelsVendors transition workstream opened; awaiting current source access and evidence.');

COMMIT;
