import fs from 'node:fs/promises';
import { pool, transaction } from '../lib/db.js';

const source = process.argv[2] || 'data/capability-catalog.json';

async function loadCatalog() {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Capability catalog returned HTTP ${response.status}`);
    return response.json();
  }
  return JSON.parse(await fs.readFile(source, 'utf8'));
}

const catalog = await loadCatalog();
if (!catalog?.ok || !Array.isArray(catalog.sources) || !Array.isArray(catalog.skills)) throw new Error('Capability catalog response is invalid');

const sourceMap = new Map(catalog.sources.map((entry) => [entry.repository, entry]));
await transaction(async (client) => {
  for (const entry of catalog.sources) {
    await client.query(`INSERT INTO jarvis_capability_sources
      (id,repository,source_url,source_kind,license,upstream_commit,skill_count,status,integration_notes,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
      ON CONFLICT (id) DO UPDATE SET repository=EXCLUDED.repository,source_url=EXCLUDED.source_url,source_kind=EXCLUDED.source_kind,license=EXCLUDED.license,upstream_commit=EXCLUDED.upstream_commit,skill_count=EXCLUDED.skill_count,status=EXCLUDED.status,integration_notes=EXCLUDED.integration_notes,updated_at=now()`,
    [entry.id, entry.repository, entry.source_url, entry.source_kind, entry.license || 'UNKNOWN', entry.upstream_commit || '', Number(entry.skill_count || 0), entry.status || 'catalogued', entry.integration_notes || '']);
  }
  for (const entry of catalog.skills) {
    const repository = sourceMap.get(entry.repository);
    await client.query(`INSERT INTO jarvis_skill_catalog
      (id,skill_name,description,repository,source_path,source_commit,source_blob_sha,category,license,status,dependency_notes,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
      ON CONFLICT (id) DO UPDATE SET skill_name=EXCLUDED.skill_name,description=EXCLUDED.description,repository=EXCLUDED.repository,source_path=EXCLUDED.source_path,source_commit=EXCLUDED.source_commit,category=EXCLUDED.category,license=EXCLUDED.license,status=EXCLUDED.status,dependency_notes=EXCLUDED.dependency_notes,updated_at=now()`,
    [entry.id, entry.skill_name, `${entry.skill_name} skill from ${entry.repository}`, entry.repository, entry.source_path, repository?.upstream_commit || 'HEAD', '', entry.category || '', entry.license || 'UNKNOWN', entry.status || 'catalogued', repository?.integration_notes || '']);
  }
  const canonicalIds = catalog.skills.map((entry) => entry.id);
  await client.query("UPDATE jarvis_skill_catalog SET status='superseded_legacy',updated_at=now() WHERE NOT (id = ANY($1::text[])) AND status <> 'superseded_legacy'", [canonicalIds]);
});

const counts = await pool.query("SELECT (SELECT count(*) FROM jarvis_capability_sources) AS sources,(SELECT count(*) FROM jarvis_skill_catalog WHERE status <> 'superseded_legacy') AS skills,(SELECT count(*) FROM office_skill_assignments) AS assignments");
console.log(JSON.stringify({ imported: { sources: catalog.sources.length, skills: catalog.skills.length }, database: counts.rows[0] }, null, 2));
await pool.end();
