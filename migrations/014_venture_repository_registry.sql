BEGIN;

CREATE TABLE IF NOT EXISTS venture_repository_registry (
  repo_full_name text PRIMARY KEY,
  business_scope text NOT NULL,
  role text NOT NULL,
  visibility text NOT NULL DEFAULT 'UNKNOWN',
  default_branch text NOT NULL DEFAULT 'main',
  local_path text,
  access_state text NOT NULL DEFAULT 'github_connector_readable',
  handover_status text NOT NULL DEFAULT 'inventory_only',
  notes text NOT NULL DEFAULT '',
  verified_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO venture_repository_registry
(repo_full_name,business_scope,role,visibility,default_branch,local_path,handover_status,notes)
VALUES
('Moataz301179/hotels-vendors-platform','HV','Primary active HotelsVendors platform repository; current primary handover target','public','main','/Users/Moatazi/hotels-vendors-new','handover_in_progress','Imported from Hatchable export. Preserve migration history and production boundaries.'),
('Moataz301179/hotels-vendors','HV','Related or legacy HotelsVendors repository; production relationship requires verification','public','main','/Users/Moatazi/Documents/GitHub/hotels-vendors','relationship_to_verify','Imported from Hatchable export. Do not assume obsolete or duplicate.'),
('Moataz301179/hotels-vendors-mobile','HV','HotelsVendors mobile repository; separate application scope','public','main','/Users/Moatazi/Documents/GitHub/hotels-vendors-mobile','handover_in_progress','Imported from Hatchable export. Verify release state separately.'),
('Moataz301179/mozi-trading-ai','NON_HV','Trading AI venture repository','private','main',NULL,'inventory_only','Separate venture. Requires separately approved credentials and scope.'),
('Moataz301179/Escobai-Trader','NON_HV','Trading product repository','private','main',NULL,'inventory_only','Separate venture. No production action authorized.'),
('Moataz301179/verity-backend','NON_HV','Verity backend repository','public','main',NULL,'inventory_only','Separate product. Verify ownership and production use.'),
('Moataz301179/verity-landing','NON_HV','Verity landing website repository','public','main',NULL,'inventory_only','Separate product. Verify deployment and relationship.'),
('Moataz301179/Verity-AI-App.','NON_HV','Verity AI application repository','private','main',NULL,'inventory_only','Separate product. Requires separately approved credentials and scope.'),
('Moataz301179/verity-v2-business-generator','NON_HV','Verity business-generator repository','public','main',NULL,'inventory_only','Separate product. Verify ownership and production use.'),
('Moataz301179/Name-Taz-Agent-Ecosystem','NON_HV','Agent ecosystem repository','private','main',NULL,'inventory_only','Potentially relevant to JARVIS research; not trusted or installed by default.'),
('Moataz301179/sitelens-app','NON_HV','SiteLens application repository','public','main',NULL,'inventory_only','Separate product. Verify ownership and production use.')
ON CONFLICT (repo_full_name) DO UPDATE SET
  business_scope=EXCLUDED.business_scope,role=EXCLUDED.role,visibility=EXCLUDED.visibility,
  default_branch=EXCLUDED.default_branch,local_path=COALESCE(EXCLUDED.local_path,venture_repository_registry.local_path),
  handover_status=EXCLUDED.handover_status,notes=EXCLUDED.notes,updated_at=now();

COMMIT;
