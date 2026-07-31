'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function fakeReference({ syntheticId, targetId = null, counter = null }) {
  return {
    id: '',
    querySelector(selector) {
      if (selector === 'p.c-article-references__text[id]' && targetId) return { id: targetId };
      return null;
    },
    getAttribute(name) {
      if (name === 'data-mdpi-filter-ref-id') return syntheticId;
      if (name === 'data-counter') return counter;
      return null;
    }
  };
}

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

test('Nature citations remain attached to their exact bibliography numbers', () => {
  const references = [
    fakeReference({ syntheticId: 'notandia-reference-38', targetId: 'ref-CR34', counter: '34.' }),
    fakeReference({ syntheticId: 'notandia-reference-42', targetId: 'ref-CR38', counter: '38.' }),
    fakeReference({ syntheticId: 'notandia-reference-95', targetId: 'ref-CR91', counter: '91.' }),
    fakeReference({ syntheticId: 'notandia-reference-25', counter: '25.' })
  ];
  const context = {
    window: {
      MDPIFilterUtils: {
        generateInlineFootnoteSelectors(referenceId) {
          return `selectors:${referenceId}`;
        }
      }
    },
    document: {
      querySelectorAll(selector) {
        return selector === '[data-mdpi-filter-ref-id]' ? references : [];
      },
      getElementById() {
        return null;
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(source('content/inline_reference_mapper.js'), context);

  const generate = context.window.MDPIFilterUtils.generateInlineFootnoteSelectors;
  assert.equal(generate('notandia-reference-38'), 'selectors:ref-CR34');
  assert.equal(generate('notandia-reference-42'), 'selectors:ref-CR38');
  assert.equal(generate('notandia-reference-95'), 'selectors:ref-CR91');
  assert.equal(generate('notandia-reference-25'), 'selectors:25');
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