import crypto from 'node:crypto';
import { pool } from '../lib/db.js';
import { hashToken } from '../lib/auth.js';

const token = crypto.randomBytes(32).toString('hex');
await pool.query("INSERT INTO login_tickets (token_hash,expires_at) VALUES ($1,now()+interval '2 minutes')", [hashToken(token)]);
process.stdout.write(token);
await pool.end();
