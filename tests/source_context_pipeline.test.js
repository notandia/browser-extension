'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('search results without a position attribute retain sequential numbering', () => {
  class SourceElement {
    constructor(attributes = {}) {
      this.attributes = { ...attributes };
      this.dataset = {};
      this.textContent = 'An ordinary scholarly search result';
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    setAttribute(name, value) { this.attributes[name] = value; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    cloneNode() { return this; }
  }
  const context = { Element: SourceElement, URL };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source('shared/work_identifiers.js'), context);
  vm.runInContext(source('content/source_context.js'), context);
  const record = (attributes, index) => context.NotandiaSourceContext.buildRecord(
    new SourceElement(attributes), index, 'search-result'
  );
  assert.deepEqual([0, 1, 2].map(index => record({}, index).number), [1, 2, 3]);
  assert.equal(record({ 'data-rp': '0' }, 5).number, 1);
  assert.equal(record({ 'data-rp': '9' }, 5).number, 10);
  for (const invalid of ['', ' ', '-1', '1.5', 'no-position']) {
    assert.equal(record({ 'data-rp': invalid }, 5).number, 6);
  }
  assert.equal(record({ 'data-rpos': '4', 'data-rp': '9' }, 5).number, 4);
});

test('publisher and integrity consumers use one source-record pipeline', () => {
  const context = source('content/source_context.js');
  const publisher = source('content/publisher_profile_scanner.js');
  const integrity = source('content/integrity_scanner.js');

  assert.match(context, /configuredSearchSelector/);
  assert.match(context, /configuredReferenceSelector/);
  assert.match(context, /NotandiaWorkIdentifiers/);
  assert.match(context, /resolveRecordsWithNcbi/);

  for (const consumer of [publisher, integrity]) {
    assert.match(consumer, /window\.NotandiaSourceContext/);
    assert.match(consumer, /sourceContext\.collectRecords/);
    assert.match(consumer, /sourceContext\.resolveRecordsWithNcbi/);
  }
});

test('formal integrity scans search results as well as bibliography references', () => {
  const domains = source('content/domains.js');
  const integrity = source('content/integrity_scanner.js');
  const context = source('content/source_context.js');

  assert.match(domains, /scholar:\s*\{/);
  assert.match(domains, /itemSelector:\s*'div\.gs_r'/);
  assert.match(context, /maxSearchResults = 150/);
  assert.match(context, /searchResults = searchNodes\(maxSearchResults\)/);
  assert.match(integrity, /maxSearchResults:\s*150/);
  assert.match(integrity, /kind:\s*record\.kind/);
  assert.match(integrity, /Search-result records now use the same formal-integrity pipeline/);
});

test('source context preserves legacy IDs and recognizes NCBI-style Scholar evidence', () => {
  const context = source('content/source_context.js');
  const handler = source('content/ncbi_api_handler.js');

  assert.match(context, /data-notandia-ref-id/);
  assert.match(context, /data-mdpi-filter-ref-id/);
  assert.match(context, /europepmc\.org/);
  assert.match(context, /PMCID: PMC/);
  assert.match(handler, /resolveNcbiIdsToDois/);
  assert.match(handler, /window\.MDPIFilterNcbiApiHandler = handler/);
});
