'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const api = require('../shared/publisher_profiles.js');

test('MDPI and Frontiers are independently configurable default watchlist profiles', () => {
  const settings = api.defaultSettings();
  const mdpi = settings.profiles.find(profile => profile.id === 'mdpi');
  const frontiers = settings.profiles.find(profile => profile.id === 'frontiers');
  assert.equal(mdpi.enabled, true);
  assert.equal(frontiers.enabled, true);
  assert.equal(mdpi.action, 'highlight');
  assert.equal(frontiers.action, 'highlight');
  mdpi.enabled = false;
  assert.equal(api.matchProfiles(settings, { dois: ['10.3390/example'], hostnames: [] }).length, 0);
  assert.equal(api.matchProfiles(settings, { dois: ['10.3389/fmed.2026.1'], hostnames: [] })[0].profileId, 'frontiers');
});

test('legacy MDPI settings migrate without making MDPI mandatory', () => {
  const migrated = api.migrateLegacySettings({ mode: 'hide', highlightPotentialMdpiSites: false, potentialMdpiHighlightColor: '#123456' });
  const mdpi = migrated.profiles.find(profile => profile.id === 'mdpi');
  assert.equal(mdpi.action, 'hide');
  assert.equal(mdpi.confidencePolicy, 'confirmed-only');
  assert.equal(mdpi.color, '#123456');
  mdpi.enabled = false;
  assert.equal(api.sanitizeSettings(migrated).profiles.find(profile => profile.id === 'mdpi').enabled, false);
});

test('custom profiles accept only declarative domains and DOI prefixes', () => {
  assert.deepEqual(api.normalizeProfile({
    id: 'example-press', name: 'Example Press', domains: ['https://www.example.org/path'], doiPrefixes: ['doi:10.1234'],
    action: 'dim', color: '#abcdef', confidencePolicy: 'confirmed-only'
  }), {
    id: 'example-press', name: 'Example Press', domains: ['example.org'], doiPrefixes: ['10.1234'], enabled: true,
    action: 'dim', color: '#ABCDEF', confidencePolicy: 'confirmed-only', source: 'custom'
  });
  assert.equal(api.normalizeProfile({ id: 'bad', name: 'Bad', domains: ['javascript:alert(1)'], doiPrefixes: [] }), null);
});

test('multiple profile matches resolve deterministically by visual action', () => {
  const selected = api.resolveVisualMatch([
    { profileId: 'a', action: 'highlight' },
    { profileId: 'b', action: 'hide' },
    { profileId: 'c', action: 'dim' }
  ]);
  assert.equal(selected.profileId, 'b');
});

test('runtime and interfaces load the general publisher system', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const popup = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  const options = fs.readFileSync(path.join(root, 'options.html'), 'utf8');
  assert.ok(manifest.content_scripts[0].js.includes('shared/publisher_profiles.js'));
  assert.ok(manifest.content_scripts[0].js.includes('content/publisher_profile_scanner.js'));
  assert.match(popup, /Article context/);
  assert.match(popup, /Report article\/context issue/);
  assert.match(options, /MDPI and Frontiers are enabled and highlighted by default/);
  assert.doesNotMatch(options, /grey publisher/i);
});
