BEGIN;

ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS agent_role text;
ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS hermes_profile text;

CREATE TABLE IF NOT EXISTS hermes_team_roster (
  role text PRIMARY KEY,
  profile text NOT NULL UNIQUE,
  title text NOT NULL,
  expertise jsonb NOT NULL DEFAULT '[]'::jsonb,
  toolsets jsonb NOT NULL DEFAULT '[]'::jsonb,
  owns jsonb NOT NULL DEFAULT '[]'::jsonb,
  does_not jsonb NOT NULL DEFAULT '[]'::jsonb,
  project_scope jsonb NOT NULL DEFAULT '["STUDIO","HV"]'::jsonb,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','degraded','offline')),
  last_verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO hermes_team_roster(role,profile,title,expertise,toolsets,owns,does_not,status,last_verified_at)
VALUES
('chief_of_staff','chief','Chief of Staff','["outcome decomposition","specialist routing","handoffs","approval boundaries","mission reporting"]','["delegation","kanban","memory","session_search","todo","clarify"]','["plan","delegate","reconcile","report"]','["perform specialist work","self-verify","deploy directly"]','ready',now()),
('lead_scout','scout','Lead Scout','["supplier discovery","hotel discovery","contact research","source verification","Apollo enrichment"]','["web","browser","computer_use","file","memory","todo"]','["candidate discovery","deduplication","source evidence","qualification readiness"]','["send outreach","invent contacts","claim unverified supply"]','ready',now()),
('outreach_lead','outreach','Outreach Lead','["email sequences","LinkedIn sequences","personalization","reply triage","suppression controls"]','["web","browser","connections","file","memory","todo"]','["sequence design","qualification questions","reply classification","follow-up planning"]','["mass-send without approval","guess recipient addresses","misrepresent identity"]','ready',now()),
('campaign_director','campaign','Campaign Director','["positioning","campaign strategy","landing pages","ad copy","launch experiments","optimization"]','["web","browser","file","image_gen","video_gen","tts","vision","memory","todo"]','["campaign package","creative plan","channel plan","KPI design","optimization plan"]','["spend budget","publish externally","invent performance data"]','ready',now()),
('implementation_lead','builder','Implementation Lead','["code changes","debugging","testing","migration safety","reviewable repository evidence"]','["terminal","file","code_execution","browser","memory","todo"]','["implementation","tests","diff evidence","technical blockers"]','["deploy production","self-certify release","expose secrets"]','ready',now()),
('revenue_analyst','analyst','Revenue Analyst','["revenue reporting","funnel analysis","unit economics","anomaly diagnosis","data quality"]','["code_execution","file","web","browser","memory","todo","vision"]','["metric extraction","calculation","diagnosis","prioritized fixes","measurement plan"]','["fabricate metrics","call correlation causation","hide missing sources"]','ready',now()),
('quality_sentinel','sentinel','Quality Sentinel','["acceptance verification","adversarial review","evidence audit","security review","completeness checks"]','["web","browser","file","code_execution","terminal","memory","todo"]','["independent review","acceptance gate","failure evidence","release recommendation"]','["perform the original work","accept self-reported proof","certify without evidence"]','ready',now()),
('deployment_operator','release','Deployment Operator','["release preflight","deployment dispatch","health verification","rollback","release identity"]','["terminal","file","code_execution","browser","memory","todo"]','["approved deployment","health proof","rollback execution","release report"]','["deploy without approval","ignore source mismatch","leave an unrecoverable release"]','ready',now()),
('recovery_operator','recovery','Recovery Operator','["uptime monitoring","incident isolation","service recovery","backup verification","alert delivery"]','["web","browser","terminal","code_execution","computer_use","memory","todo","cronjob"]','["outage diagnosis","bounded recovery","independent recovery proof","incident timeline"]','["run destructive recovery without approval","guess root cause","stop at one failed probe"]','ready',now())
ON CONFLICT(role) DO UPDATE SET
  profile=EXCLUDED.profile,title=EXCLUDED.title,expertise=EXCLUDED.expertise,toolsets=EXCLUDED.toolsets,
  owns=EXCLUDED.owns,does_not=EXCLUDED.does_not,status=EXCLUDED.status,last_verified_at=EXCLUDED.last_verified_at,updated_at=now();

CREATE INDEX IF NOT EXISTS hermes_team_roster_profile_idx ON hermes_team_roster(profile,status);
CREATE INDEX IF NOT EXISTS hermes_jobs_role_idx ON hermes_jobs(agent_role,hermes_profile,created_at DESC);

COMMIT;
