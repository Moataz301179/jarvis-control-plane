BEGIN;

ALTER TABLE project_controls ADD COLUMN IF NOT EXISTS started_at timestamptz;

UPDATE project_controls SET started_at = COALESCE(started_at, '2026-11-09T00:00:00Z')
WHERE project_code = 'STUDIO';

UPDATE project_controls SET started_at = COALESCE(started_at, '2026-05-01T00:00:00Z')
WHERE project_code = 'HV';

COMMIT;
