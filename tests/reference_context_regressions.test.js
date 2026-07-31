'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('inline selectors map synthetic scan IDs to the real bibliography target', () => {
  const mapper = source('content/inline_reference_mapper.js');

  assert.match(mapper, /p\.c-article-references__text\[id\]/);
  assert.match(mapper, /referenceElementForId\(normalizedFallback\)/);
  assert.match(mapper, /notandia-reference\|notandia-ncbi-reference\|integrity-ref\|mdpi-ref/);
  assert.match(mapper, /element\.getAttribute\?\.\('data-counter'\)/);
  assert.match(mapper, /utils\.generateInlineFootnoteSelectors = function/);
  assert.match(mapper, /baseGenerator\(targetId\)/);
  assert.match(mapper, /utils\.resolveInlineReferenceTarget = actualTargetId/);
});

test('the mapper loads before every publisher and integrity inline-style consumer', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  const mapperIndex = scripts.indexOf('content/inline_reference_mapper.js');

  assert.ok(mapperIndex > scripts.indexOf('content/inline_footnote_selectors.js'));
  assert.ok(mapperIndex < scripts.indexOf('content/inline_footnote_styler.js'));
  assert.ok(mapperIndex < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.ok(mapperIndex < scripts.indexOf('content/integrity_presentation.js'));
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