BEGIN;

ALTER TABLE account_connection_sessions ADD COLUMN IF NOT EXISTS verification_job_id uuid;
ALTER TABLE account_connection_sessions ADD COLUMN IF NOT EXISTS verification_runtime text;
ALTER TABLE account_connection_sessions ADD COLUMN IF NOT EXISTS expected_hosts jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS account_connection_verification_job_idx ON account_connection_sessions(verification_job_id);

COMMIT;
