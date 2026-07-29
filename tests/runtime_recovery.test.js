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

test('Nature reference identifiers generate inline citation selectors', () => {
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

test('integrity presentation uses shared citation selectors and recovers missing reports', () => {
  const presentation = source('content/integrity_presentation.js');
  assert.match(presentation, /generateInlineFootnoteSelectors/);
  assert.match(presentation, /notandia-integrity-citation/);
  assert.match(presentation, /notandia-integrity-reference/);
  assert.match(presentation, /integrityPresentationNeedsRescan/);
  assert.match(presentation, /MutationObserver/);

  const css = source('content/integrity_presentation.css');
  assert.match(css, /\.notandia-integrity-reference\[data-notandia-integrity-status\]/);
  assert.match(css, /\.notandia-integrity-citation/);
  assert.match(css, /\.notandia-integrity-chip/);
});

test('popup refreshes completed integrity scans instead of leaving zero counts', () => {
  const popupLive = source('popup_live.js');
  assert.match(popupLive, /integrityReportUpdated/);
  assert.match(popupLive, /window\.location\.reload/);
  assert.match(popupLive, /Restoring integrity results/);
  assert.match(popupLive, /textContent = '…'/);
  assert.match(source('popup.html'), /<script src="popup_live\.js"><\/script>/);
});

test('integrity scanner keeps publisher reference IDs and visible reference numbers', () => {
  const scanner = source('content/integrity_scanner.js');
  assert.match(scanner, /getAttribute\?\.\('data-counter'\)/);
  assert.match(scanner, /referenceNumber\(element, index\)/);
  assert.match(scanner, /references\.map\(reference => \[reference\.id, reference\.doi\]\)/);
  assert.match(scanner, /sendResponse\(\{ scheduled: true \}\)/);
});

test('NCBI conversion is proxied through the extension background', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf('content/ncbi_fetch_proxy.js') < scripts.indexOf('content/ncbi_api_handler.js'));
  assert.ok(scripts.indexOf('content/integrity_scanner.js') < scripts.indexOf('content/integrity_presentation.js'));
  assert.ok(manifest.content_scripts[0].css.includes('content/integrity_presentation.css'));

  const proxy = source('content/ncbi_fetch_proxy.js');
  assert.match(proxy, /ncbiIdConversion/);
  assert.match(proxy, /ENDPOINT_PATH = '\/pmc\/utils\/idconv\/v1\.0\/'/);

  const background = source('publisher_background.js');
  assert.match(background, /message\.type === 'ncbiIdConversion'/);
  assert.match(background, /credentials: 'omit'/);
  assert.match(background, /referrerPolicy: 'no-referrer'/);
  assert.match(background, /integrityPresentationNeedsRescan/);
});
