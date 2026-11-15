import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function audit(client, actor, action, entityType, entityId, detail = {}) {
  await client.query(
    'INSERT INTO audit_events (actor, action, entity_type, entity_id, detail) VALUES ($1,$2,$3,$4,$5)',
    [actor, action, entityType, entityId, detail],
  );
}
