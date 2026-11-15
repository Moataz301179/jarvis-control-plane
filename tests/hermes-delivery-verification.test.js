import test from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedExternalClaims } from '../lib/hermes-delivery-verification.js';

test('restricted Hermes jobs cannot certify external email activity', () => {
  const claims = unsupportedExternalClaims('Gmail sender verification evidence collected; sent message to recipient confirmed.', ['memory', 'todo']);
  assert.ok(claims.length > 0);
});

test('external-capable jobs may report external activity for downstream evidence validation', () => {
  assert.deepEqual(unsupportedExternalClaims('Gmail sender verification evidence collected.', ['browser', 'connections']), []);
});
