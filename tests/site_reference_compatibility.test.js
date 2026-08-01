'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadCompatibility(pathname = '/wiki/Retraction_in_academic_publishing') {
  const listeners = [];
  const context = {
    window: {
      NotandiaRuntime: {
        isAvailable: () => true,
        storageGet: (_area, defaults, callback) => callback(defaults, null),
        sendMessage: () => true,
        isInvalidationError: () => false
      }
    },
    location: {
      hostname: 'en.wikipedia.org',
      pathname
    },
    document: {
      readyState: 'complete',
      documentElement: {},
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener: () => {}
    },
    chrome: {
      runtime: {
        id: 'test-extension',
        onMessage: { addListener: listener => listeners.push(listener) }
      },
      storage: {
        onChanged: { addListener: () => {} }
      }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() {}
      disconnect() {}
    },
    Element: class {},
    CSS: { escape: value => value },
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  context.window.MDPIFilterUtils = {
    generateInlineFootnoteSelectors: id => `a[href="#${id}"]`
  };
  vm.createContext(context);
  vm.runInContext(source('content/site_reference_compatibility.js'), context);
  return context;
}

test('Wikipedia compatibility decodes DOI links and preserves footnote numbers', () => {
  const context = loadCompatibility();
  const api = context.window.NotandiaSiteReferenceCompatibility;

  assert.equal(
    api.normalizeDoi('https://doi.org/10.1016%2Fj.biopsych.2005.08.011'),
    '10.1016/j.biopsych.2005.08.011'
  );
  assert.equal(
    api.normalizeDoi('doi: 10.1038%2Fnature12201.'),
    '10.1038/nature12201'
  );

  const explicit = {
    id: 'cite_note-retract_28-0',
    getAttribute(name) {
      return name === 'data-mw-footnote-number' ? '28' : null;
    }
  };
  assert.equal(api.wikipediaReferenceNumber(explicit, 90), 28);
});

test('Wikipedia and PubMed compatibility is packaged after integrity presentation', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  const styles = manifest.content_scripts[0].css;
  const compatibility = source('content/site_reference_compatibility.js');
  const css = source('content/site_reference_compatibility.css');

  assert.ok(scripts.includes('content/site_reference_compatibility.js'));
  assert.ok(styles.includes('content/site_reference_compatibility.css'));
  assert.ok(
    scripts.indexOf('content/integrity_presentation.js') <
      scripts.indexOf('content/site_reference_compatibility.js')
  );

  assert.match(compatibility, /li\[id\^="cite_note-"\]/);
  assert.match(compatibility, /data-mw-footnote-number/);
  assert.match(compatibility, /wikipedia-structured-references/);
  assert.match(compatibility, /\.mw-cite-backlink a\[href\^="#cite_ref-"\]/);
  assert.match(compatibility, /notandia-pubmed-integrity-content/);
  assert.match(css, /references-and-notes-list/);
  assert.match(css, /::marker/);
});
