import path from 'node:path';

// Hard stops for commands that can destroy the machine or its data regardless
// of intent. These remain blocked even in full owner-autonomy mode.
export const BLOCKED_TERMINAL_PATTERNS = [
  { id: 'delete_root', pattern: /(^|[;&|]\s*)rm\s+(-[A-Za-z]*[rf][A-Za-z]*\s+)+(\/|~|\$HOME)(\s|$)/ },
  { id: 'format_filesystem', pattern: /\bmkfs(\.|\s)/ },
  { id: 'raw_disk_write', pattern: /\bdd\b[^\n]*\bof=\/dev\/(sd|disk|nvme)/ },
  { id: 'erase_disk', pattern: /\bdiskutil\s+(erase|reformat|zeroDisk)/i },
  { id: 'power_state', pattern: /\b(shutdown|reboot|halt|poweroff)\b/i },
  { id: 'world_writable_root', pattern: /\bchmod\s+-R\s+777\s+\/(\s|$)/ },
  { id: 'device_redirect', pattern: />\s*\/dev\/(sd|disk|nvme)/ },
  { id: 'fork_bomb', pattern: /:\(\)\s*\{[^}]*\};\s*:/ },
  { id: 'delete_home_tree', pattern: /\brm\s+(-[A-Za-z]*r[A-Za-z]*f[A-Za-z]*|-rf)\s+(\/Users\/[^/\s]+\/?)(\s|$)/ },
];

export function terminalCommandViolation(command) {
  const value = String(command || '').trim();
  if (!value) return 'command is required';
  if (value.length > 4000) return 'command exceeds 4000 characters';
  for (const rule of BLOCKED_TERMINAL_PATTERNS) {
    if (rule.pattern.test(value)) return `command blocked by safety policy (${rule.id})`;
  }
  return null;
}

export function assertTerminalCommand(command) {
  const violation = terminalCommandViolation(command);
  if (violation) throw Object.assign(new Error(violation), { statusCode: 400 });
  return String(command).trim();
}

// The bridge runs on the Mac and knows the real home directory.
export function resolveTerminalCwd(cwd, home) {
  const requested = String(cwd || '').trim();
  if (!requested) return home;
  const expanded = requested === '~' ? home : requested.startsWith('~/') ? path.join(home, requested.slice(2)) : requested;
  if (!path.isAbsolute(expanded)) throw new Error('cwd must be an absolute path');
  const resolved = path.resolve(expanded);
  const allowed = resolved === home || resolved.startsWith(`${home}${path.sep}`) || resolved === '/tmp' || resolved.startsWith('/tmp/');
  if (!allowed) throw new Error('cwd must be inside the home directory or /tmp');
  return resolved;
}
