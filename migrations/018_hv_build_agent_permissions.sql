BEGIN;

INSERT INTO agent_memory_permissions (agent_id, project_code, can_read, can_write) VALUES
  ('hermes-cto','HV',true,true),
  ('hermes-employee-pool','HV',true,true)
ON CONFLICT (agent_id, project_code) DO UPDATE SET
  can_read=EXCLUDED.can_read,
  can_write=EXCLUDED.can_write,
  updated_at=now();

COMMIT;
