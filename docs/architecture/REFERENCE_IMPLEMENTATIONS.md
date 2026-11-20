# Reference Agent Implementations

Date: 2026-11-12

Purpose: extract proven execution patterns from active open-source agent systems so JARVIS can integrate the useful mechanisms instead of guessing at an agent architecture.

## Scope And License

Source and public documentation are reviewed directly where available. Reusable code is limited to components whose licence permits it and whose notices can be preserved. Agent Zero is currently marked `NOASSERTION` by GitHub, so treat its implementation as reference-only until the actual licence is reviewed and approved.

Hosted model weights and proprietary training data are out of scope. Ghidra and REA can inspect local binaries, application bundles, route graphs and function boundaries, but they cannot recover a hosted model's weights, training corpus, prompts or internal reasoning into a locally cloneable model.

## Reference Systems

| System | Licence | Maturity observed | Mechanisms worth adopting |
|---|---:|---:|---|
| [OpenHands](https://github.com/OpenHands/OpenHands) | MIT | 93,260 stars | Agent Server API, multiple backends, conversation isolation, Docker sandboxing, persisted state, liveness detection and restart-based recovery |
| [Browser Use](https://github.com/browser-use/browser-use) | MIT | 120,746 stars | Persistent browser REPL, raw CDP access, typed actions, browser profiles, domain restrictions, structured output, downloads/uploads, checkpoints and secret redaction |
| [LangGraph](https://github.com/langchain-ai/langgraph) | MIT | 44,823 stars | Durable execution, graph state, checkpoints, resume after failure, interrupts and human-in-the-loop state modification |
| [OpenClaw](https://github.com/openclaw/openclaw) | MIT | 394,371 stars | Gateway/control-plane and execution-node separation, per-session permission modes, tool resolution, exact approval binding, sandbox scopes, network-taint handling and agent isolation |
| [Agent Zero](https://github.com/agent0ai/agent-zero) | NOASSERTION | 19,833 stars | Long-lived AgentContext, pause/intervention, logs, task lifecycle, subordinate agents and extensible tools |

Popularity is not a correctness measure. It is recorded only to show that these systems have substantial real-world use.

## Patterns To Integrate Into JARVIS

### Control plane and execution nodes

OpenClaw's most important pattern is the separation between the Gateway and execution nodes. JARVIS already has a control plane and bridges, but it must enforce the boundary on every operation:

- the control plane resolves authority and policy;
- execution nodes advertise exact capabilities;
- the control plane selects and validates a node;
- the node revalidates its own filesystem and command policy;
- approval is bound to the exact command or action;
- incomplete or ambiguous commands fail closed.

JARVIS should adopt this model instead of allowing a bridge to execute any action merely because it is online.

### Durable state and checkpoints

LangGraph demonstrates the minimum production model for long-running agents: typed graph state, checkpoints, resumable threads, explicit interrupts and human modification of state. JARVIS needs the same semantics in PostgreSQL:

- checkpoint after every durable step;
- resume from the last committed state;
- distinguish retries from new attempts;
- preserve completed side effects across model fallback;
- support pause, inspect, edit and resume;
- never restart a long task from the beginning after a transient failure.

### Isolated execution backends

OpenHands runs agents through a common Agent Server while allowing local, Docker, VM, remote and cloud backends. Conversations can be isolated in separate containers with persistent workspaces. JARVIS should expose execution backends behind one typed interface:

- `local-mac` for approved desktop and browser operations;
- `vps-worker` for deterministic operations;
- `container` for skills, code and risky tools;
- `hermes` for browser, research, MCP and installed skills;
- `codex` and `claude` for bounded engineering work.

Backend identity must be explicit in every Agent Job. A model route alone does not identify the execution environment.

### Browser execution

Browser Use's current design is a persistent REPL with Chrome DevTools Protocol access and browser helpers. Its useful implementation ideas are:

- retain browser state across actions inside one task;
- expose typed actions and structured observations;
- use a dedicated profile that survives between runs;
- restrict allowed domains;
- capture downloaded files and structured output;
- checkpoint progress;
- redact registered secrets from outputs;
- provide deterministic action feedback.

JARVIS must add stronger controls than the reference implementation: the model cannot receive arbitrary Python execution against a browser holding production sessions, and credentials cannot be readable by model-generated code. Browser execution belongs inside a constrained adapter with allowlisted actions, not a broad shell.

### Context and intervention

Agent Zero maintains an explicit AgentContext with identity, logs, lifecycle, pause state and intervention messages. JARVIS should retain an Objective context that includes:

- original owner intent;
- normalized constraints and acceptance criteria;
- current plan and completed steps;
- tool results and evidence;
- approvals and expiry;
- open incidents and blockers;
- owner corrections;
- economic budget and measured return.

An owner correction must update the same live context and interrupt the affected branch without discarding completed verified work.

### Policy and approval

OpenClaw resolves tools through global, agent, session and provider policy. Approval documents are protected from plugin routes, and approval-backed execution stores the exact prepared command plan. JARVIS should adopt the same principles:

- global policy plus project, agent and task overrides;
- deny-by-default for unknown tools and actions;
- approvals bound to an immutable input hash and exact target;
- approval expiry and one-use consumption;
- revalidation immediately before execution;
- separate read, write, financial, credential, deployment and destructive permissions;
- audit every policy removal or denied call.

### Observability and recovery

OpenHands fails visibly when its Agent Server stops responding. LangGraph exposes state transitions and checkpoints. OpenClaw records tool-policy and approval decisions. JARVIS should combine these into one trace containing:

- intent and normalized objective;
- selected execution backend and model route;
- capability resolution and rejected alternatives;
- preflight receipt;
- every tool call, input hash and result;
- checkpoint and retry;
- approval request and decision;
- independent verification result;
- business KPI and profit result.

## What JARVIS Should Borrow

1. OpenHands backend abstraction, isolated conversation runtimes and liveness recovery.
2. Browser Use persistent browser action loop, typed observations and domain restrictions.
3. LangGraph durable state, checkpoints, interrupts and resumable execution semantics.
4. OpenClaw gateway/node authority, tool policy, exact approval binding and sandbox boundaries.
5. Agent Zero's explicit AgentContext and owner intervention model after licence review.

These mechanisms are complementary. None of the projects should replace JARVIS's profit-oriented control plane.

## What JARVIS Should Not Copy

- A free-form model-written shell or Python REPL with access to production credentials.
- Tool availability inferred from installation or a heartbeat alone.
- Prompt instructions as the only approval or permission boundary.
- Browser profiles shared with personal sessions when a task needs an isolated account context.
- Infinite autonomous loops without budget, checkpoint, incident and owner-escalation limits.
- Workflow-specific exceptions that bypass the same execution, evidence and verification path.

## Use Of REA And Ghidra

REA and Ghidra are useful when inspecting:

- Electron or native desktop applications with no published source;
- compiled helpers and bridges;
- JavaScript bundles and ASAR applications;
- binary protocol handling and native API boundaries;
- differences between releases;
- whether a shipped binary matches its documented source.

For these reference projects, source inspection is more accurate and lower risk because their repositories are public. Binary reverse engineering becomes necessary only for a component that has no trustworthy source or for validating that a compiled agent matches the source.

## Integration Decision

JARVIS should adopt these proven execution patterns behind its own contracts. The implementation priority is:

1. execution backend interface and preflight;
2. durable checkpoints and exact approval binding;
3. policy-driven tool resolution and sandboxing;
4. constrained browser adapter;
5. trace, recovery and independent verification;
6. business KPI and profit ledger.
