-- Claude Code is the primary JARVIS execution and verification runtime.

INSERT INTO agent_memory_permissions(agent_id,project_code,can_read,can_write,updated_at)
VALUES
  ('claude','STUDIO',true,true,now()),
  ('claude','HV',true,true,now())
ON CONFLICT (agent_id,project_code) DO UPDATE SET
  can_read=true,
  can_write=true,
  updated_at=now();

INSERT INTO agent_model_routes(agent_id,project_code,task_class,provider,model,free_only,enabled,metadata,updated_at)
VALUES
  ('claude','*','review','openrouter','nvidia/nemotron-3.5-lightning:free',true,true,'{"purpose":"Claude Code primary review route through a verified zero-cost OpenRouter model"}',now()),
  ('claude','*','build','openrouter','nvidia/nemotron-3.5-lightning:free',true,true,'{"purpose":"Claude Code primary implementation route through a verified zero-cost OpenRouter model"}',now()),
  ('claude','*','general','openrouter','nvidia/nemotron-3.5-lightning:free',true,true,'{"purpose":"Claude Code primary general execution route through a verified zero-cost OpenRouter model"}',now())
ON CONFLICT (agent_id,project_code,task_class) DO UPDATE SET
  provider=EXCLUDED.provider,
  model=EXCLUDED.model,
  free_only=true,
  enabled=true,
  metadata=agent_model_routes.metadata || EXCLUDED.metadata,
  updated_at=now();

INSERT INTO audit_events(actor,action,entity_type,entity_id,detail)
VALUES ('owner','execution.runtime.primary','agent_runtime','claude-code',jsonb_build_object(
  'runtime','claude-code',
  'replaces','hermes',
  'memory','project-scoped read/write',
  'personality','yes-boss'
));
