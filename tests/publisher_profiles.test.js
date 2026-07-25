'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const api = require('../shared/publisher_profiles.js');

test('MDPI and Frontiers are configurable highlighted defaults', () => {
  const settings = api.createDefaultSettings();
  const mdpi = settings.profiles.find(profile => profile.id === 'mdpi');
  const frontiers = settings.profiles.find(profile => profile.id === 'frontiers');
  assert.equal(mdpi.enabled, true);
  assert.equal(mdpi.action, 'highlight');
  assert.equal(frontiers.enabled, true);
  assert.equal(frontiers.action, 'highlight');

  mdpi.enabled = false;
  assert.deepEqual(api.matchProfiles(settings, { doi: '10.3390/nu1010001' }), []);
});

test('legacy MDPI settings migrate without making MDPI mandatory', () => {
  const settings = api.migratePublisherSettings({
    mode: 'hide',
    highlightPotentialMdpiSites: true,
    potentialMdpiHighlightColor: '#123456'
  });
  const mdpi = settings.profiles.find(profile => profile.id === 'mdpi');
  assert.equal(mdpi.action, 'hide');
  assert.equal(mdpi.confidencePolicy, 'include-potential');
  assert.equal(mdpi.potentialColor, '#123456');
  mdpi.enabled = false;
  assert.equal(api.normalizeSettings(settings).profiles.find(profile => profile.id === 'mdpi').enabled, false);
});

test('Frontiers matches verified DOI prefixes and publisher domains', () => {
  const settings = api.createDefaultSettings();
  const doiMatches = api.matchProfiles(settings, { doi: '10.3389/fbioe.2025.123456' });
  assert.equal(doiMatches[0].profileId, 'frontiers');
  assert.equal(doiMatches[0].confidence, 'confirmed');
  assert.deepEqual(doiMatches[0].reasons, ['doi-prefix']);

  const domainMatches = api.matchProfiles(settings, { urls: ['https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2025.1/full'] });
  assert.equal(domainMatches[0].profileId, 'frontiers');
  assert.ok(domainMatches[0].reasons.includes('publisher-domain'));
});

test('potential publisher-name matching is explicit per profile', () => {
  const settings = api.createDefaultSettings();
  assert.deepEqual(api.matchProfiles(settings, { text: 'Published by Frontiers' }), []);
  settings.profiles.find(profile => profile.id === 'frontiers').confidencePolicy = 'include-potential';
  const matches = api.matchProfiles(settings, { text: 'Published by Frontiers' });
  assert.equal(matches[0].confidence, 'potential');
});

test('custom profiles accept validated data only', () => {
  const result = api.customProfileFromInput({
    name: 'Example Press',
    domains: ['https://www.example.org/path', '*.journals.example.org'],
    doiPrefixes: ['10.1234'],
    action: 'dim',
    color: '#112233',
    confidencePolicy: 'verified-only',
    selector: 'script',
    code: 'alert(1)'
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.profile.domains, ['example.org', 'journals.example.org']);
  assert.deepEqual(result.profile.doiPrefixes, ['10.1234']);
  assert.equal(Object.hasOwn(result.profile, 'selector'), false);
  assert.equal(Object.hasOwn(result.profile, 'code'), false);
});

test('multiple publisher actions resolve deterministically', () => {
  const presentation = api.resolvePresentation([
    { profileId: 'zeta', action: 'highlight', color: '#111111' },
    { profileId: 'alpha', action: 'hide', color: '#222222' },
    { profileId: 'beta', action: 'dim', color: '#333333' }
  ]);
  assert.deepEqual(presentation, { action: 'hide', color: '#222222', profileId: 'alpha' });
});

test('extension surfaces use neutral watchlist terminology and sanitized reporting', () => {
  const popup = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  const popupJs = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
  const options = fs.readFileSync(path.join(root, 'options.html'), 'utf8');
  assert.match(popup, /Matched literature/);
  assert.match(options, /Publisher profiles are identification and display rules—not objective quality scores/);
  assert.doesNotMatch(options, /grey publisher/i);
  assert.match(popupJs, /parsed\.origin\}\$\{parsed\.pathname/);
  assert.doesNotMatch(popupJs, /parsed\.search|parsed\.hash/);
  assert.match(popupJs, /Enabled publisher profiles/);
});

test('browser runtime loads publisher profile modules before scanners', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf('shared/publisher_profiles.js') < scripts.indexOf('content/publisher_scanner.js'));
  assert.equal(manifest.background.service_worker, 'service_worker.js');
  const firefox = JSON.parse(fs.readFileSync(path.join(root, 'platforms', 'firefox', 'manifest.json'), 'utf8'));
  assert.deepEqual(firefox.background.scripts.slice(0, 3), [
    'shared/integrity.js',
    'shared/publisher_profiles.js',
    'publisher_background.js'
  ]);
});
