# JARVIS Operating System Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use $subagent-driven-development to implement this plan task-by-task.

**Goal:** Turn JARVIS into a governed, event-driven operating system with explicit ownership, model routing, approval boundaries, incident classification and closed-loop verification.

**Architecture:** A PostgreSQL-backed Control Plane owns every state transition. Runtimes execute bounded jobs; the Verifier independently re-observes evidence; incidents trigger approved repair playbooks; only the Owner changes policy or approves privileged work.

**Tech Stack:** Node.js, PostgreSQL, Redis wake-up signals, systemd, Hermes, Codex CLI, Claude Code CLI, GitHub Actions deployment adapters.

---

## Task 1: Canonical Domain and Role Boundary

**Files:**
- Create: `CONTEXT.md`
- Create: `docs/architecture/JARVIS_OPERATING_SYSTEM.md`
- Create: `docs/adr/0001-separate-agent-authority-from-runtime.md`

**Step 1:** Review the three documents against the current code.

**Step 2:** Run `rg -n "Hermes|Codex|Claude|objective|mission" README.md docs CONTEXT.md`.

Expected: every role has one primary authority and no document assigns production approval to an Agent.

**Step 3:** Commit the documents.

## Task 2: Central Model Route Policy

**Files:**
- Create: `lib/routing-policy.js`
- Create: `lib/model-routes.js`
- Test: `tests/routing-policy.test.js`

**Step 1:** Write route-resolution tests for exact, wildcard and inherited routes.

**Step 2:** Run `node --test tests/routing-policy.test.js`.

Expected: all route tests pass.

**Step 3:** Expose routes through `GET /v1/model-routes` and `POST /v1/model-routes` with owner write permission.

**Step 4:** Run `npm run check && npm test`.

## Task 3: Autonomy and Approval Inbox

**Files:**
- Create: `lib/autonomy-policy.js`
- Modify: `server.js`
- Test: `tests/routing-policy.test.js`

**Step 1:** Define action classes for safe reads, sandbox builds, branch commits, production deployment, credentials, destructive changes, financial actions and external commitments.

**Step 2:** Test that risk above the rule ceiling escalates.

**Step 3:** Add `GET /v1/approvals` and `POST /v1/approvals/:kind/:id/decision` with `yes` and `no` decisions.

**Step 4:** Verify that `yes` dispatches the approved action and `no` cancels it with an audit event.

## Task 4: Runtime-Specific Agent Jobs

**Files:**
- Modify: `hermes-bridge/bridge.js`
- Modify: `mac-bridge/bridge.js`
- Modify: `server.js`

**Step 1:** Store `model_provider` and `model` on each Hermes and Objective job.

**Step 2:** Resolve the route before creating an Agent Job.

**Step 3:** Run Codex with `workspace-write` and the selected free route.

**Step 4:** Run Claude Code through an Anthropic-compatible gateway or OpenRouter; reject an invalid direct Ollama endpoint.

**Step 5:** Return workspace evidence, model identity, usage and stderr to JARVIS.

## Task 5: Durable Trigger Registry

**Files:**
- Create: `migrations/021_trigger_incident_repair.sql`
- Create: `lib/triggers.js`
- Create: `tests/triggers.test.js`

**Step 1:** Add `workflow_events` with event id, type, entity, dedupe key, producer, status and payload.

**Step 2:** Add a pure trigger router that maps event type to a handler and rejects unknown handlers.

**Step 3:** Add an outbox consumer in `operations-loop.js` using `FOR UPDATE SKIP LOCKED`.

**Step 4:** Test duplicate delivery is a no-op and unknown events become incidents.

## Task 6: Incident Classification and Repair

**Files:**
- Create: `migrations/021_trigger_incident_repair.sql`
- Create: `lib/incidents.js`
- Create: `docs/architecture/REPAIR_PLAYBOOKS.md`
- Test: `tests/incidents.test.js`

**Step 1:** Add `incidents` with failure class, severity, attempts, owner, next action and terminal state.

**Step 2:** Classify transient, model-route, tool-contract, workspace, evidence, policy, infrastructure and unknown failures.

**Step 3:** Implement only bounded repair playbooks: retry, route fallback, clean worktree and service recovery.

**Step 4:** Escalate policy, destructive, repeated and unknown failures to the single approval inbox.

**Step 5:** Verify every repair emits a `repair.*` audit event and cannot loop forever.

## Task 7: Build-to-Run Lifecycle for HotelsVendors

**Files:**
- Modify: `lib/deployment-adapters.js`
- Modify: `server.js`
- Modify: `scripts/contract-audit.js`

**Step 1:** Emit `build.requested` when JARVIS dispatches a project build.

**Step 2:** Require Codex or Hermes build evidence with commit SHA, changed files, tests and diff hash.

**Step 3:** Trigger Claude review for high-risk code changes.

**Step 4:** Create a deployment request only after build verification and review policy pass.

**Step 5:** Keep production deployment owner-approved and verified from the public health endpoint.

## Task 8: Separation Tests

**Files:**
- Modify: `scripts/contract-audit.js`
- Create: `scripts/verify-separation-live.js`

**Step 1:** Verify JARVIS and HotelsVendors use different service users, cgroups, release paths, PM2 processes and Nginx hosts.

**Step 2:** Verify `jarvis-ops` cannot read HotelsVendors secrets or write HotelsVendors application trees.

**Step 3:** Revoke JARVIS database access to HotelsVendors schemas and prove connection denial.

**Step 4:** Record shared infrastructure exceptions explicitly: VPS, PostgreSQL cluster, Redis and Nginx.

## Task 9: Observability and Recovery

**Files:**
- Modify: `operations-loop.js`
- Modify: `server.js`
- Modify: `docs/architecture/JARVIS_OPERATING_SYSTEM.md`

**Step 1:** Add queue age, lease expiry, retry rate, Incident count, model-route failure and verification latency to system status.

**Step 2:** Add a recovery test with a killed worker and an expired lease.

**Step 3:** Add a model-route failure test that switches only to another approved free route.

**Step 4:** Prove backup and isolated restore remain valid after the new tables are added.

## Task 10: Release Gate

**Files:**
- Modify: `scripts/contract-audit.js`
- Modify: `README.md`

**Step 1:** Run `npm run check && npm test`.

**Step 2:** Run the expanded live contract audit.

**Step 3:** Verify all five JARVIS services have zero unexpected restarts.

**Step 4:** Verify the daily HotelsVendors and JARVIS health schedule still runs.

**Step 5:** Produce an evidence-backed report with completed, unverified and blocked items.
