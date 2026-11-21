import crypto from 'node:crypto';
import { config } from './config.js';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function bearerToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

export function requireOwner(req) {
  return safeEqual(bearerToken(req), config.ownerToken);
}

export function requireWorker(req) {
  return safeEqual(bearerToken(req), config.workerSecret);
}

export function requireMacBridge(req) {
  return Boolean(config.macBridgeToken) && safeEqual(bearerToken(req), config.macBridgeToken);
}

export function requireHermesBridge(req) {
  return Boolean(config.hermesBridgeToken) && safeEqual(bearerToken(req), config.hermesBridgeToken);
}

export function requireHermesCloudBridge(req) {
  return Boolean(config.hermesCloudBridgeToken) && safeEqual(bearerToken(req), config.hermesCloudBridgeToken);
}

export function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return [part.trim(), ''];
    const key = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    try { return [key, decodeURIComponent(raw)]; }
    catch { return [key, raw]; }
  }).filter(([key]) => key));
}

function sessionSignature(expires) {
  return crypto.createHmac('sha256', config.ownerToken).update(`jarvis-session:${expires}`).digest('hex');
}

export function issueSession(ttlMs = 12 * 60 * 60 * 1000) {
  const expires = Date.now() + ttlMs;
  return `${expires}.${sessionSignature(expires)}`;
}

export function requireSession(req) {
  if (requireOwner(req)) return true;
  const value = parseCookies(req).jarvis_session || '';
  const [rawExpires, signature] = value.split('.');
  const expires = Number(rawExpires);
  if (!Number.isFinite(expires) || expires < Date.now() || !signature) return false;
  return safeEqual(signature, sessionSignature(expires));
}
