import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://127.0.0.1:1/jarvis_test_offline';
process.env.JARVIS_OWNER_TOKEN ||= 'test-owner-token';
process.env.JARVIS_WORKER_ID ||= 'test-worker';
process.env.JARVIS_WORKER_SECRET ||= 'test-worker-secret';

const { pickKeyForDay, nextUtcMidnight, utcDay } = await import('../lib/provider-keys.js');

const keys = [
  { id: 'a', status: 'active', cooldown_until: null, created_at: '2026-01-01' },
  { id: 'b', status: 'active', cooldown_until: null, created_at: '2026-01-02' },
  { id: 'c', status: 'active', cooldown_until: null, created_at: '2026-01-03' },
];

test('same day keeps the current key', () => {
  assert.equal(pickKeyForDay(keys, 'b', { advance: false }).id, 'b');
});

test('a new day advances to the next key and wraps', () => {
  assert.equal(pickKeyForDay(keys, 'b', { advance: true }).id, 'c');
  assert.equal(pickKeyForDay(keys, 'c', { advance: true }).id, 'a');
});

test('cooldown keys are skipped', () => {
  const cooling = [
    keys[0],
    { ...keys[1], status: 'cooldown', cooldown_until: new Date(Date.now() + 3600_000).toISOString() },
    keys[2],
  ];
  assert.equal(pickKeyForDay(cooling, 'a', { advance: true }).id, 'c');
});

test('expired cooldown becomes usable again', () => {
  const expired = [
    keys[0],
    { ...keys[1], status: 'cooldown', cooldown_until: new Date(Date.now() - 1000).toISOString() },
    keys[2],
  ];
  assert.equal(pickKeyForDay(expired, 'a', { advance: true }).id, 'b');
});

test('returns null when every key is unusable', () => {
  const cooling = keys.map((key) => ({ ...key, status: 'cooldown', cooldown_until: new Date(Date.now() + 3600_000).toISOString() }));
  assert.equal(pickKeyForDay(cooling, 'a', { advance: true }), null);
});

test('next UTC midnight is the following day', () => {
  const now = Date.UTC(2026, 0, 31, 23, 30);
  assert.equal(nextUtcMidnight(now).toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(utcDay(now), '2026-01-31');
});
