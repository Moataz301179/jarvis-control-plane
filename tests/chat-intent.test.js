import test from 'node:test';
import assert from 'node:assert/strict';
import { isStudioStatusCountQuery } from '../lib/chat-intent.js';

test('automation requests are not mistaken for studio count queries', () => {
  const message = 'I want you to update my LinkedIn and be able to access external account and browse the web freely . How can you do this if you need my permission or acces let me know . And you might need to install playwright skills and scraping from GitHub repos projects';
  assert.equal(isStudioStatusCountQuery(message), false);
});

test('explicit studio status questions still use the fast database path', () => {
  assert.equal(isStudioStatusCountQuery('How many open missions and signals are there?'), true);
  assert.equal(isStudioStatusCountQuery('Give me the number of connected workers'), true);
  assert.equal(isStudioStatusCountQuery('Count the ventures'), true);
});

test('mixed action questions are not answered with status counts', () => {
  assert.equal(isStudioStatusCountQuery('How many missions can you run while I update LinkedIn?'), false);
  assert.equal(isStudioStatusCountQuery('Count the ventures and then deploy the release'), false);
});
