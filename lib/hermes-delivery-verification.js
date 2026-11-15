const EXTERNAL_ACTIVITY_CLAIMS = [
  /\b(?:sent|delivered|emailed|messaged|contacted)\b[^.\n]{0,160}\b(?:email|message|recipient|gmail|telegram|linkedin|supplier|hotel)\b/i,
  /\b(?:gmail|telegram|linkedin|apollo)\b[^.\n]{0,160}\b(?:verified|connected|delivery|sender|recipient|message)\b/i,
];

const EXTERNAL_TOOLSETS = new Set(['web', 'browser', 'connections', 'computer_use']);

/**
 * A role that ran without an external-capable toolset may summarize its own
 * work, but it cannot claim that an external account or delivery was verified.
 * This prevents a plausible model narrative from becoming durable evidence.
 */
export function unsupportedExternalClaims(result, toolsets = []) {
  if ([...new Set(toolsets)].some((toolset) => EXTERNAL_TOOLSETS.has(String(toolset).toLowerCase()))) return [];
  const text = String(result || '');
  return EXTERNAL_ACTIVITY_CLAIMS
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.toString());
}
