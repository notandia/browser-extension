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
  const scanner = fs.readFileSync(path.join(root, 'content', 'integrity_scanner.js'), 'utf8');
  const popup = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
  const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  assert.match(scanner, /integrityLookupsEnabled:\s*false/);
  assert.match(scanner, /integrityLookupsEnabled !== true/);
  assert.match(popup, /integrityLookupsEnabled:\s*false/);
  assert.match(popup, /integrityLookupsEnabled === true/);
  assert.match(background, /function cancelIntegrityScan/);
  assert.match(background, /controller\.abort\(\)/);
  assert.match(background, /hasIntegrityTransmissionConsent/);
  assert.match(background, /filter=updates:/);
});

test('all browser targets load publisher and integrity runtimes safely', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const firefox = JSON.parse(fs.readFileSync(path.join(root, 'platforms', 'firefox', 'manifest.json'), 'utf8'));
  const popup = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(Object.hasOwn(manifest.background, 'type'), false);
  assert.ok(manifest.content_scripts[0].js.includes('shared/publisher_profiles.js'));
  assert.ok(manifest.content_scripts[0].js.includes('content/publisher_profile_scanner.js'));
  assert.ok(manifest.content_scripts[0].js.includes('content/integrity_scanner.js'));
  assert.deepEqual(firefox.background.scripts.slice(0, 3), ['shared/publisher_profiles.js', 'shared/integrity.js', 'background.js']);
  assert.equal(firefox.browser_specific_settings.gecko.strict_min_version, '140.0');
  assert.equal(firefox.browser_specific_settings.gecko_android.strict_min_version, '142.0');
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.optional, ['websiteContent']);
  assert.match(popup, /permissions\.request\(\{ data_collection: \['websiteContent'\] \}\)/);
  assert.match(popup, /permissions\.remove\(\{ data_collection: \['websiteContent'\] \}\)/);
});
