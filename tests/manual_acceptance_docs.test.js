'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const text = fs.readFileSync(path.resolve(__dirname, '..', 'docs/manual-google-module-test.md'), 'utf8');

test('manual acceptance covers generated and expandable Google modules', () => {
  assert.match(text, /outer AI Overview is not/i);
  assert.match(text, /Expand \*\*Show more\*\*/);
  assert.match(text, /outer People Also Ask block is not styled/i);
  assert.match(text, /ordinary organic Google results/i);
});
