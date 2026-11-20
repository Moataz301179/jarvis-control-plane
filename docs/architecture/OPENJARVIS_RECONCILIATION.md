# OpenJarvis Reconciliation

OpenJarvis (`https://github.com/open-jarvis/OpenJarvis`) is a local-first personal
AI framework: a Python runtime with a Rust extension, a React frontend, and a
`jarvis` CLI (`ask`, `chat`, `serve`, `agents`, `channel`, `doctor`).

This repository is the **JARVIS control plane**: the governed system that owns
objectives, plans, tasks, approvals, agent jobs, evidence, incidents,
deployments, audit and reporting.

The two are complementary, not competing. The control plane decides what may
happen; OpenJarvis provides local-first execution primitives.

## Integration (implemented)

| Piece | Location |
|---|---|
| Adapter | `lib/openjarvis.js` |
| Config | `lib/config.js` → `config.openJarvis` |
| Routes | `GET /v1/openjarvis/status`, `POST /v1/openjarvis/ask` |
| Mac bridge action | `openjarvis_ask` (runs OpenJarvis on the owner workstation) |
| Tests | `tests/openjarvis.test.js` |

The adapter shells out to the CLI with `execFile` (no shell), a strict timeout,
an output size cap, and an **environment allowlist**. `JARVIS_*` secrets
(`DATABASE_URL`, owner token, bridge tokens) are never forwarded to the
subprocess. Every run is recorded through `recordInferenceUsage` so the
zero-cost policy and inference ledger cover local runs too.

### Configuration

| Variable | Meaning |
|---|---|
| `JARVIS_OPENJARVIS_ENABLED` | `true` to enable the runtime (default: disabled) |
| `JARVIS_OPENJARVIS_BIN` | Absolute path to a `jarvis` executable |
| `JARVIS_OPENJARVIS_PROJECT` | Source checkout; adapter runs `uv run --project <dir> jarvis` |
| `JARVIS_OPENJARVIS_MODEL` | Default local model |
| `JARVIS_OPENJARVIS_TIMEOUT_MS` | Per-run timeout (default 120000) |

Enable it on a host that has OpenJarvis installed:

```bash
JARVIS_OPENJARVIS_ENABLED=true
JARVIS_OPENJARVIS_PROJECT=/Users/Moatazi/Documents/ChatGPT/OpenJarvis
JARVIS_OPENJARVIS_MODEL=qwen2.5-coder:7b
```

`GET /v1/openjarvis/status` (permission `read`) returns whether the binary is
reachable. `POST /v1/openjarvis/ask` (permission `agent:write`) accepts
`{ "query": "...", "model": "..." }`.

### Running on the owner workstation

OpenJarvis is installed on the Mac, not on the control-plane VPS. To use it from
the control plane, enqueue a governed Mac job:

```bash
POST /v1/mac/jobs        # permission mac:write
{ "action": "openjarvis_ask", "params": { "query": "...", "model": "qwen2.5-coder:7b" } }
```

The Mac bridge resolves `uv` (or `JARVIS_UV_BIN`), runs
`uv run --project <JARVIS_OPENJARVIS_PROJECT or ~/Documents/ChatGPT/OpenJarvis> jarvis ask --json --no-stream`,
and returns the parsed result. The job goes through the standard preflight and
approval policy (`risk: review`).

## Artifact and feature reconciliation

| OpenJarvis artifact | Control plane counterpart | Decision |
|---|---|---|
| `src/openjarvis/traces` | `execution_traces`, `recordTrace` | Keep control-plane traces as the audit record; OpenJarvis traces stay local to runs |
| Skills catalog | `capability-catalog.json`, capability registry | OpenJarvis skills are execution-time; capabilities remain governance-time |
| `scheduler` | `agent_schedules`, operations loop | Control plane retains scheduling authority |
| Approval routes | approvals + autonomy policy | Control plane retains approval authority |
| `server/` FastAPI routes | `/v1/*` control-plane API | Not exposed publicly; adapter uses the CLI |
| `channel` bridges (incl. Telegram) | `telegram-bridge.js` + `jarvis-telegram.service` | **Control-plane Telegram is retained unchanged** |
| Frontend / wallpaper UI | `public/index.html`, `public/styles.css` | **Retained unchanged** (owner background + wallpaper controls) |
| Model routing / cost | `inference.js`, zero-cost policy | OpenJarvis runs are recorded as `provider=openjarvis` |

## Constraints

- **Telegram must not be removed.** `telegram-bridge.js`,
  `jarvis-telegram.service`, and the channel credentials stay as they are.
- **The background-image interface must not be removed.** The
  `owner-background` wallpaper UI and `public/assets/owner-selected-background.jpg`
  stay in the shell.
- OpenJarvis is **disabled by default** so production behaviour is unchanged
  until an operator enables it on a host where it is installed.

## Deployment notes

OpenJarvis is a Python toolchain (needs Python 3.11–3.13 and optionally Ollama).
It is installed on the owner workstation, not on the control-plane VPS. The
control plane therefore ships the adapter with the flag off; enabling it is a
per-host decision.
