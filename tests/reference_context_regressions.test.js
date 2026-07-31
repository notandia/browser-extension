'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('inline context reconciliation uses the bibliography target rather than synthetic scan order', () => {
  const reconciler = source('content/inline_context_reconciler.js');

  assert.match(reconciler, /p\.c-article-references__text\[id\]/);
  assert.match(reconciler, /const targetId = referenceTargetId\(reference\)/);
  assert.match(reconciler, /const selectors = generator\(targetId\)/);
  assert.match(reconciler, /notandia-reference\|integrity-ref\|mdpi-ref/);
  assert.match(reconciler, /clearInlinePresentation\(\)/);
  assert.match(reconciler, /applyPublisherCitation\(reference, profiles\)/);
  assert.match(reconciler, /applyIntegrityCitation\(reference\)/);
  assert.match(reconciler, /--notandia-profile-color/);
  assert.match(reconciler, /--notandia-integrity-color/);
});

test('PubMed and PMC bridge resolves public identifiers before publisher and integrity reporting', () => {
  const bridge = source('content/ncbi_context_bridge.js');

  assert.match(bridge, /pubmed\.ncbi\.nlm\.nih\.gov/);
  assert.match(bridge, /pmc\.ncbi\.nlm\.nih\.gov/);
  assert.match(bridge, /type: 'ncbiIdConversion'/);
  assert.match(bridge, /stored\.ncbiApiEnabled === false/);
  assert.match(bridge, /resolvedDoi\(pageIds, maps\) \|\| directPageDoi\(\)/);
  assert.match(bridge, /type: 'publisherContextUpdate'/);
  assert.match(bridge, /type: 'integrityScan'/);
  assert.match(bridge, /stored\.integrityLookupsEnabled === true/);
  assert.match(bridge, /MAX_IDS_PER_TYPE = 200/);
  assert.match(bridge, /MAX_REFERENCES = 250/);
});

test('NCBI-resolved publisher context uses the configured profile color and action', () => {
  const bridge = source('content/ncbi_context_bridge.js');

  assert.match(bridge, /api\.matchProfiles\(settings, evidenceFromElement\(entry\.element, doi\)\)/);
  assert.match(bridge, /api\.resolveVisualMatch\(matches\)/);
  assert.match(bridge, /data-notandia-profile-style/);
  assert.match(bridge, /visual\.color/);
  assert.match(bridge, /visual\.action === 'highlight'/);
});