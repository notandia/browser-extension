'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('one publisher scanner owns publisher classification and presentation over shared source records', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  const scanner = source('content/publisher_profile_scanner.js');
  const context = source('content/source_context.js');
  const counter = source('content/reference_counter_normalizer.js');
  const css = source('content/integrity_presentation.css');

  assert.ok(scripts.includes('content/reference_counter_normalizer.js'));
  assert.ok(scripts.includes('content/source_context.js'));
  assert.ok(scripts.includes('content/publisher_profile_scanner.js'));
  assert.equal(scripts.includes('content/content_script.js'), false);
  assert.ok(scripts.indexOf('content/reference_selectors.js') < scripts.indexOf('content/source_context.js'));
  assert.ok(scripts.indexOf('content/source_context.js') < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.ok(scripts.indexOf('content/inline_footnote_selectors.js') < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.ok(scripts.indexOf('content/reference_counter_normalizer.js') < scripts.indexOf('content/publisher_profile_scanner.js'));

  assert.match(scanner, /window\.NotandiaSourceContext/);
  assert.match(scanner, /sourceContext\.referenceNodes/);
  assert.match(scanner, /sourceContext\.searchNodes/);
  assert.match(scanner, /sourceContext\.buildRecord/);
  assert.match(scanner, /generateInlineFootnoteSelectors/);
  assert.match(scanner, /notandia-publisher-citation/);
  assert.match(scanner, /nodeTouchesRelevantContent/);
  assert.match(scanner, /MDPIFilterItemContentChecker\?\.checkItemContent/);
  assert.match(scanner, /mature-mdpi-detector/);

  assert.match(context, /c-reading-companion/);
  assert.match(context, /configuredSearchSelector/);
  assert.match(context, /getAttribute\?\.\('data-counter'\)/);
  assert.match(counter, /getAttribute\('data-content'\)/);
  assert.match(counter, /setAttribute\('data-counter'/);
  assert.match(css, /html body \.notandia-publisher-badge/);
  assert.match(css, /all: initial !important/);
});

test('publisher and integrity reports inherit the same stable bibliography/source numbers', () => {
  const context = source('content/source_context.js');
  const publisher = source('content/publisher_profile_scanner.js');
  const integrity = source('content/integrity_scanner.js');

  assert.match(context, /function referenceNumber\(element, index\)/);
  assert.match(context, /function searchResultNumber\(element, index\)/);
  assert.match(context, /number: kind === 'reference' \? referenceNumber\(element, index\) : searchResultNumber\(element, index\)/);
  assert.match(publisher, /record\.number/);
  assert.match(integrity, /number: record\.number/);
});
