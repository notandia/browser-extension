'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('popup presents one integrated clickable context overview', () => {
  const html = source('popup.html');
  const popup = source('popup.js');
  const overview = source('popup_overview.js');
  const css = source('popup.css');

  assert.match(html, /id="contextOverviewSummary"/);
  assert.match(html, /id="contextScanState"/);
  assert.match(html, /id="publisherStatusGrid"/);
  assert.match(html, /data-context-filter="status:retracted"/);
  assert.match(html, /data-context-filter="status:corrected"/);
  assert.match(html, /<script src="popup_overview\.js"><\/script>/);
  assert.match(html, /<details class="report-section">/);

  assert.match(overview, /settings\.profiles \|\| \[\]/);
  assert.match(overview, /`profile:\$\{profile\.id\}`/);
  assert.match(overview, /publisher-signal-card/);
  assert.match(overview, /el\.filter\.dispatchEvent\(new Event\('change'/);
  assert.match(overview, /getContextScanState/);
  assert.match(overview, /Scanning publisher profiles and citation links/);
  assert.match(overview, /checking formal updates/);

  assert.match(popup, /filter\.startsWith\('profile:'\)/);
  assert.match(css, /\.signal-card\.is-active/);
  assert.match(css, /\.publisher-signal-grid/);
  assert.match(css, /\.scan-spinner/);
});

test('popup prioritizes reference context and hides diagnostic clutter', () => {
  const html = source('popup.html');
  const popup = source('popup.js');
  const overview = source('popup_overview.js');
  const css = source('popup.css');

  assert.match(html, /id="articleContextSection"[^>]*hidden/);
  assert.match(html, /class="filter-toolbar"/);
  assert.match(html, /id="countAllContext"/);
  assert.match(html, /<details class="coverage-details">/);
  assert.match(html, /Formal updates are checked through Crossref and Retraction Watch/);
  assert.doesNotMatch(html, /Configured profiles/);
  assert.doesNotMatch(html, /Select a card to filter/);

  assert.match(overview, /profile\.enabled && \(counts\.get\(profile\.id\) \|\| 0\) > 0/);
  assert.match(overview, /reference\$\{counts\.total === 1 \? '' : 's'\} with context/);
  assert.match(overview, /work\$\{counts\.formal === 1 \? '' : 's'\} with formal updates/);

  assert.match(popup, /function cleanReferenceText\(/);
  assert.match(popup, /PubMed Central/);
  assert.match(popup, /chips\.appendChild\(chip\(match\.profileName, match\.color\)\)/);
  assert.doesNotMatch(popup, /match\.profileName\} · \$\{match\.action/);
  assert.match(popup, /el\.articleSection\.hidden = true/);
  assert.match(popup, /not verified/);

  assert.match(css, /\.signal-card\s*\{[\s\S]*border-radius: 999px/);
  assert.match(css, /-webkit-line-clamp: 3/);
  assert.match(css, /\.context-list\s*\{[\s\S]*overflow: hidden/);
});

test('publisher and integrity scans expose loading state without premature counts', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const live = source('background_live_context.js');
  const indicator = source('content/publisher_scan_indicator.js');
  const guard = source('content/runtime_guard.js');
  const scripts = manifest.content_scripts[0].js;

  assert.equal(Object.hasOwn(manifest, 'externally_connectable'), false);
  assert.ok(scripts.includes('content/runtime_guard.js'));
  assert.ok(scripts.includes('content/publisher_scan_indicator.js'));
  assert.ok(scripts.indexOf('content/runtime_guard.js') < scripts.indexOf('content/integrity_scanner.js'));
  assert.ok(scripts.indexOf('content/runtime_guard.js') < scripts.indexOf('content/integrity_presentation.js'));

  assert.match(live, /publisherScanningTabs/);
  assert.match(live, /setBadgeText\(\{ tabId, text: '…' \}\)/);
  assert.match(live, /publisherScanStarted/);
  assert.match(live, /publisherScanFinished/);
  assert.match(live, /getContextScanState/);
  assert.match(live, /formal updates \$\{completed\}\/\$\{attempted\}/);

  assert.match(indicator, /publisherScanStarted/);
  assert.match(indicator, /publisherScanFinished/);
  assert.match(guard, /extension context invalidated/);
  assert.match(guard, /function sendMessage/);
  assert.match(guard, /function storageGet/);
});

test('MDPI bibliography IDs cannot replace visible reference numbers', () => {
  const normalizer = source('content/reference_counter_normalizer.js');
  const scanner = source('content/integrity_scanner.js');

  assert.match(normalizer, /\^B0\*\(\\d\+\)/);
  assert.match(normalizer, /data-content/);
  assert.match(normalizer, /getComputedStyle\(element, '::before'\)/);
  assert.doesNotMatch(normalizer, /\d\+\(\?!\.\*\d\)/);

  assert.match(scanner, /getAttribute\?\.\('data-counter'\)/);
  assert.match(scanner, /'data-content'/);
  assert.match(scanner, /\^B0\*\(\\d\+\)/);
  assert.doesNotMatch(scanner, /match\(\/\\d\+\(\?!\.\*\\d\)\/\)/);
});

test('current integrity presentation stops after extension reload invalidates its context', () => {
  const scanner = source('content/integrity_scanner.js');
  const presentation = source('content/integrity_presentation.js');

  for (const runtime of [scanner, presentation]) {
    assert.match(runtime, /window\.NotandiaRuntime/);
    assert.match(runtime, /runtime\.isAvailable\(\)/);
    assert.match(runtime, /runtime\.isInvalidationError/);
    assert.match(runtime, /observer\?\.disconnect\(\)/);
  }
  assert.match(presentation, /runtime\.sendMessage\(\{ type: 'getIntegrityReport' \}/);
  assert.match(scanner, /runtime\.storageGet\('sync'/);
});
