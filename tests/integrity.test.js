'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  STATUS_DEFINITIONS,
  badgeForSummary,
  createStartRateLimiter,
  derivePrimaryStatus,
  normalizeCrossrefEvents,
  normalizeCrossrefUpdateRecords,
  normalizeDOI,
  normalizeUpdateType,
  summarizeIntegrityRecords
} = require('../shared/integrity.js');

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('DOIs are normalized without accepting arbitrary URLs', () => {
  assert.equal(normalizeDOI(' https://doi.org/10.1000/ABC.123. '), '10.1000/abc.123');
  assert.equal(normalizeDOI('doi:10.3390/nu4091171'), '10.3390/nu4091171');
  assert.equal(normalizeDOI('https://example.org/not-a-doi'), null);
  assert.equal(normalizeDOI('10.1/no'), null);
});

test('Crossref update labels map to stable statuses', () => {
  assert.equal(normalizeUpdateType('expression_of_concern'), 'expression-of-concern');
  assert.equal(normalizeUpdateType('corrigendum'), 'corrected');
  assert.equal(normalizeUpdateType('', 'Reinstatement'), 'reinstated');
  assert.equal(normalizeUpdateType('', 'Duplicate publication'), 'duplicate-publication');
});

test('only updated-by relationships classify the queried work', () => {
  assert.deepEqual(normalizeCrossrefEvents({
    DOI: '10.1000/retraction-notice',
    'update-to': [{ DOI: '10.1000/original-paper', type: 'retraction' }]
  }), []);

  const events = normalizeCrossrefEvents({
    'updated-by': [{
      DOI: '10.1000/notice',
      type: 'retraction',
      source: 'retraction-watch',
      'record-id': 42,
      updated: { 'date-time': '2025-02-01T00:00:00Z' }
    }]
  });
  assert.equal(events[0].status, 'retracted');
  assert.equal(events[0].recordId, 42);
  assert.equal(events[0].noticeDoi, '10.1000/notice');
});

test('Crossref reverse update records classify the original Nature work', () => {
  const events = normalizeCrossrefUpdateRecords([{
    DOI: '10.1038/s41586-024-07653-0',
    'update-to': [{
      DOI: '10.1038/nature00870',
      type: 'retraction',
      source: 'retraction-watch',
      'record-id': 123
    }],
    created: { 'date-time': '2024-07-01T00:00:00Z' }
  }], '10.1038/nature00870');
  assert.equal(events.length, 1);
  assert.equal(events[0].status, 'retracted');
  assert.equal(events[0].noticeDoi, '10.1038/s41586-024-07653-0');
  assert.equal(events[0].recordId, 123);
});

test('Crossref reverse update records ignore unrelated targets', () => {
  const events = normalizeCrossrefUpdateRecords([{
    DOI: '10.1000/notice',
    'update-to': [{ DOI: '10.1000/different-work', type: 'retraction' }]
  }], '10.1000/original-work');
  assert.deepEqual(events, []);
});

test('reinstatement supersedes an older retraction without deleting history', () => {
  assert.equal(derivePrimaryStatus([
    { status: 'retracted', timestamp: 10 },
    { status: 'reinstated', timestamp: 20 },
    { status: 'corrected', timestamp: 30 }
  ]), 'reinstated');
});

test('summary counts affected works once per status and drives badge severity', () => {
  const summary = summarizeIntegrityRecords([
    {
      lookupStatus: 'checked',
      primaryStatus: 'retracted',
      events: [{ status: 'expression-of-concern' }, { status: 'retracted' }, { status: 'retracted' }]
    },
    { lookupStatus: 'checked', primaryStatus: 'corrected', events: [{ status: 'corrected' }] },
    { lookupStatus: 'failed', primaryStatus: null, events: [] }
  ], 3);
  assert.equal(summary.checked, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.affected, 2);
  assert.equal(summary.counts.retracted, 1);
  assert.equal(summary.counts['expression-of-concern'], 1);
  assert.deepEqual(badgeForSummary(summary), {
    count: 2,
    color: STATUS_DEFINITIONS.retracted.color,
    title: '2 references with known integrity signals'
  });
});

test('request-start limiter spaces concurrent callers', async () => {
  let clock = 1000;
  const sleeps = [];
  const limiter = createStartRateLimiter(250, () => clock, async milliseconds => {
    sleeps.push(milliseconds);
    clock += milliseconds;
  });
  const starts = await Promise.all([limiter(), limiter(), limiter(), limiter(), limiter()]);
  assert.deepEqual(starts, [1000, 1250, 1500, 1750, 2000]);
  assert.deepEqual(sleeps, [250, 250, 250, 250]);
});

test('integrity network behavior is explicit opt-in and cancellable', () => {
  const scanner = source('content/integrity_scanner.js');
  const popup = source('popup.js');
  const background = source('background.js');
  const support = source('background_support.js');
  assert.match(scanner, /integrityLookupsEnabled:\s*false/);
  assert.match(scanner, /integrityLookupsEnabled !== true/);
  assert.match(popup, /integrityLookupsEnabled:\s*false/);
  assert.match(popup, /integrityLookupsEnabled === true/);
  assert.match(background, /function cancelIntegrityScan/);
  assert.match(background, /controller\.abort\(\)/);
  assert.match(background, /hasIntegrityTransmissionConsent/);
  assert.match(background, /filter=updates:/);
  assert.match(support, /credentials: 'omit'/);
  assert.match(support, /referrerPolicy: 'no-referrer'/);
  assert.match(support, /message\.type === 'ncbiIdConversion'/);
});

