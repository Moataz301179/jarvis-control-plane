import crypto from 'node:crypto';
import { query } from './db.js';
import { bearerToken, hashToken, requireOwner, requireSession } from './auth.js';

function unauthorized() {
  return Object.assign(new Error('unauthorized'), { statusCode: 401 });
}

function forbidden(permission) {
  return Object.assign(new Error(`permission required: ${permission}`), { statusCode: 403 });
}

export async function authenticateRequest(req) {
  if (requireOwner(req) || requireSession(req)) {
    req.principal = { id: 'owner', name: 'Owner', role: 'owner' };
    return req.principal;
  }
  const token = bearerToken(req);
  if (!token) throw unauthorized();
  const result = await query('SELECT id,name,role FROM api_principals WHERE token_hash=$1 AND active=true', [hashToken(token)]);
  if (!result.rows.length) throw unauthorized();
  req.principal = result.rows[0];
  await query('UPDATE api_principals SET last_seen=now(),updated_at=now() WHERE id=$1', [req.principal.id]);
  return req.principal;
}

export async function requirePermission(req, permission) {
  const principal = req.principal || await authenticateRequest(req);
  if (principal.role === 'owner') return principal;
  const result = await query('SELECT 1 FROM role_permissions WHERE role=$1 AND permission=$2', [principal.role, permission]);
  if (!result.rows.length) throw forbidden(permission);
  return principal;
}

export async function accessState() {
  const [principals, roles] = await Promise.all([
    query('SELECT id,name,role,active,last_seen,created_at,updated_at FROM api_principals ORDER BY created_at'),
    query('SELECT role,permission FROM role_permissions ORDER BY role,permission'),
  ]);
  const roleMap = Object.fromEntries([...new Set(roles.rows.map((row) => row.role))].map((role) => [role, []]));
  for (const row of roles.rows) roleMap[row.role].push(row.permission);
  return { principals: principals.rows, roles: roleMap };
}

export async function createPrincipal(body, actor = 'owner') {
  const id = String(body.id || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const role = String(body.role || '').trim();
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(id)) throw Object.assign(new Error('Principal id must use 3-64 lowercase letters, numbers, underscores or hyphens'), { statusCode: 400 });
  if (!name || name.length > 120) throw Object.assign(new Error('Principal name is required and must be <= 120 characters'), { statusCode: 400 });
  const roleExists = await query('SELECT 1 FROM role_permissions WHERE role=$1 LIMIT 1', [role]);
  if (!roleExists.rows.length) throw Object.assign(new Error('Choose an existing role'), { statusCode: 400 });
  const token = `jv_${crypto.randomBytes(32).toString('base64url')}`;
  const result = await query('INSERT INTO api_principals (id,name,role,token_hash) VALUES ($1,$2,$3,$4) RETURNING id,name,role,active,created_at', [id, name, role, hashToken(token)]);
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'access.principal_created', 'api_principal', id, { role }]);
  return { ...result.rows[0], token };
}

export async function deactivatePrincipal(id, actor = 'owner') {
  if (id === 'owner') throw Object.assign(new Error('The owner identity cannot be deactivated'), { statusCode: 400 });
  const result = await query('UPDATE api_principals SET active=false,token_hash=NULL,updated_at=now() WHERE id=$1 RETURNING id,name,role,active,updated_at', [id]);
  if (!result.rows.length) throw Object.assign(new Error('principal not found'), { statusCode: 404 });
  await query('INSERT INTO audit_events (actor,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,$4,$5)', [actor, 'access.principal_deactivated', 'api_principal', id, { role: result.rows[0].role }]);
  return result.rows[0];
}
