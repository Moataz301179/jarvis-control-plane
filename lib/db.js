import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: Number(process.env.JARVIS_STATEMENT_TIMEOUT_MS || 30000),
});

pool.on('error', (error) => {
  console.error('pg pool idle client error (client removed from pool):', String(error?.message || error).slice(0, 500));
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function transaction(fn) {
  const client = await pool.connect();
  let released = false;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      client.release();
      released = true;
    } catch (rollbackError) {
      client.release(rollbackError);
      released = true;
    }
    throw error;
  } finally {
    if (!released) client.release();
  }
}

export async function audit(client, actor, action, entityType, entityId, detail = {}) {
  await client.query(
    'INSERT INTO audit_events (actor, action, entity_type, entity_id, detail) VALUES ($1,$2,$3,$4,$5)',
    [actor, action, entityType, entityId, detail],
  );
}
