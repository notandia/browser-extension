'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('test branch is blocked from store publication pending Google module acceptance', () => {
  const acceptance = source('docs/manual-acceptance/google-generated-modules.md');
  assert.match(acceptance, /outer AI Overview container is not highlighted/);
  assert.match(acceptance, /outer People Also Ask container is not highlighted/);
  assert.match(acceptance, /newly inserted source units are discovered/);
  assert.match(acceptance, /ScienceDirect PII `S0924857920300996`/);
  assert.match(acceptance, /PubMed PMID `32205204`/);
  assert.match(acceptance, /Europe PMC PMCID `PMC7102549`/);
  assert.match(acceptance, /10\.1016\/j\.ijantimicag\.2020\.105949/);
  assert.match(acceptance, /same provider-derived retracted status/);
  assert.match(acceptance, /title prefix is not itself treated as formal evidence/);
  assert.match(acceptance, /does not inflate popup context counts/);
});
