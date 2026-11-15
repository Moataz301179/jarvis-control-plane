import fs from 'node:fs/promises';

const source = process.argv[2] || 'data/capability-catalog.json';
let body;
if (/^https?:\/\//.test(source)) {
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Capability source returned HTTP ${response.status}`);
  body = await response.json();
} else {
  body = JSON.parse(await fs.readFile(source, 'utf8'));
}
if (!body.ok || body.counts?.sources !== 17 || body.counts?.tools !== 32 || body.counts?.skills !== 193) throw new Error('Capability source counts do not match 17/32/193');
if (!Array.isArray(body.skills) || body.skills.length !== 193) throw new Error('Capability source skill rows are incomplete');
if (body.skills.some((entry) => !entry.id || !entry.repository || !entry.source_path)) throw new Error('Capability source contains incomplete skill identities');
console.log(`capability source verified: ${body.counts.sources} sources, ${body.counts.tools} tools, ${body.counts.skills} skills`);
