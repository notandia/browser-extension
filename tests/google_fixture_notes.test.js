'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const text = fs.readFileSync(path.resolve(__dirname, '..', 'docs/google-special-modules-fixture-notes.md'), 'utf8');

test('Google selectors are documented as observed compatibility structures', () => {
  assert.match(text, /compatibility observations, not guaranteed Google APIs/);
  assert.match(text, /manual acceptance remains required/);
});
