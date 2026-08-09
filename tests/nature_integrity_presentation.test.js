'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('Nature reference IDs generate selectors for citation anchors', () => {
  const context = {
    window: {
      MDPIFilterReferenceIdExtractor: {
        normalizeReferenceId(value) {
          return /^[A-Za-z0-9_.:-]{1,256}$/.test(String(value || '')) ? String(value) : null;
        }
      }
    },
    document: {
      getElementById: () => null,
      querySelectorAll: () => []
    }
  };
  vm.createContext(context);
  vm.runInContext(source('content/inline_footnote_selectors.js'), context);

  const selectors = context.window.MDPIFilterUtils.generateInlineFootnoteSelectors('ref-CR144');
  assert.match(selectors, /a\[href\$="#ref-CR144"\]/);
  assert.match(selectors, /a\[data-test="citation-ref"\]\[href\$="#ref-CR144"\]/);
});

test('formal integrity presentation reuses the established inline selector generator', () => {
  const presentation = source('content/integrity_presentation.js');
  assert.match(presentation, /generateInlineFootnoteSelectors/);
  assert.match(presentation, /const selectors = generator\(record\.id\)/);
  assert.match(presentation, /anchor\.classList\.add\('notandia-integrity-citation'\)/);
  assert.match(presentation, /element\.classList\.add\('notandia-integrity-reference'\)/);
  assert.match(presentation, /contextElements\(record\)/);
  assert.match(presentation, /chip\.textContent = `\$\{definition\.icon/);
});
