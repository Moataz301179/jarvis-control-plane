# JARVIS Release business-20261114-v28

## Provenance

- Base: `/srv/jarvis/releases/business-20261113-v18`
- Published: 2026-11-14
- Active symlink: `/srv/jarvis/current -> /srv/jarvis/releases/business-20261114-v28`
- Runtime: Node.js on the VPS; API on `127.0.0.1:3100`, local tunnel `127.0.0.1:13100`

## Changes

- Spoken chat replies now default to enabled when no browser preference has been saved. The ElevenLabs server path remains independently controlled by `voice.enabled`.
- The chat workspace moves into the main app area when opened; the content view is hidden while chatting so the conversation has the center width.
- Runtime health and the approval inbox render in a right-side status rail at desktop and medium widths.
- Telegram bridge sends now validate Telegram responses, normalize legacy JSON settings, report processing failures, and acknowledge updates only after a reply attempt.
- Hermes one-shot jobs now use isolated rules and a stricter authoritative mission prompt; exact-output jobs do not receive stale shared-memory text.
- Zero-cost mode now filters paid provider catalogue entries from the selectable model list and rejects non-free selections with HTTP 402.
- Claude Code is now the primary JARVIS execution and verification path; mission delegations and project build requests use the Mac Claude runtime. Hermes remains a hidden legacy fallback.
- Claude jobs receive the Yes Boss personality, bounded project-scoped memory context, and a zero-cost OpenRouter model. Successful Claude outputs are written back to shared memory as verified job results.
- The Agents UI now shows Claude Code readiness, recent jobs, project/task selection, and a queue form; the old Hermes panel is hidden.
- Invalid Anthropic shell overrides and the plaintext OpenRouter key were removed from `.zshrc`; JARVIS uses the Keychain-backed OpenRouter credential.

## Verification

- `npm test`: 52 tests passed, 0 failed.
- End-to-end contract audit: 16 checks passed, 0 failed.
- `GET /version`: `business-20261114-v28`.
- `GET /health`: database ready.
- Hermes bridge heartbeat: online; latest safe verification job `fbebc736-5ac9-4f60-98dd-b4816416acc7` succeeded and was independently verified.
- Claude Code job `b3b40665-052b-4745-b657-fee6fb4fb02f` succeeded through the Mac bridge, returned `CLAUDE_MEMORY_OK`, used 12 memory entries, and wrote a verified memory result.
- Three superseded runtime/verification incidents were resolved with an audit record after the successful retry; unrelated legacy evidence incidents remain open.
- ElevenLabs signed session: HTTP 200.
- ElevenLabs MP3 synthesis: HTTP 200, 29,300 bytes, `audio/mpeg`.
- Telegram provider test: HTTP 200, message delivered with message ID 210.
- Local Hermes desktop: backend ready, 920 skills, 28 tools, default profile active.
- Hermes duplicate skill copies were archived; enabled `jarvis-studio` discovery returned to the canonical 193 skills.
- Reproducible `uv` and `pnpm` caches were pruned after the full disk caused Hermes `ENOSPC`; no project or session data was removed.
