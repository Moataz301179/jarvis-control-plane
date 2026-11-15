import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../lib/db.js';

const directory = path.resolve('migrations');
for (const name of fs.readdirSync(directory).filter((item) => item.endsWith('.sql')).sort()) {
  const sql = fs.readFileSync(path.join(directory, name), 'utf8');
  await pool.query(sql);
  console.log(`Applied ${name}`);
}
await pool.end();
