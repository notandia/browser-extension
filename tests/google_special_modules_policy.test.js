'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const policy = fs.readFileSync(path.resolve(__dirname, '..', 'docs/GOOGLE_SPECIAL_MODULES.md'), 'utf8');

test('Google generated-module policy forbids whole-container publisher attribution', () => {
  assert.match(policy, /whole AI-generated answer must never inherit a publisher match/i);
  assert.match(policy, /visible source cards and inline source links independently/i);
  assert.match(policy, /whole People Also Ask \/ FAQ block must never inherit a publisher match/i);
  assert.match(policy, /Each `\.related-question-pair` is evaluated independently/);
});
