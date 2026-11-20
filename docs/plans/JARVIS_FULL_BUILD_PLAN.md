# JARVIS Full Build Plan

Date: 2026-11-12

This is the complete build plan for JARVIS as a working autonomous business operator. It replaces piecemeal task-by-task work. Every phase has an owner-level acceptance test. JARVIS is not done until the final phase passes.

## Target State

JARVIS is a self-holding, phone-reachable business operator. It holds long-running business objectives across days, discovers and verifies its own context, plans and executes through existing tools (Hermes skills, Codex, Claude, browser, API connectors), monitors its own work, detects when it needs the owner, calls the owner by phone over the internet using Agent Ring, takes the owner's spoken reply as instruction, and resumes execution. It measures outcomes in a profit ledger and reports them honestly.

Concretely, JARVIS should be able to, without the owner naming each step:

- interpret a goal like "run a marketing campaign" into plan, audience, channels, budget and measurable KPIs;
- discover and qualify suppliers or hotels using the tools it has (Apollo, web, CRM) and report leads with evidence;
- draft and send email or outreach using connected mailboxes, and log sends;
- read revenue and performance from installed tools (Stripe, Ads Manager, internal database), find weaknesses, and propose or execute fixes;
- onboard a supplier or hotel end to end: intake, verification, approval, record creation, follow-up;
- monitor its own jobs, detect failure, call the owner by phone with a spoken explanation, resume after instruction;
- persist all work across restarts, resuming from the last verified checkpoint rather than restarting;
- answer the owner any time by phone, Telegram, or the dashboard.

## Phase 1 — Home And Harness (complete, verify)

JARVIS runs on the VPS at `/srv/jarvis`, current release `audit-ec4d606`, behind `jarvis-api`, `jarvis-worker`, `jarvis-verifier`, `jarvis-operations` and `jarvis-telegram` processes. Hermes is the agentic harness with 1,035 capabilities installed.

Todos:

- [x] VPS release deployed and `/version` reports current release
- [x] Hermes harness installed with skill registry
- [ ] Sync local checkout `/Users/Moatazi/Documents/ChatGPT/Jarvis` with the deployed source so local reflects live code (currently behind)
- [ ] Document the live release manifest: process list, ports, env keys, database migrations in place

Acceptance: running `/version` and `pm2 status` on the VPS confirm release and process names above.

## Phase 2 — Brain And Models

JARVIS uses multiple model routes. Codex and Claude handles engineering work; Hermes routes general reasoning; the model router already supports a fallback chain.

Todos:

- [ ] Confirm every model route has a health check the preflight can call
- [ ] Record model latency and cost per route in the profit ledger
- [ ] Set a task-level budget ceiling in credits and elapsed time for each job type

Acceptance: killing the primary model mid-task fails over to the next route, and the trace records which route completed the work.

## Phase 3 — JARVIS Interview (capture context)

JARVIS interviews the owner once, in a structured conversation (Telegram or phone), to learn: the ventures, the revenue model of each, the customer type, the tools in use, the metrics that matter, and the guardrails. Output is committed to a durable profile.

Todos:

- [ ] Build an interview flow that asks one question at a time and confirms each answer back
- [ ] Save answers as a structured business profile (JSON) plus a plain-language narrative
- [ ] Make job planning load the business profile automatically
- [ ] Allow the owner to correct any profile entry, and version the correction without losing history

Acceptance: a fresh JARVIS instance, given only the completed profile, can name the ventures, their revenue models, the priority metrics, and the guardrails, without asking the owner again.

## Phase 4 — Persistent Memory (second brain)

All state survives restarts. JARVIS owns three layers: a business profile, a per-job execution state with checkpoints, and a result ledger.

Todos:

- [ ] Store business profile in the primary database with migration history
- [ ] Implement per-job checkpointing: every durable step writes state before moving on
- [ ] Implement resume: a crashed or restarted job continues from the last checkpoint, never restarting from step zero
- [ ] Record completed side effects (emails sent, records written) immutably so retries never duplicate
- [ ] Record measured outcomes and cost in a profit ledger per job
- [ ] Keep hot memory in Redis for speed, durable copy in Postgres

Acceptance test that proves the whole mechanism, not just one feature:

1. Start a long task (for example, "find 5 suppliers in F&B, draft intro email for each").
2. Kill the JARVIS process mid-task.
3. Restart.
4. Confirm the job resumes from the last checkpoint, no work duplicates, and the ledger shows cost and completed side effects.

## Phase 5 — Skills

Hermes already has 1,035 capabilities installed. The gap is reliable discovery and invocation from JARVIS jobs, not installing more skills.

Todos:

- [ ] Index every Hermes skill into a searchable registry inside JARVIS (name, purpose, required tools, cost, risk class)
- [ ] Build a capability resolver: given a job step, JARVIS picks the minimum skill set that can complete it
- [ ] Route skill execution through Hermes preflight checks (online, permissioned, cost within budget)
- [ ] Create the four startup roles explicitly: marketing campaign runner, supplier onboarding, hotel onboarding, revenue analyst
- [ ] Test each startup role on one held-out task the resolver has not seen before

