const STATUS_NOUN = String.raw`\b(?:ventures?|missions?|workers?|runtimes?|roles?|signals?)\b`;
const COUNT_PHRASE = String.raw`\b(?:how\s+many|count|number\s+of)\b`;
const STATUS_COUNT_PATTERN = new RegExp(`${COUNT_PHRASE}[\\s\\S]*${STATUS_NOUN}|${STATUS_NOUN}[\\s\\S]*${COUNT_PHRASE}`, 'i');
const ACTION_PATTERN = /\b(update|install|browse|access|create|build|fix|deploy|send|post|publish|submit|purchase|pay|delete|remove|change|set up|setup|login|log in)\b/i;

export function isStudioStatusCountQuery(message) {
  const value = String(message || '');
  return !ACTION_PATTERN.test(value) && STATUS_COUNT_PATTERN.test(value);
}
