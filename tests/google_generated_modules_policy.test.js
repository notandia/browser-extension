'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Google generated-module policy forbids whole-container publisher attribution', () => {
  const policy = source('docs/google_generated_modules.md');
  assert.match(policy, /outer `\[data-subtree="mfc"\]` AI Overview is never treated as a publication/);
  assert.match(policy, /Individual `\.related-question-pair` units are evaluated independently/);
  assert.match(policy, /smallest source-level unit/);
  assert.match(policy, /dynamic rescan path/);
});

test('Google generated-module policy requires one shared scholarly identity for publisher and integrity context', () => {
  const policy = source('docs/google_generated_modules.md');
  assert.match(policy, /Publisher context and formal-integrity checks use the same search-result selectors/);
  assert.match(policy, /data-notandia-doi/);
  assert.match(policy, /Crossref\/Retraction Watch/);
  assert.match(policy, /never accepted as formal-status evidence/);
  assert.match(policy, /publisher, PubMed, and Europe PMC URLs converge on the same formal status/);
});
