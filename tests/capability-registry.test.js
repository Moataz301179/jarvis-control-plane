import test from 'node:test';
import assert from 'node:assert/strict';
import { accountVerificationMatches, assertAccountConnectionAllowed, isProhibitedFinancialExecution, normalizeAccountLoginUrl, normalizeCapabilityBatch } from '../lib/capability-registry.js';

test('capability batches are normalized and deduplicated', () => {
  const batch = normalizeCapabilityBatch({
    agent_id: 'hermes',
    source: 'test',
    capabilities: [
      { capability_key: 'browser', capability_type: 'toolset', display_name: 'Browser' },
      { capability_key: 'browser', capability_type: 'toolset', display_name: 'Browser duplicate' },
      { capability_key: 'invalid', capability_type: 'unknown' },
    ],
  });
  assert.equal(batch.capabilities.length, 1);
  assert.equal(batch.capabilities[0].capability_key, 'browser');
});

test('account login links require HTTPS and cannot contain credentials', () => {
  assert.equal(normalizeAccountLoginUrl('https://www.linkedin.com/login'), 'https://www.linkedin.com/login');
  assert.throws(() => normalizeAccountLoginUrl('http://example.com/login'));
  assert.throws(() => normalizeAccountLoginUrl('https://user:pass@example.com/login'));
});

test('financial execution and account connections are hard-blocked', () => {
  assert.equal(isProhibitedFinancialExecution('Enter my card number and pay the invoice'), true);
  assert.equal(isProhibitedFinancialExecution('Pay supplier invoice'), true);
  assert.equal(isProhibitedFinancialExecution('Transfer funds to the supplier'), true);
  assert.equal(isProhibitedFinancialExecution('Complete checkout for office supplies'), true);
  assert.equal(isProhibitedFinancialExecution('Summarize a payment integration README'), false);
  assert.equal(isProhibitedFinancialExecution('Implement the checkout integration and test it'), false);
  assert.throws(() => assertAccountConnectionAllowed('PayPal', 'https://www.paypal.com/signin'), { statusCode: 403 });
  assert.doesNotThrow(() => assertAccountConnectionAllowed('LinkedIn', 'https://www.linkedin.com/login'));
});

test('account verification fails closed without matching signed-in evidence', () => {
  const job = { title: 'Verify account connection: personal', instruction: 'Verify whether account alias personal for LinkedIn is signed in.' };
  assert.equal(accountVerificationMatches(job, 'Page Title: Example Domain\nH1: Welcome to example.com'), false);
  assert.equal(accountVerificationMatches(job, '{"signed_in":true,"page_title":"LinkedIn Feed"}'), true);
});
