'use strict';

;(function exposePublisherProfiles(root, factory) {
  const community = root.NotandiaCommunityPublishing || (typeof module === 'object' && module.exports ? require('./community_publishing.js') : null);
  const api = factory(community);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NotandiaPublisherProfiles = api;
})(typeof globalThis === 'object' ? globalThis : this, community => {
  if (!community) throw new Error('Community publishing runtime failed to load');
  const SCHEMA_VERSION = 2;
  const communityProfilesById = new Map(community.profiles.map(profile => [profile.id, profile]));
  const ACTIONS = Object.freeze(['none', 'badge', 'highlight', 'dim', 'hide']);
  const CONFIDENCE_POLICIES = Object.freeze(['confirmed-only', 'confirmed-and-potential']);
  const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const SAFE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  const SAFE_DOI_PREFIX = /^10\.\d{4,9}(?:\/[A-Za-z0-9._;()/:+-]*)?$/;
  const SAFE_COLOR = /^#[0-9A-F]{6}$/i;

  const BUILTIN_PROFILES = Object.freeze([
    Object.freeze({
      id: 'mdpi',
      name: 'MDPI',
      domains: Object.freeze(['mdpi.com', 'mdpi.org', 'preprints.org']),
      doiPrefixes: Object.freeze(['10.1989', '10.20944', '10.32545', '10.3390', '10.35995']),
      enabled: true,
      action: 'highlight',
      color: '#B45309',
      confidencePolicy: 'confirmed-and-potential',
      source: 'builtin'
    }),
    Object.freeze({
      id: 'frontiers',
      name: 'Frontiers',
      domains: Object.freeze(['frontiersin.org']),
      doiPrefixes: Object.freeze(['10.3389', '10.4175']),
      enabled: true,
      action: 'highlight',
      color: '#7C3AED',
      confidencePolicy: 'confirmed-only',
      source: 'builtin'
    })
  ]);

  const PRESET_CATALOGUE = Object.freeze([
      ['elsevier', 'Elsevier', ['sciencedirect.com', 'elsevier.com', 'cell.com'], ['10.1016']],
      ['springer-nature', 'Springer Nature', ['springer.com', 'springernature.com', 'nature.com', 'biomedcentral.com'], ['10.1007', '10.1038', '10.1186']],
      ['wiley', 'Wiley', ['wiley.com'], ['10.1002', '10.1111']],
      ['taylor-francis', 'Taylor & Francis', ['tandfonline.com', 'taylorfrancis.com'], ['10.1080']],
      ['sage', 'SAGE', ['sagepub.com'], ['10.1177']],
      ['oup', 'Oxford University Press', ['oup.com'], ['10.1093']],
      ['plos', 'PLOS', ['plos.org'], ['10.1371']]
    ].map(([id, name, domains, doiPrefixes]) => Object.freeze({
      id, name, domains: Object.freeze(domains), doiPrefixes: Object.freeze(doiPrefixes),
      enabled: true, action: 'none', color: '#48627A', confidencePolicy: 'confirmed-only', source: 'preset'
    }))
  );

  const CONCERN_PRESETS = Object.freeze([
    ['omics', 'OMICS', ['omicsonline.org'], ['10.4172'], '#0F766E'],
    ['imedpub', 'iMedPub', ['imedpub.com'], [], '#9F1239'],
    ['scirp', 'Scientific Research Publishing (SCIRP)', ['scirp.org'], [], '#4D7C0F'],
    ['bentham-open', 'Bentham Open', ['benthamopen.com', 'benthamopenarchives.com'], [], '#1D4ED8']
  ].map(([id, name, domains, doiPrefixes, color]) => Object.freeze({
    id, name, domains: Object.freeze(domains), doiPrefixes: Object.freeze(doiPrefixes),
    enabled: true, action: 'highlight', color, confidencePolicy: 'confirmed-only', source: 'preset'
  })));

  // Assessments are code-owned and separate from imported user settings.
  // Shared source families are not independent votes or a reliability score.
  function profileContext(id) {
    const reviewed = '2026-10-04';
    if (['mdpi', 'frontiers'].includes(id)) return {
      reviewed, assessment: id === 'frontiers' ? 'Publishing concerns' : 'Journal assessment decisions', sourceFamily: 'national-journal-assessments',
      explanation: id === 'mdpi'
        ? 'Wikipedia’s source guide records concerns about MDPI’s peer review and selectivity. MDPI appeared on Beall’s list in 2014 and was removed in 2015. CiteWatch recommends assessing each journal and paper individually.'
        : 'Frontiers has appeared on Beall’s list since October 2015. CiteWatch recommends assessing each journal and paper individually. Wikipedia’s 2023 discussion includes both case-by-case caution and arguments for a generally unreliable rating.',
      evidence: 'Finland’s Publication Forum downgraded 271 MDPI and Frontiers journals in 2025. Some journals kept their ratings or regained them later. Norway assesses journals individually. The linked sources explain these decisions and their dates.',
      sources: [
        { label: 'Wikipedia CiteWatch: publisher assessments (1 October 2026)', url: 'https://en.wikipedia.org/w/index.php?title=Wikipedia:WikiProject_Academic_Journals/Journals_cited_by_Wikipedia/Questionable1&oldid=1378215500' },
        { label: 'Publication Forum: classification changes', url: 'https://julkaisufoorumi.fi/en/news/changes-classification' },
        { label: 'Norwegian Register: journal-by-journal assessment', url: 'https://kanalregister.hkdir.no/en/aktuelt/new-criteria-for-level-1' },
        ...(id === 'mdpi' ? [{ label: 'Wikipedia assessment: MDPI (dated revision)', url: 'https://en.wikipedia.org/w/index.php?title=Wikipedia:Reliable_sources/Perennial_sources&oldid=1374073585#MDPI' }] : [
          { label: 'Beall’s List: archived publisher list', url: 'https://beallslist.net/' },
          { label: 'Wikipedia: Frontiers discussion (2023)', url: 'https://en.wikipedia.org/w/index.php?title=Wikipedia:Reliable_sources/Noticeboard/Archive_400&oldid=1146984485#RFC:_Frontiers_Media' }
        ])
      ]
    };
    if (['omics', 'imedpub'].includes(id)) return {
      reviewed, assessment: 'Court judgment, 2019', sourceFamily: 'ftc-omics-case',
      explanation: 'In 2019, a US court found that OMICS Group and iMedPub LLC misled authors about peer review, editorial boards and publishing fees.',
      evidence: 'The FTC case documents the publishers’ practices at that time.',
      testUrl: id === 'omics' ? 'https://www.omicsonline.org/open-access/advancing-knowledge-synthesis-with-environmental-variable-associations-125387.html' : 'https://medical-clinical-reviews.imedpub.com/articles/guidelines-for-fertility-preservation-in-gonadotoxic-treatment-patients.php?aid=53283',
      sources: [{ label: 'FTC: OMICS Group case and judgment', url: 'https://search.ftc.gov/legal-library/browse/cases-proceedings/152-3113-omics-group-inc' }]
    };
    if (['scirp', 'bentham-open'].includes(id)) return {
      reviewed, assessment: 'Community publisher list', sourceFamily: 'community-beall-derived',
      explanation: 'This publisher appears in Wikimedia’s community list of predatory publishers, in the edition dated 30 March 2026. Contributors compiled the list from Wikipedia and an updated Beall’s list.',
      evidence: 'Notandia identifies this publisher through its website links.' + (id === 'bentham-open' ? ' The preset includes the Bentham Open archive. Bentham Open and Bentham Science share a DOI prefix, so website links distinguish them.' : ''),
      testUrl: id === 'scirp' ? 'https://www.scirp.org/journal/paperinformation?paperid=152244' : 'https://benthamopenarchives.com/journal-details.php?jid=TOBIOMTJ',
      sources: [{ label: 'Community publisher list (30 March 2026)', url: 'https://meta.wikimedia.org/w/index.php?title=Cite_Unseen/sources/predatory/publishers&oldid=30328516' }]
    };
    return community.context(id);
  }

  function relativeLuminance(color) {
    const channels = normalizeColor(color).slice(1).match(/../g).map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function contrastRatio(foreground, background = '#FFFFFF') {
    const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }

  // Badges have an opaque white background. Keep custom colour accents, but
  // use readable ink when a saved colour cannot meet small-text contrast.
  function readableColor(color) {
    return contrastRatio(color) >= 4.5 ? normalizeColor(color) : '#12263F';
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeDomain(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/^\.+|\.+$/g, '');
    return SAFE_DOMAIN.test(normalized) ? normalized : null;
  }

  function normalizeDoiPrefix(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/^doi\s*:\s*/i, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/\s+/g, '').replace(/\/+$/, '');
    return SAFE_DOI_PREFIX.test(normalized) ? normalized : null;
  }

  function normalizeColor(value, fallback = '#48627A') {
    const normalized = String(value || '').trim().toUpperCase();
    return SAFE_COLOR.test(normalized) ? normalized : fallback;
  }

  function normalizeAction(value, fallback = 'highlight') {
    return ACTIONS.includes(value) ? value : fallback;
  }

  function normalizeConfidencePolicy(value, fallback = 'confirmed-only') {
    return CONFIDENCE_POLICIES.includes(value) ? value : fallback;
  }

  function normalizeProfile(input, { builtin = false, preset = false } = {}) {
    if (!input || typeof input !== 'object') return null;
    const id = String(input.id || '').trim().toLowerCase();
    const name = String(input.name || '').trim().slice(0, 80);
    if (!SAFE_ID.test(id) || !name) return null;
    const domains = Array.from(new Set((Array.isArray(input.domains) ? input.domains : []).map(normalizeDomain).filter(Boolean))).slice(0, 30);
    const doiPrefixes = Array.from(new Set((Array.isArray(input.doiPrefixes) ? input.doiPrefixes : []).map(normalizeDoiPrefix).filter(Boolean))).slice(0, 30);
    if (!domains.length && !doiPrefixes.length) return null;
    return {
      id,
      name,
      domains,
      doiPrefixes,
      enabled: input.enabled !== false,
      action: normalizeAction(input.action),
      color: normalizeColor(input.color),
      confidencePolicy: normalizeConfidencePolicy(input.confidencePolicy),
      source: builtin ? 'builtin' : preset ? 'preset' : 'custom'
    };
  }

  function defaultSettings() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profiles: BUILTIN_PROFILES.map(profile => clone(profile)),
      communityWarningsEnabled: false,
      migratedFromLegacy: false
    };
  }

  function sanitizeSettings(input) {
    const builtins = new Map(BUILTIN_PROFILES.map(profile => [profile.id, clone(profile)]));
    const catalogue = new Map([...PRESET_CATALOGUE, ...CONCERN_PRESETS].map(profile => [profile.id, profile]));
    const output = [];
    const sourceProfiles = Array.isArray(input?.profiles) ? input.profiles : [];
    for (const candidate of sourceProfiles) {
      const builtin = builtins.get(String(candidate?.id || '').toLowerCase());
      if (builtin) {
        output.push(normalizeProfile({ ...builtin, ...candidate, domains: builtin.domains, doiPrefixes: builtin.doiPrefixes }, { builtin: true }));
        builtins.delete(builtin.id);
      } else {
        const preset = candidate?.source === 'preset' && catalogue.get(candidate.id);
        const normalized = preset
          ? normalizeProfile({ ...preset, ...candidate, name: preset.name, domains: preset.domains, doiPrefixes: preset.doiPrefixes }, { preset: true })
          : normalizeProfile(candidate);
        if (normalized) output.push(normalized);
      }
    }
    for (const remaining of builtins.values()) output.push(normalizeProfile(remaining, { builtin: true }));
    return {
      schemaVersion: SCHEMA_VERSION,
      profiles: output.filter(Boolean).slice(0, 50),
      communityWarningsEnabled: input?.communityWarningsEnabled === true,
      migratedFromLegacy: Boolean(input?.migratedFromLegacy)
    };
  }

  function migrateLegacySettings(storage = {}) {
    const existing = storage.publisherWatchlist;
    if (existing && existing.schemaVersion === SCHEMA_VERSION && Array.isArray(existing.profiles)) return sanitizeSettings(existing);
    const settings = defaultSettings();
    const mdpi = settings.profiles.find(profile => profile.id === 'mdpi');
    if (storage.mode === 'hide') mdpi.action = 'hide';
    else if (storage.mode === 'highlight') mdpi.action = 'highlight';
    if (typeof storage.highlightPotentialMdpiSites === 'boolean') {
      mdpi.confidencePolicy = storage.highlightPotentialMdpiSites ? 'confirmed-and-potential' : 'confirmed-only';
    }
    if (storage.potentialMdpiHighlightColor) mdpi.color = normalizeColor(storage.potentialMdpiHighlightColor, mdpi.color);
    settings.migratedFromLegacy = ['hide', 'highlight'].includes(storage.mode) || typeof storage.highlightPotentialMdpiSites === 'boolean' || Boolean(storage.potentialMdpiHighlightColor);
    return settings;
  }

  // The reviewed community rules stay separate from editable profiles. An
  // explicitly saved profile takes precedence, including a disabled choice.
  function configuredProfiles(settings) {
    const sanitized = sanitizeSettings(settings);
    const profiles = sanitized.profiles;
    if (!sanitized.communityWarningsEnabled) return profiles;
    const configured = new Set(profiles.map(profile => profile.id));
    return [...profiles, ...CONCERN_PRESETS.filter(profile => !configured.has(profile.id)).map(profile => ({ ...normalizeProfile(profile, { preset: true }), communityImplicit: true }))];
  }

  function communityOwner(profile, profiles) {
    const names = [profile.name, ...(profile.aliases || [])].map(name => name.toLowerCase().replace(/ \([^)]*\)$/, ''));
    return profiles.find(item => item.id === profile.controlId) || profiles.find(item => names.includes(item.name.toLowerCase().replace(/ \([^)]*\)$/, '')));
  }

  function acceptsCommunityProfile(profile, profiles) {
    if (profiles.some(item => item.id === profile.id)) return false;
    const owner = communityOwner(profile, profiles);
    if (owner && (!owner.enabled || (!owner.communityImplicit && profile.id.startsWith('community-cw-') && owner.confidencePolicy === 'confirmed-only'))) return false;
    // Explicit domain controls override URL-list matches. Matching named
    // controls also supply actions and colours for additional CiteWatch IDs.
    return ![...BUILTIN_PROFILES, ...CONCERN_PRESETS, ...profiles].some(item =>
      item.domains.some(domain => profile.domains.some(host => hostnameMatches(host, domain))) ||
      (item.id !== owner?.id && item.doiPrefixes.some(prefix => profile.doiPrefixes.includes(prefix))));
  }

  function effectiveCommunityProfile(profile, profiles) {
    const owner = communityOwner(profile, profiles);
    return owner ? { ...profile, action: owner.action, color: owner.color } : profile;
  }

  function effectiveProfiles(settings) {
    const sanitized = sanitizeSettings(settings);
    const profiles = configuredProfiles(sanitized);
    if (!sanitized.communityWarningsEnabled) return profiles;
    return [...profiles, ...community.profiles.filter(profile => acceptsCommunityProfile(profile, profiles)).map(profile => effectiveCommunityProfile(profile, profiles))];
  }

  function profileMap(settings) {
    return new Map(effectiveProfiles(settings).map(profile => [profile.id, profile]));
  }

  function publicationType(evidence = {}) {
    const dois = Array.from(new Set((evidence.dois || []).map(doi => String(doi).trim().toLowerCase())));
    const primaryDoi = String(evidence.primaryDoi || (dois.length === 1 ? dois[0] : '')).trim().toLowerCase();
    if (/^10\.20944\/preprints\d/.test(primaryDoi)) return 'preprint';
    if (/^10\.32545\/encyclopedia\d/.test(primaryDoi)) return 'encyclopedia-entry';
    if (!dois.length && (evidence.hostnames || []).some(host => hostnameMatches(host, 'preprints.org'))) return 'preprint';
    return null;
  }

  function publicationTypeLabel(type) {
    if (type === 'preprint') return 'Preprint';
    if (type === 'encyclopedia-entry') return 'Encyclopedia entry';
    return '';
  }

  function matchContext(profile, match) {
    if (!profile || !['builtin', 'preset', 'community'].includes(profile.source)) return null;
    if (profile.id === 'mdpi' && match?.publicationType === 'preprint') return {
      reviewed: '2026-10-04', assessment: 'Preprint', sourceFamily: 'preprints-platform',
      explanation: 'Preprints.org shares early research before peer review. The platform is supported by MDPI.',
      evidence: 'Check the article page for a published journal version.',
      sources: [{ label: 'Preprints.org: about the platform', url: 'https://www.preprints.org/about' }]
    };
    if (profile.id === 'mdpi' && match?.publicationType === 'encyclopedia-entry') return {
      reviewed: '2026-10-04', assessment: 'Encyclopedia entry', sourceFamily: 'crossref-work-type',
      explanation: 'This DOI identifies an entry posted through MDPI’s Encyclopedia platform.', evidence: '',
      sources: [{ label: 'Crossref: Encyclopedia prefix records', url: 'https://api.crossref.org/prefixes/10.32545/works' }]
    };
    return profileContext(profile.id);
  }

  function hostnameMatches(hostname, domain) {
    const host = String(hostname || '').trim().toLowerCase().replace(/^www\./, '');
    const target = normalizeDomain(domain);
    return Boolean(target && (host === target || host.endsWith(`.${target}`)));
  }

  function doiMatches(doi, prefix) {
    const normalizedDoi = String(doi || '').trim().toLowerCase();
    const normalizedPrefix = normalizeDoiPrefix(prefix);
    if (!normalizedPrefix) return false;
    return normalizedDoi === normalizedPrefix || normalizedDoi.startsWith(`${normalizedPrefix}/`);
  }

  function matchProfile(profile, evidence = {}) {
    const normalized = normalizeProfile(profile, { builtin: profile?.source === 'builtin', preset: profile?.source === 'preset' });
    if (!normalized || !normalized.enabled) return null;
    const reasons = [];
    const hostnames = Array.isArray(evidence.hostnames) ? evidence.hostnames : [];
    const dois = Array.isArray(evidence.dois) ? evidence.dois : [];
    for (const hostname of hostnames) {
      if (normalized.domains.some(domain => hostnameMatches(hostname, domain))) {
        reasons.push('publisher-domain');
        break;
      }
    }
    for (const doi of dois) {
      if (normalized.doiPrefixes.some(prefix => doiMatches(doi, prefix))) {
        reasons.push('doi-prefix');
        break;
      }
    }
    let confidence = 'confirmed';
    if (!reasons.length) {
      const journalHint = normalized.id === 'mdpi' && normalized.source === 'builtin' &&
        Array.isArray(evidence.profileSignals) && evidence.profileSignals.some(signal => signal?.profileId === 'mdpi' &&
          signal.confidence === 'potential' && signal.reason === 'journal-name');
      if (!journalHint) return null;
      reasons.push('journal-name');
      confidence = 'potential';
    }
    if (confidence === 'potential' && normalized.confidencePolicy !== 'confirmed-and-potential') return null;
    return {
      profileId: normalized.id,
      profileName: normalized.name,
      confidence,
      reasons,
      action: normalized.action,
      color: normalized.color,
      ...(normalized.id === 'mdpi' && normalized.source === 'builtin' && publicationType(evidence)
        ? { publicationType: publicationType(evidence) } : {})
    };
  }

  function matchProfiles(settings, evidence) {
    const sanitized = sanitizeSettings(settings);
    const profiles = configuredProfiles(sanitized);
    const matches = profiles.map(profile => matchProfile(profile, evidence)).filter(Boolean);
    if (!sanitized.communityWarningsEnabled) return matches;
    const communityMatches = community.match(evidence).flatMap(match => {
      const profile = communityProfilesById.get(match.profileId);
      if (!acceptsCommunityProfile(profile, profiles)) return [];
      const owner = communityOwner(profile, profiles);
      if (owner && matches.some(existing => existing.profileId === owner.id)) return [];
      const effective = effectiveCommunityProfile(profile, profiles);
      return [{ ...match, action: effective.action, color: effective.color }];
    });
    return [...matches, ...communityMatches];
  }

  function actionPriority(action) {
    return { none: 0, badge: 1, highlight: 2, dim: 3, hide: 4 }[action] || 0;
  }

  function resolveVisualMatch(matches) {
    const list = Array.isArray(matches) ? matches : [];
    return list.slice().sort((a, b) => actionPriority(b.action) - actionPriority(a.action) || String(a.profileId).localeCompare(String(b.profileId)))[0] || null;
  }

  return Object.freeze({
    ACTIONS,
    BUILTIN_PROFILES,
    PRESET_CATALOGUE,
    CONCERN_PRESETS,
    COMMUNITY_DATA: community,
    CONFIDENCE_POLICIES,
    SCHEMA_VERSION,
    contrastRatio,
    defaultSettings,
    effectiveProfiles,
    doiMatches,
    hostnameMatches,
    matchProfile,
    matchProfiles,
    matchContext,
    migrateLegacySettings,
    normalizeAction,
    normalizeColor,
    normalizeConfidencePolicy,
    normalizeDomain,
    normalizeDoiPrefix,
    normalizeProfile,
    profileMap,
    profileContext,
    publicationType,
    publicationTypeLabel,
    readableColor,
    resolveVisualMatch,
    sanitizeSettings
  });
});
