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

  assert.match(overview, /api\.effectiveProfiles\(settings\)/);
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
  const context = source('content/source_context.js');
  const scanner = source('content/integrity_scanner.js');

  assert.match(normalizer, /\^B0\*\(\\d\+\)/);
  assert.match(normalizer, /data-content/);
  assert.match(normalizer, /getComputedStyle\(element, '::before'\)/);
  assert.doesNotMatch(normalizer, /\d\+\(\?!\.\*\d\)/);

  assert.match(context, /getAttribute\?\.\('data-counter'\)/);
  assert.match(context, /'data-content'/);
  assert.match(context, /\^B0\*\(\\d\+\)/);
  assert.doesNotMatch(context, /match\(\/\\d\+\(\?!\.\*\\d\)\/\)/);
  assert.match(scanner, /sourceContext\.collectRecords/);
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
  assert.match(scanner, /runtime\.storageGet\([\s\S]*'sync'/);
});


test('reference filter totals exclude the current article and deduplicate works and notices', () => {
  const vm = require('node:vm');
  const popup = source('popup.js');
  const fn = popup.slice(popup.indexOf('  function setIntegrityCounts()'), popup.indexOf('  function recordKey('));
  const nodes = Object.fromEntries(['retracted', 'corrected'].map(status => [status, { closest: () => null }]));
  const record = { kind: 'reference', doi: '10.1234/work', primaryStatus: 'retracted', events: [{ status: 'corrected' }, { status: 'corrected' }] };
  vm.runInNewContext(fn + '\nsetIntegrityCounts();', {
    integrityReport: { records: [record, { ...record }, { kind: 'current-article', doi: '10.1234/article', primaryStatus: 'corrected' }] },
    countIds: { retracted: 'retracted', corrected: 'corrected' },
    recordKey: record => record.doi,
    uniqueIntegrityEvents: events => events || [],
    $: id => nodes[id],
    el: { contextFilter: { value: 'all' }, integrity: { checked: false }, integrityCoverage: {} }
  });
  assert.equal(nodes.retracted.textContent, '1');
  assert.equal(nodes.corrected.textContent, '1');
});

function overviewHarness({ report = null, scanning = false, connected = true } = {}) {
  const vm = require('node:vm');
  const { parseHTML } = require('linkedom');
  const { document } = parseHTML(source('popup.html'));
  let ready;
  let onMessage;
  let rescans = 0;
  let reloads = 0;
  const timers = [];
  const chrome = {
    runtime: {
      sendMessage(message, cb) {
        cb(message.type === 'getPublisherContext' ? { report, settings: profiles.defaultSettings() }
          : message.type === 'getContextScanState' ? { publisherScanning: scanning } : { report: null });
      },
      onMessage: { addListener: fn => { onMessage = fn; } }
    },
    tabs: {
      query: (_, cb) => cb([{ id: 1, url: 'https://www.mdpi.com/2073-445X/15/8/1343' }]),
      sendMessage: (_, message, cb) => {
        assert.equal(message.type, 'forcePublisherRescan');
        rescans++;
        chrome.runtime.lastError = connected ? undefined : { message: 'No receiver' };
        cb(connected ? { scheduled: true } : undefined);
        chrome.runtime.lastError = undefined;
      },
      reload: (_, cb) => { reloads++; cb(); }
    },
    storage: { onChanged: { addListener() {} } }
  };
  document.addEventListener = (event, fn) => { if (event === 'DOMContentLoaded') ready = fn; };
  const profiles = require('../shared/publisher_profiles.js');
  vm.runInNewContext(source('popup_overview.js'), {
    document, chrome, NotandiaPublisherProfiles: profiles, Event: document.defaultView.Event,
    setTimeout: fn => { timers.push(fn); }
  });
  ready();
  return { document, rescans: () => rescans, reloads: () => reloads,
    update(value) { report = value; scanning = false; onMessage({ type: 'publisherContextUpdated' }); },
    timers };
}

test('popup recovers an empty scan rather than declaring a completed zero count', () => {
  const h = overviewHarness({ report: { references: [], searchResults: [] }, scanning: true });
  assert.equal(h.rescans(), 1);
  assert.equal(h.document.getElementById('countAllContext').textContent, '—');
  assert.equal(h.document.getElementById('contextOverviewHeading').textContent, 'Checking this page…');
  h.update({ references: [25, 26, 50].map(number => ({ number, id: `B${number}`, matches: [{ profileId: 'mdpi' }] })) });
  assert.equal(h.document.getElementById('countAllContext').textContent, '3');
  assert.equal(h.document.querySelector('[data-context-filter="profile:mdpi"] strong').textContent, '3');
  assert.equal(h.rescans(), 1);
});

test('popup offers page refresh when an updated extension cannot reach the old content script', () => {
  const h = overviewHarness({ connected: false });
  const button = h.document.getElementById('refreshContextPage');
  assert.equal(button.hidden, false);
  assert.equal(h.document.getElementById('contextScanState').hidden, true);
  assert.match(h.document.getElementById('contextOverviewSummary').textContent, /after installation or an update/);
  button.click();
  assert.equal(h.reloads(), 1);
  assert.equal(button.hidden, true);
});


test('coverage counts bibliography entries and does not invent a denominator for older reports', () => {
  const references = [25, 26, 50].map(number => ({ number, id: `B${number}`, matches: [{ profileId: 'mdpi' }] }));
  const h = overviewHarness({ report: { references, searchResults: [], coverage: { referencesScanned: 50 }, currentArticle: { matches: [{ profileId: 'mdpi' }] } } });
  assert.match(h.document.getElementById('contextOverviewSummary').textContent, /3 of 50 scanned references match your watchlist/);
  h.update({ references, searchResults: [] });
  assert.doesNotMatch(h.document.getElementById('contextOverviewSummary').textContent, /scanned references/);
});

test('citation explanations retain native link and disclosure keyboard interaction', () => {
  const vm = require('node:vm');
  const { parseHTML } = require('linkedom');
  const { document } = parseHTML('<ul><li data-ref-id="B25"><details><summary>Why MDPI is included</summary><a href="https://beallslist.net/">Source</a></details></li></ul>');
  const popup = source('popup.js');
  const start = popup.indexOf("  el.contextList.addEventListener('click'");
  const end = popup.indexOf("  el.save.addEventListener", start);
  const handlers = {};
  const messages = [];
  vm.runInNewContext(popup.slice(start, end), {
    el: { contextList: { addEventListener: (event, handler) => { handlers[event] = handler; } } },
    chrome: { runtime: { sendMessage: message => messages.push(message) } }
  });
  for (const selector of ['summary', 'a']) {
    let prevented = false;
    const event = { target: document.querySelector(selector), key: 'Enter', preventDefault: () => { prevented = true; } };
    handlers.click(event);
    handlers.keydown(event);
    assert.equal(prevented, false);
    assert.equal(messages.length, 0);
  }
  let prevented = false;
  handlers.keydown({ target: document.querySelector('li'), key: 'Enter', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(messages[0].refId, 'B25');
});
