'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Notandia context is source-first rather than scholarly-only', () => {
  const policy = source('docs/SOURCE_CONTEXT_MODEL.md');
  const references = source('content/reference_selectors.js');

  assert.match(policy, /source and citation units.*not only on scholarly papers/i);
  assert.match(policy, /Wikipedia bibliography\/reference-list entry/);
  assert.match(policy, /Healthline trusted-source element/);
  assert.match(policy, /Scholarly work identity is an \*\*optional enrichment layer\*\*/);
  assert.match(policy, /source with no resolvable DOI can still receive publisher\/source context/);

  assert.match(references, /window\.NotandiaReferenceSelectors/);
  assert.match(references, /li\[id\^="cite_note-"\]/);
  assert.match(references, /hl-trusted-source:has\(a\[href\]\)/);
  assert.match(references, /li\.css-1ti7iub:has\(cite a\[href\]\)/);
  assert.match(references, /window\.MDPIFilterReferenceSelectors = window\.NotandiaReferenceSelectors/);
});

test('publisher and integrity scanners share one source-selector and work-identity owner', () => {
  const context = source('content/source_context.js');
  const publisher = source('content/publisher_profile_scanner.js');
  const integrity = source('content/integrity_scanner.js');

  assert.match(context, /window\.NotandiaReferenceSelectors \|\| window\.MDPIFilterReferenceSelectors/);
  assert.match(context, /window\.NotandiaDomainUtils \|\| window\.MDPIFilterDomainUtils/);
  assert.match(context, /window\.NotandiaWorkIdentifiers/);
  assert.match(context, /function configuredSearchSelector/);
  assert.match(context, /function evidenceFromElement/);

  for (const scanner of [publisher, integrity]) {
    assert.match(scanner, /window\.NotandiaSourceContext/);
    assert.match(scanner, /sourceContext\.referenceNodes/);
    assert.match(scanner, /sourceContext\.searchNodes/);
    assert.match(scanner, /sourceContext\.buildRecord/);
  }
});

test('Google composite answers expose only concrete source units', () => {
  const domains = source('content/domains.js');
  const policy = source('docs/SOURCE_CONTEXT_MODEL.md');

  assert.match(domains, /related-question-pair span\.WBgIic:has\(a\[href\]\)/);
  assert.match(domains, /related-question-pair li\.h7wxwc > div\.cRH23c\[data-src-id\]:has\(a\[href\]\)/);
  assert.match(domains, /\[data-subtree="mfc"\] span\.WBgIic:has\(a\[href\]\)/);
  assert.match(domains, /\[data-subtree="mfc"\] li\.h7wxwc > div\.cRH23c\[data-src-id\]:has\(a\[href\]\)/);
  assert.match(policy, /must never inherit publisher styling/);
});
