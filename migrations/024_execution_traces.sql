BEGIN;

CREATE TABLE IF NOT EXISTS execution_trace_events (
  id bigserial PRIMARY KEY,
  trace_id uuid NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execution_trace_events_trace_idx ON execution_trace_events(trace_id,created_at);

COMMIT;
