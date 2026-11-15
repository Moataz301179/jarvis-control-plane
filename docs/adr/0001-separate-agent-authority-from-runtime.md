# ADR 0001: Separate Agent Authority from Runtime

## Status

Accepted.

## Context

Hermes, Codex and Claude Code have overlapping tools but different strengths. Treating each as a generic autonomous coder creates duplicate work, weak review and unclear responsibility. A runtime heartbeat or successful CLI invocation also does not prove that a model produced a correct or honest result.

## Decision

The JARVIS Control Plane owns authority and workflow state. Each Runtime receives only the work class assigned to it:

- Hermes: operations, skills, browser/research, monitoring and tool orchestration.
- Codex: bounded implementation and tests.
- Claude Code: independent review, architecture/security analysis and optional second implementation.
- Deterministic worker: allowlisted evidence-producing tools.
- Verifier: independent evidence checks only.

No Runtime may approve its own work, declare its own Task verified, or bypass the autonomy policy. Production deployment remains a separately approved Deployment Adapter action.

## Consequences

Agent definitions can be changed without changing authority. New agents can be added through registry and model-route records. Cross-agent handoffs must be typed Triggers with evidence. A failed or hallucinated Runtime result becomes an Incident rather than a success.
