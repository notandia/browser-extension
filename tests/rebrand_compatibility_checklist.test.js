'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const text = fs.readFileSync(path.resolve(__dirname, '..', 'docs/rebrand-compatibility-checklist.md'), 'utf8');

test('rebrand checklist retains the explicit legacy-removal gate', () => {
  assert.match(text, /Remove each legacy runtime alias only after every packaged consumer has migrated/);
});
