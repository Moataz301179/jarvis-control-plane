BEGIN;
INSERT INTO agent_memory_permissions (agent_id,project_code,can_read,can_write) VALUES
('codex','STUDIO',true,false), ('codex','HV',true,false), ('claude','STUDIO',true,false), ('claude','HV',true,false), ('grok','STUDIO',true,false), ('grok','HV',true,false)
ON CONFLICT (agent_id,project_code) DO UPDATE SET can_read=EXCLUDED.can_read,can_write=EXCLUDED.can_write,updated_at=now();
UPDATE agent_registry SET status=CASE id WHEN 'grok' THEN 'unavailable_until_verified' ELSE status END, capabilities=CASE id
WHEN 'jarvis' THEN '["outcome-normalization","planning","routing","approval-governance","shared-memory","verification","reporting"]'::jsonb
WHEN 'hermes' THEN '["research","browser","skills","tool-discovery","operations","monitoring","shared-memory"]'::jsonb
WHEN 'codex' THEN '["implementation","testing","repository-work","workspace-evidence","shared-memory-read"]'::jsonb
WHEN 'claude' THEN '["architecture-review","security-review","independent-verification","shared-memory-read"]'::jsonb
WHEN 'grok' THEN '["research-challenge","market-analysis"]'::jsonb ELSE capabilities END, updated_at=now()
WHERE id IN ('jarvis','hermes','codex','claude','grok');
COMMIT;
