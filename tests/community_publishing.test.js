'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const api = require('../shared/publisher_profiles.js');

test('verified extra prefixes identify publishers with strict DOI boundaries', () => {
  const settings = api.defaultSettings();
  for (const prefix of ['10.1989', '10.20944', '10.32545', '10.35995']) {
    assert.equal(api.matchProfiles(settings, { dois: [`${prefix}/example`] })[0].profileId, 'mdpi');
    assert.equal(api.matchProfiles(settings, { dois: [`${prefix}1/example`] }).length, 0);
  }
  assert.equal(api.matchProfiles(settings, { dois: ['10.4175/example'] })[0].profileId, 'frontiers');
  assert.equal(api.matchProfiles(settings, { dois: ['10.41751/example'] }).length, 0);
  settings.profiles[0].enabled = false;
  assert.equal(api.matchProfiles(settings, { dois: ['10.35995/example'] }).length, 0);
});

test('preprints and encyclopedia entries have their own labels and explanations', () => {
  const settings = api.defaultSettings();
  const profile = api.profileMap(settings).get('mdpi');
  const preprint = api.matchProfiles(settings, { dois: ['10.20944/preprints202407.1143.v1'] })[0];
  assert.equal(preprint.publicationType, 'preprint');
  assert.equal(api.matchContext(profile, preprint).assessment, 'Preprint');
  assert.equal(api.matchContext(profile, preprint).sources[0].url, 'https://www.preprints.org/about');
  assert.doesNotMatch(api.matchContext(profile, preprint).explanation, /Beall|downgraded|predatory/);
  const entry = api.matchProfiles(settings, { dois: ['10.32545/encyclopedia201911.0007.v1'] })[0];
  assert.equal(entry.publicationType, 'encyclopedia-entry');
  assert.equal(api.publicationTypeLabel(entry.publicationType), 'Encyclopedia entry');
  assert.equal(api.matchContext(profile, entry).assessment, 'Encyclopedia entry');
  const journal = api.matchProfiles(settings, { primaryDoi: '10.3390/example', dois: ['10.3390/example', '10.20944/preprints202407.1143.v1'] })[0];
  assert.equal(journal.publicationType, undefined, 'a link to another version does not change the primary work type');
  assert.equal(api.publicationType({ dois: ['10.1002/example'], hostnames: ['preprints.org'] }), null);
  assert.equal(api.publicationTypeLabel('toString'), '');
});

test('community rules require opt-in, preserve explicit choices and avoid duplicate matches', () => {
  const settings = api.defaultSettings();
  const evidence = { hostnames: ['benthamopenarchives.com'] };
  assert.equal(api.matchProfiles(settings, evidence).length, 0);
  settings.communityWarningsEnabled = true;
  assert.equal(settings.profiles.length, 2, 'community data is separate from editable profiles');
  assert.equal(api.matchProfiles(settings, evidence)[0].profileId, 'bentham-open');
  assert.ok(api.profileMap(settings).size > 2000);
  assert.ok(api.profileMap(settings).has('bentham-open'));
  assert.equal(api.matchProfiles(settings, { hostnames: ['benthamscience.com'], dois: ['10.2174/example'] }).length, 0);
  assert.equal(api.matchProfiles(settings, { hostnames: ['benthamopenarchives.com.example.org'] }).length, 0);
  settings.profiles.push({ ...api.CONCERN_PRESETS[3], enabled: false });
  assert.equal(api.matchProfiles(settings, evidence).length, 0, 'a saved disabled profile takes precedence');
  settings.profiles[2].enabled = true;
  settings.profiles[2].action = 'dim';
  settings.profiles[2].color = '#123456';
  const matches = api.matchProfiles(settings, evidence);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].action, 'dim');
  assert.equal(matches[0].color, '#123456');
  const imported = api.sanitizeSettings(JSON.parse(JSON.stringify(settings)));
  assert.equal(imported.communityWarningsEnabled, true);
  assert.equal(api.sanitizeSettings({ ...settings, communityWarningsEnabled: 'true' }).communityWarningsEnabled, false);
});

test('background preserves known publication labels and drops unsupported types', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const normalize = source.slice(source.indexOf('function normalizePublisherMatch('), source.indexOf('function normalizePublisherRecord('));
  const context = { publisherApi: api, SAFE_PROFILE_ID: /^[a-z0-9-]+$/, currentProfileMap: () => api.profileMap(api.defaultSettings()) };
  vm.runInNewContext(normalize, context);
  assert.equal(context.normalizePublisherMatch({ profileId: 'mdpi', publicationType: 'preprint' }).publicationType, 'preprint');
  assert.equal(context.normalizePublisherMatch({ profileId: 'mdpi', publicationType: 'toString' }).publicationType, undefined);
  assert.equal(context.normalizePublisherMatch({ profileId: 'frontiers', publicationType: 'preprint' }).publicationType, undefined);
});

