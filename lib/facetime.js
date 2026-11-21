export function normalizeFaceTimeTarget(value) {
  const raw = String(value || '').trim();
  if (!raw) throw Object.assign(new Error('A FaceTime target is required'), { statusCode: 400 });
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) {
    return { target: raw, type: 'email' };
  }
  const digits = raw.replace(/[^\d+]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(digits)) {
    throw Object.assign(new Error('Use an Apple ID email or an international phone number such as +201234567890'), { statusCode: 400 });
  }
  return { target: digits, type: 'phone' };
}

export function faceTimeUrl(target, kind = 'video') {
  const scheme = kind === 'audio' ? 'facetime-audio' : 'facetime';
  return `${scheme}://${target}`;
}

export function maskFaceTimeTarget(target) {
  const value = String(target || '');
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  }
  return value.length > 4 ? `${value.slice(0, 3)}${'•'.repeat(Math.max(1, value.length - 6))}${value.slice(-3)}` : value;
}
