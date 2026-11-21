# Mac Terminal Autonomy

JARVIS can execute shell commands on the owner's Mac and follow up on the
results.

## Path

1. Owner or the chat agent calls `dispatch_mac_terminal` (or
   `POST /v1/mac/jobs` with `action: "terminal_command"`).
2. The job is classified `risk: review` and **queued immediately** — no
   approval prompt.
3. The Mac bridge claims it, runs `/bin/zsh -lc <command>`, and posts the real
   exit code, stdout and stderr.
4. The chat tool waits for completion (up to the timeout + 15 s) and feeds the
   output back to the model, which can issue the next command.

`get_mac_job { id }` reads a job later if it outlives the wait.

## Autonomy levels

| Setting | Effect |
|---|---|
| default | `review` and `safe` Mac jobs queue automatically; `danger` jobs wait for owner approval |
| `JARVIS_OWNER_AUTONOMY=full` | `danger`-class Mac jobs also queue without approval |

Terminal jobs are `review`, so they run without an approval prompt in both modes.

## Hard safety floor

These remain blocked even in full autonomy, because JARVIS browses untrusted
web content and a prompt injection must not be able to destroy the machine:

- deleting `/`, `~`, `$HOME` or the home tree
- `mkfs`, raw writes to `/dev/sd*`, `diskutil erase/reformat`
- `shutdown`, `reboot`, `halt`, `poweroff`
- `chmod -R 777 /`, fork bombs, redirects into block devices

Commands are limited to 4000 characters, run with a 1 s–10 min timeout, and
their working directory must be inside the home directory or `/tmp`.

## Audit

Every queued command writes `terminal.command_queued` to `audit_events`
(command, cwd, status) and `mac_job.completed` to the execution traces with the
result. Jobs are visible in `mac_jobs`.

## Limits worth knowing

- The shell inherits the bridge's environment, which includes provider keys.
  Prefer scoped commands and never print secrets.
- Commands are non-interactive; `sudo` only works if the Mac is configured
  passwordless.
- Long-running work should use a bounded command or a background job with
  `get_mac_job` follow-up.
