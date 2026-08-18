'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadDomains() {
  const window = { location: { search: '' } };
  const context = { window };
  vm.createContext(context);
  vm.runInContext(source('content/domains.js'), context);
  return window;
}

test('Google special modules are decomposed into concrete source units', () => {
  const window = loadDomains();
  const selector = window.NotandiaDomains.googleWeb.itemSelector;

  // Ordinary result containers explicitly exclude composite special modules.
  assert.match(selector, /div\.MjjYud:not\(:has\(div#iur\)\):not\(:has\(\.related-question-pair\)\):not\(:has\(\[data-subtree="mfc"\]\)\)/);

  // People Also Ask / FAQ containers and questions are never source records.
  assert.equal(selector.split(',').map(value => value.trim()).includes('div.MjjYud .related-question-pair'), false);
  assert.ok(selector.includes('div.MjjYud .related-question-pair span.WBgIic:has(a[href])'));
  assert.ok(selector.includes('div.MjjYud .related-question-pair li.h7wxwc > div.cRH23c[data-src-id]:has(a[href])'));

  // AI Overview is also source-level. The supplied live DOM uses WBgIic citation
  // wrappers plus cRH23c source cards nested in h7wxwc list items.
  assert.ok(selector.includes('[data-subtree="mfc"] span.WBgIic:has(a[href])'));
  assert.ok(selector.includes('[data-subtree="mfc"] li.h7wxwc > div.cRH23c[data-src-id]:has(a[href])'));

  // Never use the whole AI Overview container as a search-result item.
  assert.equal(selector.split(',').map(value => value.trim()).includes('[data-subtree="mfc"]'), false);

  // Old selectors that missed the observed source-card DOM stay out of the policy.
  assert.equal(selector.includes('[data-subtree="mfc"] [role="listitem"]:has(a[href])'), false);
});

test('Google special-module selectors remain scoped to Google Web search', () => {
  const window = loadDomains();
  const config = window.NotandiaDomainUtils.getActiveSearchConfig(
    'www.google.com',
    '/search',
    window.NotandiaDomains
  );

  assert.equal(config, window.NotandiaDomains.googleWeb);
  assert.equal(config.googleSpecialModules, true);
});

test('Notandia is the canonical domain runtime while released aliases remain compatible', () => {
  const window = loadDomains();

  assert.ok(window.NotandiaDomains);
  assert.ok(window.NotandiaDomainUtils);
  assert.equal(window.MDPIFilterDomains, window.NotandiaDomains);
  assert.equal(window.MDPIFilterDomainUtils, window.NotandiaDomainUtils);
});
