'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { parseHTML } = require('linkedom');
const api = require('../shared/publisher_profiles.js');

test('publisher defaults and custom badge ink meet small-text contrast on white', () => {
  assert.notEqual(api.BUILTIN_PROFILES[0].color, api.BUILTIN_PROFILES[1].color);
  for (const profile of [...api.BUILTIN_PROFILES, ...api.PRESET_CATALOGUE, ...api.CONCERN_PRESETS]) assert.ok(api.contrastRatio(profile.color) >= 4.5, profile.name);
  assert.equal(api.readableColor('#FFFFFF'), '#12263F');
  assert.equal(api.readableColor('#FFFF00'), '#12263F');
  assert.equal(api.readableColor('#B45309'), '#B45309');
  assert.equal(api.readableColor('#7C3AED'), '#7C3AED');
});

test('optional catalogue stays out of the watchlist until explicitly added', () => {
  const settings = api.defaultSettings();
  assert.equal(settings.profiles.length, 2);
  assert.equal(api.PRESET_CATALOGUE.length, 7);
  for (const preset of api.PRESET_CATALOGUE) {
    const doi = `${preset.doiPrefixes[0]}/example`;
    assert.equal(api.matchProfiles(settings, { dois: [doi] }).length, 0);
    const profile = api.normalizeProfile(preset, { preset: true });
    assert.equal(profile.action, 'none');
    settings.profiles.push(profile);
    const persisted = api.sanitizeSettings(settings);
    assert.equal(persisted.profiles.find(item => item.id === preset.id).source, 'preset');
    assert.equal(api.matchProfiles(persisted, { dois: [doi] })[0].profileId, profile.id);
    assert.equal(api.matchProfile(profile, { hostnames: [`unrelated-${profile.domains[0]}`] }), null);
    assert.equal(api.matchProfile(profile, { hostnames: [`${profile.domains[0]}.example.org`] }), null);
    assert.equal(api.matchProfile(profile, { hostnames: [profile.domains[0]] }).profileId, profile.id);
    settings.profiles.pop();
  }
});

test('fresh defaults do not overwrite stored legacy or current preferences', () => {
  const fresh = api.migrateLegacySettings({ mode: null, highlightPotentialMdpiSites: null, potentialMdpiHighlightColor: null });
  assert.equal(fresh.profiles[0].color, '#B45309');
  assert.equal(fresh.migratedFromLegacy, false);
  const legacy = api.migrateLegacySettings({ mode: 'hide', potentialMdpiHighlightColor: '#E2211C', highlightPotentialMdpiSites: false });
  assert.equal(legacy.profiles[0].color, '#E2211C');
  assert.equal(legacy.profiles[0].action, 'hide');
  const previous = { schemaVersion: 2, profiles: api.defaultSettings().profiles.slice(0, 2) };
  previous.profiles[0].enabled = false;
  previous.profiles[0].color = '#123456';
  previous.profiles[1].color = '#0B78B5';
  const migrated = api.migrateLegacySettings({ publisherWatchlist: previous });
  assert.equal(migrated.profiles[0].enabled, false);
  assert.equal(migrated.profiles[0].color, '#123456');
  assert.equal(migrated.profiles[1].color, '#0B78B5');
  assert.equal(migrated.profiles.length, 2);
});

