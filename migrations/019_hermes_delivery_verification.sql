BEGIN;

ALTER TABLE hermes_jobs ADD COLUMN IF NOT EXISTS verification jsonb;

COMMIT;
