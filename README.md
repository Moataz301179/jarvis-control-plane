# JARVIS Control Plane

JARVIS is an independent control plane. It stores its own objectives, plans, approvals, task queue, worker records, evidence, verification results, and audit events in a dedicated PostgreSQL database. Redis database 2 carries wake-up signals; PostgreSQL is the durable queue source of truth.

HotelsVendors is an external service target. JARVIS may call its public `/api/health` endpoint through an allowlisted read-only probe. The JARVIS repository, database, runtime identity, service units, and release paths do not contain or depend on the HotelsVendors source tree.

## Workflow

`objective -> plan -> approval -> durable queue -> authenticated worker -> evidence -> independent verification -> report`

Only HTTP probes to the configured JARVIS and HotelsVendors health URLs are enabled. The planner falls back to a safe deterministic plan when Ollama is unavailable or returns an invalid plan.

The owner UI is served at `/`. It provides live provider health, a free-model catalog that can be refreshed and applied, objective creation, plan approval, task state, worker heartbeat, evidence inspection, and the audit stream. Session authentication uses an HttpOnly signed cookie derived from the owner token.

## Endpoints

- `GET /health`
- `GET /version`
- `POST /v1/workers/heartbeat` (worker credential)
- `POST /v1/objectives` (owner credential)
- `GET /v1/objectives` (owner credential)
- `GET /v1/objectives/:id` (owner credential)
- `POST /v1/objectives/:id/approvals` (owner credential)
- `GET /v1/objectives/:id/report` (owner credential)

## Local checks

```bash
npm ci
npm run check
npm test
```

Deployment is rooted at `/srv/jarvis`, with the service running as `jarvis-ops`. Runtime secrets live in `/srv/jarvis/shared/.env`, mode `0600`.

For a short-lived local login link, run `npm run login-ticket`, then open `/login?ticket=<ticket>`. Tickets expire after two minutes and can be consumed once.

Processes on the VPS can open `/local-login` through the loopback interface to create an owner session. The API listens only on `127.0.0.1`; this route is rejected unless the direct client address is loopback.
