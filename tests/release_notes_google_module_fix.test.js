'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const text = fs.readFileSync(path.resolve(__dirname, '..', 'docs/release-notes-google-module-fix.md'), 'utf8');

test('release note describes source-level Google module behavior', () => {
  assert.match(text, /AI Overview sources and People Also Ask questions are evaluated as individual context units/);
  assert.match(text, /Notandia namespace/);
});
