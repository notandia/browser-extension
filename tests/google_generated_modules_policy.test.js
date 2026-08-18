'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Google generated-module policy forbids whole-container publisher attribution', () => {
  const policy = source('docs/google_generated_modules.md');
  assert.match(policy, /outer `\[data-subtree="mfc"\]` AI Overview is never treated as a source/);
  assert.match(policy, /Neither the outer People Also Ask module nor `\.related-question-pair` is a source record/);
  assert.match(policy, /smallest concrete source unit/);
  assert.match(policy, /dynamic rescan path/);
  assert.match(policy, /li\.h7wxwc > div\.cRH23c\[data-src-id\]:has\(a\[href\]\)/);
});

test('Google generated-module policy requires shared source selection with optional scholarly enrichment', () => {
  const policy = source('docs/google_generated_modules.md');
  assert.match(policy, /Publisher context and formal-integrity checks consume the same Google source selectors/);
  assert.match(policy, /without requiring a DOI/);
  assert.match(policy, /both scanners use `NotandiaWorkIdentifiers`/);
  assert.match(policy, /data-notandia-doi/);
  assert.match(policy, /Crossref\/Retraction Watch/);
  assert.match(policy, /\/article\/pmc\/7102549/);
  assert.match(policy, /never accepted as formal-status evidence/);
});
