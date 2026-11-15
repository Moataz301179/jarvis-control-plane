BEGIN;
CREATE TABLE IF NOT EXISTS mission_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key text NOT NULL UNIQUE,
 project_code text NOT NULL,
 plan jsonb NOT NULL,
 workspace text NOT NULL,
 status text NOT NULL DEFAULT 'ready',
 step integer NOT NULL DEFAULT 0,
 jobs jsonb NOT NULL DEFAULT '[]',
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
