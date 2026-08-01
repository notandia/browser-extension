'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('structured ancestor IDs map synthetic references to data-xml-rid citations', () => {
  const citationContainer = { id: 'r14' };
  const reference = {
    id: '',
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
    window: {},
    document: {
      querySelectorAll(selector) {
        if (selector === '[data-mdpi-filter-ref-id]') return [reference];
        return [];
      },
      getElementById() {
        return null;
      }
    },
    console
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(source('content/inline_footnote_selectors.js'), context);
  vm.runInContext(source('content/inline_reference_mapper.js'), context);

  const utils = context.window.MDPIFilterUtils;
  assert.equal(utils.resolveInlineReferenceTarget('notandia-reference-14'), 'r14');
  const selectors = utils.generateInlineFootnoteSelectors('notandia-reference-14');
  assert.match(selectors, /a\[data-xml-rid="r14"\]/);
  assert.match(selectors, /href="#core-collateral-r14"/);
  assert.match(selectors, /id\^="core-r14-"/);
});

test('shared mapper keeps structured ancestor recovery available beyond one hostname', () => {
  const mapper = source('content/inline_reference_mapper.js');
  const selectors = source('content/inline_footnote_selectors.js');

  assert.match(mapper, /element\.closest\?\.\('\.citations\[id\]'\)\?\.id/);
  assert.match(mapper, /\[role="listitem"\]/);
  assert.match(selectors, /data-xml-rid/);
  assert.match(selectors, /core-collateral-/);
  assert.doesNotMatch(source('manifest.json'), /pnas_reference_compatibility/);
});

test('collapsed bibliography items are revealed before replaying the scroll animation', () => {
  const handler = source('content/secure_message_handler.js');

  assert.match(handler, /reference\.closest\('\[hidden\],\[aria-hidden="true"\]'\)/);
  assert.match(handler, /button\[aria-controls\]/);
  assert.match(handler, /controlTargetsId/);
  assert.match(handler, /control\.click\(\)/);
  assert.match(handler, /details:not\(\[open\]\)/);
  assert.match(handler, /waitForVisibleReference/);
  assert.match(handler, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.match(handler, /notandia-scroll-target/);
  assert.match(handler, /return true;/);
});
