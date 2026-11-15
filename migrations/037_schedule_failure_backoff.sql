ALTER TABLE automation_schedules ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;
ALTER TABLE agent_schedules ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;
