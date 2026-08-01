'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PNAS synthetic reference IDs map back to structured bibliography and inline citation IDs', () => {
  const listeners = [];
  const citationContainer = { id: 'r14' };
  const reference = {
    getAttribute(name) {
      return name === 'data-mdpi-filter-ref-id' ? 'notandia-reference-14' : null;
    },
    closest(selector) {
      if (selector === '.citations[id]') return citationContainer;
      return null;
    },
    querySelector() {
      return null;
    }
  };
  const context = {
    window: {
      MDPIFilterUtils: {
        generateInlineFootnoteSelectors(referenceId) {
          return `base:${referenceId}`;
        },
        resolveInlineReferenceTarget(referenceId) {
          return `fallback:${referenceId}`;
        }
      }
    },
    location: { hostname: 'www.pnas.org', pathname: '/doi/full/10.1073/pnas.1212247109' },
    document: {
      querySelectorAll(selector) {
        if (selector === '[data-mdpi-filter-ref-id]') return [reference];
        return [];
      },
      getElementById() {
        return null;
      }
    },
    chrome: {
      runtime: {
        id: 'extension-id',
        onMessage: { addListener(listener) { listeners.push(listener); } }
      }
    },
    HTMLElement: class HTMLElement {},
    HTMLDetailsElement: class HTMLDetailsElement {},
    getComputedStyle() {
      return { display: 'block', visibility: 'visible' };
    },
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout,
    clearTimeout,
    console
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(source('content/pnas_reference_compatibility.js'), context);

  const utils = context.window.MDPIFilterUtils;
  assert.equal(utils.resolveInlineReferenceTarget('notandia-reference-14'), 'r14');
  const selectors = utils.generateInlineFootnoteSelectors('notandia-reference-14');
  assert.match(selectors, /base:r14/);
  assert.match(selectors, /a\[data-xml-rid="r14"\]/);
  assert.match(selectors, /href="#core-collateral-r14"/);
  assert.match(selectors, /id\^="core-r14-"/);
  assert.equal(listeners.length, 1);
});

test('PNAS compatibility reveals hidden bibliography items before replaying the scroll animation', () => {
  const compatibility = source('content/pnas_reference_compatibility.js');

  assert.match(compatibility, /reference\.closest\('\[hidden\]'\)/);
  assert.match(compatibility, /button\[aria-controls\]/);
  assert.match(compatibility, /control\.click\(\)/);
  assert.match(compatibility, /waitForVisibleReference/);
  assert.match(compatibility, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.match(compatibility, /notandia-scroll-target/);
});

test('PNAS compatibility loads after the shared integrity presentation', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  const compatibilityIndex = scripts.indexOf('content/pnas_reference_compatibility.js');

  assert.ok(compatibilityIndex > scripts.indexOf('content/inline_reference_mapper.js'));
  assert.ok(compatibilityIndex > scripts.indexOf('content/integrity_presentation.js'));
  assert.ok(compatibilityIndex > scripts.indexOf('content/site_reference_compatibility.js'));
});
