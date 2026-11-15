# JARVIS Contract Audit — 2026-11-10

## Deployment audited

- Source contract: `/Users/Moatazi/Downloads/venture-studio-code-20261110-1757.zip`
- VPS release: `/srv/jarvis/releases/github-94557180ca78`
- Runtime: `jarvis-api`, `jarvis-worker`, `jarvis-verifier`
- Database: dedicated PostgreSQL database `jarvis`
- Redis namespace: database `2`
- API listener: `127.0.0.1:3100`

## Automated result

The repeatable command is:

```bash
JARVIS_ENV_FILE=/srv/jarvis/shared/.env npm run audit:contract
```

Result: **14 PASS / 7 GAP / 0 FAIL**.

### Passing checks

- API and database health.
- Unauthenticated protected API requests return HTTP 401.
- One authenticated worker has a fresh heartbeat.
- The model catalog contains 19 free models and excludes paid models.
- The two-venture Studio model is available.
- A mission can be created in PostgreSQL.
- A mission converts to a durable execution objective.
- Execution remains blocked at `AWAITING_APPROVAL` until owner approval.
- Approval queues the work.
- The worker executes the approved tasks.
- Evidence is persisted with response status and body digest.
- The independent verifier re-executes the allowlisted probes.
- The objective completes only after verification.
- A completion report is persisted.
- Task idempotency keys are unique.
- The completed mission, objective, evidence and report survive restarting all three services.

### Verified execution example

Audit mission:

- Mission: `task-d71fbea8-9f48-4bfe-8d78-ec2dafaa23ce`
- Objective: `b03ad271-96fd-42df-abd3-4170e8fd8bc3`
- Tasks: 2
- Worker probes: HTTP 200 for JARVIS and HotelsVendors
- Independent verifications: 2 passed
- Final state: objective `completed`, Studio mission `done`
- Report: persisted

## Capability gaps

JARVIS cannot currently execute “everything” under the full Studio contract.

1. **Tool breadth:** the only executable tool is the allowlisted read-only `http_probe`.
2. **Hermes specialist runtime:** the connected runtime is a generic JARVIS Node worker. The nine specialist Hermes roles are definitions, not connected role-bound runtimes.
3. **RBAC:** access currently uses an owner token and signed owner session. Tenant, user-role and per-agent permissions are not implemented.
4. **Per-response cost enforcement:** the catalog is free-only and paid fallback is disabled, but chat does not yet persist and reject on provider-reported nonzero `usage.cost` for every response.
5. **Scheduling:** no verified JARVIS mission scheduler or recurring scheduled execution is configured.
6. **Notifications:** Telegram and push delivery are not connected in this VPS implementation.
7. **Recovery proof:** no automated JARVIS database backup and restore acceptance test has been completed.

## Efficiency observations

Measured locally on the VPS:

- Health endpoint: average 1.5 ms, maximum 2.4 ms across 20 requests.
- Studio dashboard: average 3.7 ms, maximum 5.4 ms across 10 requests.
- API process: approximately 44 MB resident memory.
- Worker process: approximately 31 MB resident memory.
- Verifier process: approximately 32 MB resident memory.
- No warning-or-higher API journal entries were present for the previous 24 hours.

The API and database path is efficient for the current data volume and one worker. Chat latency depends on the selected model; OpenRouter free endpoints can fail or rate-limit, after which JARVIS attempts `openrouter/free` and then local Ollama. Local Ollama may take over a minute on a cold model load.

## Contract conclusion

The evidence-backed execution loop is operational for bounded, allowlisted read-only tasks. The wider claim that JARVIS can execute arbitrary venture work remains **BLOCKED** by the seven gaps above.

The next implementation gate should connect one real Hermes specialist runtime to a role-specific tool allowlist, then test permission denial, timeout, retry, cancellation, duplicate delivery, scheduler execution, notification delivery, backup/restore and provider-cost enforcement.
