const STOP_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'what', 'when', 'where', 'which',
  'your', 'you', 'have', 'does', 'did', 'was', 'were', 'are', 'for', 'not', 'but',
  'can', 'could', 'would', 'should', 'about', 'there', 'their', 'they', 'them',
  'then', 'than', 'into', 'just', 'like', 'please', 'jarvis', 'remember', 'again',
  'tell', 'know', 'want', 'need', 'make', 'sure', 'give', 'show', 'help',
]);

const REMEMBER_PATTERNS = [
  /\bremember(?:\s+that)?\b/i,
  /\bmy name is\b/i,
  /\bcall me\b/i,
  /\bnote that\b/i,
  /\bfrom now on\b/i,
  /\bwe decided\b/i,
  /\bi (?:prefer|always|never|like|want|use|work)\b/i,
  /\bkeep in mind\b/i,
  /\bdon['’]?t forget\b/i,
];

export function shouldRemember(message) {
  const text = String(message || '').trim();
  if (text.length < 8 || text.length > 4000) return false;
  return REMEMBER_PATTERNS.some((pattern) => pattern.test(text));
}

export function memoryTitle(message) {
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function extractKeywords(message) {
  const words = String(message || '').toLowerCase().match(/[a-z0-9][a-z0-9_-]{3,}/g) || [];
  return [...new Set(words)].filter((word) => !STOP_WORDS.has(word)).slice(0, 4);
}
