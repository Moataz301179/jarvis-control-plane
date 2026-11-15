import { config } from '../lib/config.js';
import { pool } from '../lib/db.js';
import { hashToken } from '../lib/auth.js';

await pool.query(
  `INSERT INTO workers (id,name,role,token_hash,active,last_seen)
   VALUES ($1,$2,$3,$4,true,NULL)
   ON CONFLICT (name) DO UPDATE SET role=EXCLUDED.role,token_hash=EXCLUDED.token_hash,active=true`,
  [config.workerId, 'primary-worker', 'operations', hashToken(config.workerSecret)],
);
console.log(`Registered worker ${config.workerId}`);
await pool.end();
