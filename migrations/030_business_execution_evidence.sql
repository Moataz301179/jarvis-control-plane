BEGIN;
CREATE TABLE IF NOT EXISTS business_discoveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_code text NOT NULL CHECK (project_code IN ('STUDIO','HV')),
 entity_type text NOT NULL CHECK (entity_type IN ('supplier','hotel')),
 name text NOT NULL,
 domain text,
 website_url text,
 location text,
 source text NOT NULL,
 source_ref text NOT NULL,
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'discovered',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_code,entity_type,source,source_ref)
);
CREATE INDEX IF NOT EXISTS business_discoveries_lookup_idx ON business_discoveries(project_code,entity_type,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS business_capability_evidence (
 capability_key text PRIMARY KEY,
 status text NOT NULL CHECK (status IN ('verified','ready','degraded','blocked')),
 detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 evidence_ref text,
 checked_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref) VALUES
('supplier_discovery','ready','{"source":"Apollo free organization lookup","tested":true}'::jsonb,'apollo-organization-lookup-20261113'),
('hotel_discovery','ready','{"source":"Apollo free organization lookup","tested":true}'::jsonb,'apollo-organization-lookup-20261113'),
('email_sending','degraded','{"runtime":"Hermes authenticated browser","test":"self-addressed Gmail message","independentMailboxVerification":false}'::jsonb,'hermes-job:8c8aa4d9-1b64-46c0-8e5c-2167f79005d7'),
('reply_monitoring','degraded','{"runtime":"Hermes authenticated browser","tested":false}'::jsonb,NULL),
('marketing_campaign_preparation','verified','{"runtime":"Hermes plus Claude","test":"supplier outreach package"}'::jsonb,'mission:f59de8fd-bbcf-4321-8dc3-42e329c29a39'),
('ads_manager_execution','blocked','{"reason":"No accessible ChatGPT Ads Manager account"}'::jsonb,'ads-onboarding-20261113'),
('revenue_reporting','blocked','{"reason":"PostHog project has no ingested events; Stripe account is test mode"}'::jsonb,'analytics-audit-20261113'),
('performance_diagnosis','degraded','{"reason":"Reporting sources not yet populated"}'::jsonb,'analytics-audit-20261113'),
('codex_implementation','ready','{"test":"connectivity only; repository-changing test pending"}'::jsonb,'codex-job:d9a1eff4-684f-4602-b590-caacc10ff0de'),
('grok_execution','blocked','{"reason":"xAI API permission denied: credits or spending limit exhausted"}'::jsonb,'xai-models-403-20261113'),
('phone_calling','degraded','{"reason":"Agent Ring is Android-only; Telegram voice delivery verified instead"}'::jsonb,'telegram-message:142'),
('external_uptime_monitoring','verified','{"runtime":"GitHub Actions external runner","interval_minutes":10}'::jsonb,'github-run:43358265070'),
('deployment_execution','degraded','{"reason":"Approval-gated adapter exists; end-to-end production release pending"}'::jsonb,'hv-adapter:c23de14a-5480-4c51-9ce0-e3413acc0463')
ON CONFLICT(capability_key) DO UPDATE SET status=EXCLUDED.status,detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now();
COMMIT;
