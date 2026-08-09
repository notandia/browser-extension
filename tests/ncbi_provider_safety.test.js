'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('NCBI provider uses the documented endpoint and provider-required public client identity', () => {
  const background = source('background_support.js');

  assert.match(
    background,
    /https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/tools\/idconv\/api\/v1\/articles\//
  );
  assert.match(background, /const NCBI_TOOL = 'NotandiaBrowser'/);
  assert.match(background, /const NCBI_EMAIL = 'mario\.marcolongo\.dev@gmail\.com'/);
  assert.match(background, /tool: NCBI_TOOL/);
  assert.match(background, /email: NCBI_EMAIL/);
  assert.doesNotMatch(background, /api_key\s*:/);
  assert.doesNotMatch(background, /url\.searchParams\.(?:set|append)\(['"]api_key['"]/);
});

test('NCBI provider is globally serialized, rate-spaced, cached, and circuit-broken', () => {
  const background = source('background_support.js');

  assert.match(background, /const NCBI_MAX_IDS = 50/);
  assert.match(background, /const NCBI_MIN_REQUEST_INTERVAL_MS = 1100/);
  assert.match(background, /let ncbiRequestTail = Promise\.resolve\(\)/);
  assert.match(background, /function enqueueNcbiFetch\(ids, idType\)/);
  assert.match(background, /ncbiRequestTail\.then\(async \(\) =>/);
  assert.match(background, /ncbiRequestTail = queued\.then\(\(\) => undefined, \(\) => undefined\)/);
  assert.match(background, /const NCBI_MAX_CACHE_ENTRIES = 200/);
  assert.match(background, /response\.status === 403 \|\| response\.status === 429/);
  assert.match(background, /retry-after/);
  assert.match(background, /ncbiBlockedUntil/);
  assert.match(background, /ncbiInflight/);
  assert.match(background, /providerStatus: result\.status/);
});

test('new installations do not enable NCBI lookups silently', () => {
  const background = source('background_support.js');

  assert.match(background, /details\.reason !== 'install'/);
  assert.match(background, /chrome\.storage\.sync\.set\(\{ ncbiApiEnabled: false \}/);
  assert.match(background, /chrome\.storage\.sync\.get\(\{ ncbiApiEnabled: false \}/);
});
