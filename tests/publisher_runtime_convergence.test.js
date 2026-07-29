'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('one publisher scanner owns article detection and presentation', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  const scanner = source('content/publisher_profile_scanner.js');

  assert.ok(scripts.includes('content/publisher_profile_scanner.js'));
  assert.equal(scripts.includes('content/content_script.js'), false);
  assert.ok(scripts.indexOf('content/inline_footnote_selectors.js') < scripts.indexOf('content/publisher_profile_scanner.js'));

  assert.match(scanner, /function referenceNumber\(/);
  assert.match(scanner, /getAttribute\?\.\('data-counter'\)/);
  assert.match(scanner, /generateInlineFootnoteSelectors/);
  assert.match(scanner, /notandia-publisher-citation/);
  assert.match(scanner, /c-reading-companion/);
  assert.match(scanner, /nodeTouchesReferences/);
});

test('publisher reports preserve stable bibliography numbers', () => {
  const scanner = source('content/publisher_profile_scanner.js');
  assert.match(scanner, /number: kind === 'reference' \? referenceNumber\(element, index\) : index \+ 1/);
  assert.match(scanner, /record\.number/);
});

test('publisher styling snapshots host-page styles before modification', () => {
  const scanner = source('content/publisher_profile_scanner.js');
  assert.match(scanner, /function rememberOriginalStyles\(/);
  assert.match(scanner, /if \(!hasManagedState\) return;/);
  assert.match(scanner, /rememberOriginalStyles\(element\);/);
});