test('integrity runtime restores reports before falling back to a rescan', () => {
  const scanner = source('content/integrity_scanner.js');
  const presentation = source('content/integrity_presentation.js');
  const support = source('background_support.js');
  const persistence = source('background_persistence.js');
  const popupRecovery = source('popup_recovery.js');
  const popupHtml = source('popup.html');

  assert.match(scanner, /getAttribute\?\.\('data-counter'\)/);
  assert.match(scanner, /referenceNumber\(element, index\)/);
  assert.match(scanner, /references\.map\(reference => \[reference\.id, reference\.doi\]\)/);
  assert.match(scanner, /sendResponse\(\{ scheduled: true \}\)/);

  assert.match(presentation, /generateInlineFootnoteSelectors/);
  assert.match(presentation, /notandia-integrity-reference/);
  assert.match(presentation, /notandia-integrity-citation/);
  assert.match(presentation, /notandia-integrity-chip/);
  assert.match(presentation, /integrityPresentationNeedsRescan/);
  assert.match(presentation, /MutationObserver/);

  assert.match(support, /chrome\.storage\.session/);
  assert.match(support, /restoreOrRescan/);
  assert.match(support, /NotandiaBackgroundPersistence\?\.restoreTab/);
  assert.match(persistence, /integrityTabData\.get\(tabId\)/);
  assert.match(persistence, /publisherTabData\.get\(tabId\)/);
  assert.match(persistence, /chrome\.storage\.session\.set/);
  assert.match(persistence, /restorePersistedTabState/);
  assert.match(persistence, /background_persistence\.js|STATE_PREFIX/);
  assert.match(popupRecovery, /restorePersistedTabState/);
  assert.match(popupRecovery, /Restoring integrity results/);
  assert.match(popupRecovery, /textContent = '…'/);
  assert.match(popupHtml, /<script src="popup_recovery\.js"><\/script>/);
});

test('reference navigation prefers canonical visible bibliography copies', () => {
  const handler = source('content/secure_message_handler.js');
  const css = source('content/integrity_presentation.css');
  const persistence = source('background_persistence.js');

  assert.match(handler, /li\.c-article-references__item/);
  assert.match(handler, /c-reading-companion/);
  assert.match(handler, /requestedDoi/);
  assert.match(handler, /requestedText/);
  assert.match(handler, /notandia-scroll-target/);
  assert.match(handler, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.match(css, /@keyframes notandia-scroll-pulse/);
  assert.match(css, /--notandia-scroll-color/);
  assert.match(persistence, /findContextRecord/);
  assert.match(persistence, /type: 'scrollToRefOnPage'/);
});

test('live progress, visible counters, and combined context badges are packaged', () => {
  const counter = source('content/reference_counter_normalizer.js');
  const live = source('background_live_context.js');
  const popupProgress = source('popup_progress.js');
  const popupHtml = source('popup.html');
  const css = source('content/integrity_presentation.css');

  assert.match(counter, /data-content/);
  assert.match(counter, /data-counter/);
  assert.match(live, /integrityProgressUpdated/);
  assert.match(live, /progressPercent/);
  assert.match(live, /publisher watchlist match/);
  assert.match(live, /NotandiaBackgroundPersistence\?\.saveTab/);
  assert.match(popupProgress, /of \$\{attempted\} DOI records/);
  assert.match(popupHtml, /id="integrityProgress"/);
  assert.match(popupHtml, /popup_progress\.js/);
  assert.match(css, /all: initial !important/);
});

test('all browser targets load publisher, integrity, and recovery runtimes safely', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const firefox = JSON.parse(source('platforms/firefox/manifest.json'));
  const popup = source('popup.js');
  const serviceWorker = source('service_worker.js');
  const scripts = manifest.content_scripts[0].js;

  assert.equal(manifest.background.service_worker, 'service_worker.js');
  assert.equal(Object.hasOwn(manifest.background, 'type'), false);
  assert.ok(scripts.includes('shared/publisher_profiles.js'));
  assert.ok(scripts.includes('content/reference_counter_normalizer.js'));
  assert.ok(scripts.includes('content/publisher_profile_scanner.js'));
  assert.ok(scripts.includes('content/integrity_scanner.js'));
  assert.ok(scripts.includes('content/integrity_presentation.js'));
  assert.ok(scripts.indexOf('content/reference_counter_normalizer.js') < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.ok(scripts.indexOf('content/ncbi_fetch_proxy.js') < scripts.indexOf('content/ncbi_api_handler.js'));
  assert.ok(manifest.content_scripts[0].css.includes('content/integrity_presentation.css'));
  assert.match(serviceWorker, /background_support\.js/);
  assert.match(serviceWorker, /background\.js/);
  assert.match(serviceWorker, /background_persistence\.js/);
  assert.match(serviceWorker, /background_live_context\.js/);
  assert.deepEqual(firefox.background.scripts, [
    'shared/publisher_profiles.js',
    'shared/integrity.js',
    'background_support.js',
    'background.js',
    'background_persistence.js',
    'background_live_context.js'
  ]);
  assert.equal(firefox.browser_specific_settings.gecko.strict_min_version, '140.0');
  assert.equal(firefox.browser_specific_settings.gecko_android.strict_min_version, '142.0');
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.optional, ['websiteContent']);
  assert.match(popup, /permissions\.request\(\{ data_collection: \['websiteContent'\] \}\)/);
  assert.match(popup, /permissions\.remove\(\{ data_collection: \['websiteContent'\] \}\)/);
});
