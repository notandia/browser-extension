'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const text = fs.readFileSync(path.resolve(__dirname, '..', 'docs/branch-status.md'), 'utf8');

test('test branch is blocked from store publication pending Google module acceptance', () => {
  assert.match(text, /Do not publish it to a browser store/);
  assert.match(text, /AI Overview \/ People Also Ask/);
});
