'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('runtime namespace policy distinguishes product rebrand from MDPI publisher terminology', () => {
  const policy = source('docs/NOTANDIA_RUNTIME_NAMESPACES.md');

  assert.match(policy, /Notandia is the current product identity/);
  assert.match(policy, /`?MDPI`? remains correct terminology when it identifies the MDPI publisher/);
  assert.match(policy, /new code must prefer the Notandia name/);
  assert.match(policy, /legacy name only as an explicit fallback or alias/);
  assert.match(policy, /previously distributed as \*\*MDPI Filter\*\*/);
  assert.match(policy, /data-notandia-doi/);
  assert.match(policy, /publisher matching and formal-integrity scanning consume the same search selectors/);
});
