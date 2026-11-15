export const HERMES_ALLOWED_TOOLSETS = new Set([
  'file', 'web', 'browser', 'computer_use', 'connections', 'vision', 'video',
  'image_gen', 'video_gen', 'x_search', 'tts', 'skills', 'session_search',
  'kanban', 'memory', 'todo', 'clarify', 'terminal', 'code_execution', 'delegation',
  'cronjob', 'a2a', 'agency_agents', 'agora', 'chrome_profiles', 'davinciresolve', 'muse',
  'callme',
]);

export const DEFAULT_HERMES_BROWSER_TOOLSETS = Object.freeze([
  'browser', 'web', 'connections', 'skills', 'memory', 'clarify',
]);

export function normalizeHermesToolsets(requested = []) {
  return [...new Set((Array.isArray(requested) ? requested : []).map(String).filter((item) => HERMES_ALLOWED_TOOLSETS.has(item)))];
}