test('full pinned publisher and journal datasets are bundled with attribution', () => {
  const data = require('../shared/community_publishing_data.js');
  assert.deepEqual(api.COMMUNITY_DATA.sourceEntryCounts, [1334, 1498]);
  assert.equal(data.license, 'CC-BY-SA-4.0');
  assert.match(data.attribution, /Wikimedia contributors/);
  assert.ok(data.sources.every(source => source.url.includes(`oldid=${source.revision}`)));
  const settings = { ...api.defaultSettings(), communityWarningsEnabled: true };
  const match = api.matchProfiles(settings, { hostnames: ['academicjournals.org'] })[0];
  assert.equal(match.profileName, 'academicjournals.org');
  const profile = api.profileMap(settings).get(match.profileId);
  const context = api.matchContext(profile, match);
  assert.equal(context.assessment, 'Listed by Cite Unseen');
  assert.match(context.sources[0].url, /oldid=30328516/);
  assert.equal(api.matchProfiles(api.defaultSettings(), { hostnames: ['academicjournals.org'] }).length, 0);
});

test('journal paths and query selectors never warn about a whole shared host', () => {
  const settings = { ...api.defaultSettings(), communityWarningsEnabled: true };
  for (const url of ['https://www.dovepress.com/core-evidence-journal/article/123', 'https://scopemed.org/?jid=23']) {
    const matches = api.matchProfiles(settings, { urls: [url] });
    assert.equal(matches.length, 1, url);
    assert.match(api.matchContext(api.profileMap(settings).get(matches[0].profileId), matches[0]).sources[0].url, /oldid=30328518/);
  }
  for (const url of ['https://dovepress.com/another-journal/article/123', 'https://dovepress.com/core-evidence-journal-imposter', 'https://scopemed.org/?jid=24', 'https://example.org/academicjournals.org', 'https://academicjournals.org.example.org/article']) {
    assert.equal(api.matchProfiles(settings, { urls: [url] }).length, 0, url);
  }
  assert.equal(api.matchProfiles(settings, { hostnames: ['dovepress.com', 'scopemed.org'] }).length, 0);
  assert.equal(api.matchProfiles(settings, { dois: ['10.2147/example'] }).length, 0);
});

test('manual rules and disabled Frontiers choices override the broader dataset', () => {
  const settings = { ...api.defaultSettings(), communityWarningsEnabled: true };
  settings.profiles[1].enabled = false;
  assert.equal(api.matchProfiles(settings, { hostnames: ['frontiersin.org'] }).length, 0);
  settings.profiles.push({ id: 'my-academic-journals-rule', name: 'My rule', domains: ['academicjournals.org'], doiPrefixes: [], enabled: false });
  assert.equal(api.matchProfiles(settings, { hostnames: ['academicjournals.org'] }).length, 0);
  settings.profiles[2].enabled = true;
  settings.profiles[2].action = 'badge';
  assert.equal(api.matchProfiles(settings, { hostnames: ['academicjournals.org'] })[0].action, 'badge');
});

test('snapshot import reads declarative URL entries and rejects unsupported content', () => {
  const { extractEntries } = require('../scripts/import-community-publishing.js');
  assert.deepEqual(extractEntries('* {{CULink |url= example.org/journal }}'), ['example.org/journal']);
  assert.throws(() => extractEntries('* {{CULink |unknown= example.org }}'), /Unparsed/);
  assert.throws(() => extractEntries('* {{CULink |url= javascript://example.org }}'), /Unsupported/);
});

test('CiteWatch snapshots include publishers, journals, dated sources and exclusions', () => {
  const data = require('../shared/community_publishing_data.js').citewatch;
  assert.deepEqual(api.COMMUNITY_DATA.citewatchEntryCounts, [1381, 2122]);
  assert.ok(data.exclusions.length > 1000);
  assert.equal(data.exclusionSource.revision, 1378216066);
  for (const source of data.sources) assert.ok(source.url.includes(`oldid=${source.revision}`));
  const settings = { ...api.defaultSettings(), communityWarningsEnabled: true };
  const match = api.matchProfiles(settings, { dois: ['10.5897/article'] })[0];
  assert.equal(match.profileName, 'Academic Journals');
  assert.equal(match.confidence, 'potential');
  const context = api.profileContext(match.profileId);
  assert.match(context.explanation, /Beall’s original publisher list/);
  assert.ok(context.sources.some(source => source.url.includes('oldid=1369144524')));
  assert.equal(api.matchProfiles(settings, { dois: ['10.58971/article'] }).length, 0);
  assert.equal(api.matchProfiles(api.defaultSettings(), { dois: ['10.5897/article'] }).length, 0);
});

