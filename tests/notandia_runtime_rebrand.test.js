'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const REBRANDED_RUNTIME_FILES = [
  'content/domains.js',
  'content/ncbi_api_handler.js',
  'content/source_context.js',
  'content/publisher_profile_scanner.js',
  'popup.html',
  'popup.js',
  'popup_overview.js',
  'popup_progress.js',
  'popup_recovery.js',
  'popup_reference_counts.js',
  'popup_settings_mode.js'
];

test('current runtime and popup code do not expose the previous product name', () => {
  for (const file of REBRANDED_RUNTIME_FILES) {
    assert.doesNotMatch(source(file), /MDPI Filter/i, `${file} still exposes the previous product name`);
  }
});

test('new general-purpose provider and domain APIs use the Notandia namespace', () => {
  const domains = source('content/domains.js');
  const ncbi = source('content/ncbi_api_handler.js');
  const context = source('content/source_context.js');
  const scanner = source('content/publisher_profile_scanner.js');

  assert.match(domains, /window\.NotandiaDomains = notandiaDomains/);
  assert.match(domains, /window\.NotandiaDomainUtils/);
  assert.match(ncbi, /window\.NotandiaNcbiApiHandler = handler/);
  assert.match(scanner, /window\.NotandiaNcbiApiHandler \|\| window\.MDPIFilterNcbiApiHandler/);
  assert.match(context, /window\.NotandiaDomainUtils \|\| window\.MDPIFilterDomainUtils/);
  assert.match(context, /window\.NotandiaDomains \|\| window\.MDPIFilterDomains/);
  assert.match(scanner, /window\.NotandiaSourceContext/);
});

test('new DOM records get a Notandia ID while retaining the released compatibility attribute', () => {
  const context = source('content/source_context.js');

  assert.match(context, /const REFERENCE_ID_ATTRIBUTE = 'data-notandia-ref-id'/);
  assert.match(context, /const LEGACY_REFERENCE_ID_ATTRIBUTE = 'data-mdpi-filter-ref-id'/);
  assert.match(context, /element\.setAttribute\(REFERENCE_ID_ATTRIBUTE, id\)/);
  assert.match(context, /element\.setAttribute\(LEGACY_REFERENCE_ID_ATTRIBUTE, id\)/);
});