Acceptance: for a held-out task ("onboard a new hotel contact I just met at a conference"), JARVIS resolves the right skills, runs them, and produces a record with evidence — with no code changes needed per task.

## Phase 6 — Tool Connections

JARVIS connects to the same tool surface as Hermes and verifies each connection itself before using it. Connections already present: Apollo (with credits), Google Drive, Stripe (test mode), Gmail (requires reauth), Telegram, ChatGPT Ads Manager (no ad account linked yet), JARVIS internal DB.

Todos:

- [ ] Re-authenticate Gmail
- [ ] Add a verified sending mailbox to Apollo
- [ ] Link a working ad account to ChatGPT Ads Manager, or remove it from the active toolset until it is linked
- [ ] Extend the preflight to check tool health, quota and permissions for each tool a job needs before starting
- [ ] Fail fast with a human-readable reason when a required tool is not ready, before any work runs

Acceptance: for any given job, JARVIS names which tools it will use, which are healthy, which are missing, and blocks cleanly when one is not ready.

## Phase 7 — Communication Channels

Telegram is already running. Add phone calling and notification fallback.

Todos:

- [ ] Keep Telegram as the primary written channel
- [ ] Integrate Agent Ring: self-hosted voice bridge from JARVIS's own server to the owner's phone over the internet
- [ ] Escalation flow: when JARVIS is blocked or uncertain for more than a defined threshold, it places the call, speaks the situation, and listens for instruction
- [ ] The owner's spoken reply arrives as instruction text into the running job
- [ ] Missed call becomes a message notification the owner can answer from the phone's notification drawer
- [ ] Two-way recall: the owner can call JARVIS back mid-task and ask for status or change direction
- [ ] Log every call and instruction in the job trace with a timestamp and the reply transcript

Acceptance:

1. JARVIS hits a planned blocker mid-task and calls the owner's phone within 30 seconds.
2. Owner hears a spoken summary and responds with "send the email" or similar.
3. JARVIS transcribes that, resumes execution with that instruction, and the trace shows the call, transcript and resumed work.
4. Owner calls JARVIS back while a task runs and gets a truthful spoken status.

## Phase 8 — Dashboard Command Center

Single web UI at the existing JARVIS URL.

Todos:

- [ ] Show active and completed jobs with their checkpoint state, not just a chat log
- [ ] Show profit ledger: revenue attributed, cost incurred, per job and per venture
- [ ] Show tool health (Hermes, Apollo, Gmail, Stripe, Ads Manager, Telegram, phone bridge) as one status board
- [ ] Connected Accounts panel reflects verified session state exactly — opened is not verified
- [ ] Allow the owner to pause, correct, or approve a running job from the UI

Acceptance: every number on the dashboard traceable to a live data source, no fabricated metrics.

## Phase 9 — Testing, Verification And Honest Reporting

No claiming done until evidence exists.

Todos:

- [ ] Automated suite for preflight, memory, checkpoints, profit ledger, tool resolution
- [ ] Held-out task suite: 10 tasks JARVIS has never seen (one per job class, at least 3 totally new to the resolver), each must complete with evidence and no code change
- [ ] Kill-and-resume test suite: confirm durability under restart for every job class
- [ ] Phone-call test suite: escalation, resume-after-instruction, missed-call-as-message, owner recall
- [ ] Truthful report mode: every completion report includes what was done, evidence links, cost, revenue impact, and any known gaps
- [ ] Documented release runbook so a new deployment is reproducible

Acceptance: JARVIS ships as NO-GO for fully unsupervised work until (a) all held-out tasks pass with evidence, (b) kill-and-resume passes for every job class, and (c) every completion report it produces is traceable to data, not inference. Only then is it approved for a supervised production week, and after that, gradually unsupervised.

## Profit Definition (what makes JARVIS worth operating)

JARVIS must produce value the owner can see, not just activity. Acceptable evidence:

- leads sourced with proof of contact (email sent, call scheduled);
- campaigns live with spend, impressions, clicks and conversions measured in the ledger;
- supplier or hotel onboarded with verified record;
- revenue attributed to a specific JARVIS action;
- cost of the action below the attributed return.

When JARVIS cannot attribute an outcome, it says so instead of claiming credit.

## Build Order

Work in this order, not by feature:

1. Phase 3 and 4 together (interview + memory) — this determines everything downstream.
2. Phase 5 and 6 together (skills + tools) — execution capability.
3. Phase 7 (phone + escalation) — owner contact.
4. Phase 8 (dashboard) — visibility.
5. Phase 9 (verification) — release gate.

Nothing is marked done until the phase acceptance test passes and evidence is saved in the trace.
