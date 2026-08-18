'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('one shared source context owns source selection and record construction', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  const context = source('content/source_context.js');
  const scanner = source('content/publisher_profile_scanner.js');
  const counter = source('content/reference_counter_normalizer.js');
  const css = source('content/integrity_presentation.css');

  assert.ok(scripts.includes('content/source_context.js'));
  assert.ok(scripts.includes('content/reference_counter_normalizer.js'));
  assert.ok(scripts.includes('content/publisher_profile_scanner.js'));
  assert.equal(scripts.includes('content/content_script.js'), false);
  assert.ok(scripts.indexOf('content/ncbi_api_handler.js') < scripts.indexOf('content/source_context.js'));
  assert.ok(scripts.indexOf('content/source_context.js') < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.ok(scripts.indexOf('content/source_context.js') < scripts.indexOf('content/integrity_scanner.js'));

  assert.match(context, /function referenceNumber\(/);
  assert.match(context, /getAttribute\?\.\('data-counter'\)/);
  assert.match(context, /c-reading-companion/);
  assert.match(context, /function searchNodes\(/);
  assert.match(context, /function collectRecords\(/);
  assert.match(scanner, /sourceContext\.collectRecords/);
  assert.match(scanner, /sourceContext\.nodeTouchesSourceContext/);
  assert.match(scanner, /generateInlineFootnoteSelectors/);
  assert.match(scanner, /notandia-publisher-citation/);
  assert.match(counter, /getAttribute\('data-content'\)/);
  assert.match(counter, /setAttribute\('data-counter'/);
  assert.match(css, /html body \.notandia-publisher-badge/);
  assert.match(css, /all: initial !important/);
});

test('publisher reports preserve source-context numbering', () => {
  const context = source('content/source_context.js');
  const scanner = source('content/publisher_profile_scanner.js');
  assert.match(context, /number: kind === 'reference' \? referenceNumber\(element, index\) : searchResultNumber\(element, index\)/);
  assert.match(scanner, /number: record\.number/);
});