test('CiteWatch uses exact structured metadata and retains scope exceptions', () => {
  const settings = { ...api.defaultSettings(), communityWarningsEnabled: true };
  const match = api.matchProfiles(settings, { journalNames: ['Alternative Medicine Review'] })[0];
  assert.equal(match.profileName, 'Alternative Medicine Review');
  assert.equal(match.confidence, 'potential');
  assert.match(api.profileContext(match.profileId).explanation, /Quackwatch/);
  for (const evidence of [
    { journalNames: ['Journal of Management'] }, { journalNames: ['Nucleus'] },
    { journalNames: ['Journal of IMAB'] }, { journalNames: ['AMR'] },
    { journalNames: ['Alternative Medicine Review Supplement'] },
    { text: 'Alternative Medicine Review' }, { dois: ['10.2174/article'] },
    { publisherNames: ['Bentham Science Publishers'] }
  ]) assert.equal(api.matchProfiles(settings, evidence).length, 0, JSON.stringify(evidence));
});

test('CiteWatch respects saved publisher choices and primary work identity', () => {
  const settings = { ...api.defaultSettings(), communityWarningsEnabled: true };
  settings.profiles.push({ id: 'my-academic', name: 'Academic Journals', domains: [], doiPrefixes: ['10.5897'], enabled: false });
  assert.equal(api.matchProfiles(settings, { dois: ['10.5897/article'] }).length, 0);
  assert.equal(api.matchProfiles(settings, { publisherNames: ['Academic Journals'] }).length, 0);
  assert.equal(api.matchProfiles(settings, { primaryDoi: '10.1002/article', dois: ['10.1002/article', '10.5897/other-version'] }).length, 0);
  settings.profiles.push({ ...api.CONCERN_PRESETS[2], enabled: false });
  assert.equal(api.matchProfiles(settings, { dois: ['10.4236/article'] }).length, 0);
  const urlAndDoi = { urls: ['https://academicjournals.org/article'], dois: ['10.5897/article'] };
  assert.equal(api.COMMUNITY_DATA.match(urlAndDoi).length, 1, 'URL coverage avoids a duplicate prefix warning');
});

test('CiteWatch offline parser preserves notes and rejects malformed prefixes', () => {
  const { extractRecords } = require('../scripts/import-citewatch.js');
  const records = extractRecords('{{JCW-selected|Example Journal|doi=10.1234|source=BLJ|note=[[Other Journal|Other]] is a namesake.}}', 'journal');
  assert.deepEqual(records[0].names, ['Example Journal']);
  assert.equal(records[0].note, '[[Other Journal|Other]] is a namesake.');
  assert.throws(() => extractRecords('{{JCW-selected|Example|doi=javascript:alert(1)}}', 'journal'), /Unsupported/);
  assert.throws(() => extractRecords('{{JCW-selected|Example', 'journal'), /Unclosed/);
  assert.equal(extractRecords('<!--{{JCW-selected|Inactive Journal}}--><nowiki>{{JCW-selected|Example syntax}}</nowiki>{{JCW-selected|Active Journal}}', 'journal').length, 1);
});

test('additional CiteWatch prefixes inherit existing named publisher controls', () => {
  const settings = { ...api.defaultSettings(), communityWarningsEnabled: true };
  const match = api.matchProfiles(settings, { dois: ['10.3371/article'] })[0];
  assert.equal(match.profileName, 'OMICS Publishing Group');
  assert.equal(match.confidence, 'potential');
  assert.equal(api.matchProfiles(settings, { dois: ['10.4172/article'] }).length, 1);
  settings.profiles.push({ ...api.CONCERN_PRESETS[0], action: 'dim', color: '#123456', confidencePolicy: 'confirmed-and-potential' });
  assert.equal(api.matchProfiles(settings, { dois: ['10.3371/article'] })[0].action, 'dim');
  assert.equal(api.profileMap(settings).get(match.profileId).color, '#123456');
  settings.profiles[2].confidencePolicy = 'confirmed-only';
  assert.equal(api.matchProfiles(settings, { dois: ['10.3371/article'] }).length, 0);
  settings.profiles[2].enabled = false;
  assert.equal(api.matchProfiles(settings, { dois: ['10.3371/article'] }).length, 0);
});