test('settings name each publisher control and render only trusted rationale links', () => {
  const { document, Event } = parseHTML(fs.readFileSync('options.html', 'utf8'));
  const sandbox = {
    document, NotandiaPublisherProfiles: api, setTimeout: () => {},
    chrome: { runtime: { getManifest: () => ({}) }, storage: { sync: { get: (defaults, callback) => callback(defaults), set: () => {} } } }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('options.js', 'utf8'), sandbox);
  document.dispatchEvent(new Event('DOMContentLoaded'));
  assert.equal(document.querySelectorAll('.profile-row').length, 2);
  assert.equal(document.querySelector('#publisherPreset, #concernPreset'), null);
  for (const control of document.querySelectorAll('.profile-row input, .profile-row select')) assert.ok(control.getAttribute('aria-label'));
  assert.equal(document.querySelectorAll('.profile-rationale').length, 2);
  for (const link of document.querySelectorAll('.profile-rationale a')) {
    assert.match(link.href, /^https:\/\/(julkaisufoorumi\.fi|kanalregister\.hkdir\.no|en\.wikipedia\.org|beallslist\.net)\//);
    assert.equal(link.rel, 'noopener noreferrer');
  }
});


test('concern presets preserve scope, provenance and saved choices', () => {
  assert.equal(api.CONCERN_PRESETS.length, 4);
  assert.equal(new Set([...api.BUILTIN_PROFILES, ...api.CONCERN_PRESETS].map(p => p.color)).size, 6);
  for (const preset of api.CONCERN_PRESETS) {
    assert.equal(api.matchProfiles(api.defaultSettings(), { hostnames: preset.domains }).length, 0);
    const settings = api.sanitizeSettings({ profiles: [{ ...preset, domains: ['spoof.example'], color: '#123456', enabled: false, action: 'hide', evidence: 'invented' }] });
    const saved = settings.profiles.find(p => p.id === preset.id);
    assert.deepEqual(saved.domains, [...preset.domains]);
    assert.equal(saved.color, '#123456');
    assert.equal(saved.enabled, false);
    assert.equal(saved.action, 'hide');
    assert.equal(saved.evidence, undefined);
    const context = api.profileContext(preset.id);
    assert.equal(context.reviewed, '2026-10-04');
    assert.equal(api.matchProfile(preset, { hostnames: [new URL(context.testUrl).hostname] }).profileId, preset.id);
    assert.ok(context.sources.every(source => source.url.startsWith('https://')));
    assert.equal(api.matchProfile(preset, { hostnames: [preset.domains[0] + '.example.org'] }), null);
  }
  assert.equal(api.profileContext('omics').sourceFamily, api.profileContext('imedpub').sourceFamily);
  assert.equal(api.matchProfile(api.CONCERN_PRESETS.find(p => p.id === 'bentham-open'), { dois: ['10.2174/example'] }), null);
  assert.equal(api.profileContext('elsevier'), null);
});


test('Bentham archive redirect matches the preset with a strict hostname boundary', () => {
  const profile = api.CONCERN_PRESETS.find(p => p.id === 'bentham-open');
  assert.equal(api.matchProfile(profile, { hostnames: ['benthamopenarchives.com'] }).profileId, 'bentham-open');
  assert.equal(api.matchProfile(profile, { hostnames: ['benthamopenarchives.com.example.org'] }), null);
  assert.equal(api.matchProfile(profile, { hostnames: ['benthamscience.com'] }), null);
});


test('simplified settings preserve saved additional profiles and allow their removal', () => {
  const { document, Event } = parseHTML(fs.readFileSync('options.html', 'utf8'));
  let saved = { ...api.defaultSettings(), profiles: [...api.defaultSettings().profiles, api.CONCERN_PRESETS[0]] };
  const sandbox = {
    document, NotandiaPublisherProfiles: api, setTimeout: () => {},
    chrome: { runtime: { getManifest: () => ({}) }, storage: { sync: {
      get: (defaults, callback) => callback({ ...defaults, publisherWatchlist: saved }),
      set: values => { if (values.publisherWatchlist) saved = values.publisherWatchlist; }
    } } }
  };
  vm.runInNewContext(fs.readFileSync('options.js', 'utf8'), sandbox);
  document.dispatchEvent(new Event('DOMContentLoaded'));
  assert.equal(saved.profiles.length, 3);
  assert.equal(document.querySelectorAll('.profile-row').length, 3);
  document.querySelector('[data-profile-id="omics"] .remove-profile').click();
  assert.equal(document.querySelectorAll('.profile-row').length, 2);
  assert.equal(saved.profiles.length, 3, 'removal takes effect when settings are saved');
  assert.equal(document.querySelectorAll('.profile-row .profile-enabled').length, 2);
});
