'use strict';

;(function exposePublisherProfiles(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NotandiaPublisherProfiles = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const SCHEMA_VERSION = 2;
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
      domains: Object.freeze(['mdpi.com', 'mdpi.org']),
      doiPrefixes: Object.freeze(['10.3390']),
      enabled: true,
      action: 'highlight',
      color: '#E2211C',
      confidencePolicy: 'confirmed-and-potential',
      source: 'builtin'
    }),
    Object.freeze({
      id: 'frontiers',
      name: 'Frontiers',
      domains: Object.freeze(['frontiersin.org']),
      doiPrefixes: Object.freeze(['10.3389']),
      enabled: true,
      action: 'highlight',
      color: '#0B78B5',
      confidencePolicy: 'confirmed-only',
      source: 'builtin'
    })
  ]);

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

  function normalizeProfile(input, { builtin = false } = {}) {
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
      source: builtin ? 'builtin' : 'custom'
    };
  }

  function defaultSettings() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profiles: BUILTIN_PROFILES.map(profile => clone(profile)),
      migratedFromLegacy: false
    };
  }

  function sanitizeSettings(input) {
    const builtins = new Map(BUILTIN_PROFILES.map(profile => [profile.id, clone(profile)]));
    const output = [];
    const sourceProfiles = Array.isArray(input?.profiles) ? input.profiles : [];
    for (const candidate of sourceProfiles) {
      const builtin = builtins.get(String(candidate?.id || '').toLowerCase());
      if (builtin) {
        output.push(normalizeProfile({ ...builtin, ...candidate, domains: builtin.domains, doiPrefixes: builtin.doiPrefixes }, { builtin: true }));
        builtins.delete(builtin.id);
      } else {
        const normalized = normalizeProfile(candidate);
        if (normalized) output.push(normalized);
      }
    }
    for (const remaining of builtins.values()) output.push(normalizeProfile(remaining, { builtin: true }));
    return {
      schemaVersion: SCHEMA_VERSION,
      profiles: output.filter(Boolean).slice(0, 50),
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
    settings.migratedFromLegacy = Boolean(Object.hasOwn(storage, 'mode') || Object.hasOwn(storage, 'highlightPotentialMdpiSites'));
    return settings;
  }

  function profileMap(settings) {
    return new Map(sanitizeSettings(settings).profiles.map(profile => [profile.id, profile]));
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
    const normalized = normalizeProfile(profile, { builtin: profile?.source === 'builtin' });
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
    if (!reasons.length) return null;
    const confidence = 'confirmed';
    if (confidence === 'potential' && normalized.confidencePolicy !== 'confirmed-and-potential') return null;
    return {
      profileId: normalized.id,
      profileName: normalized.name,
      confidence,
      reasons,
      action: normalized.action,
      color: normalized.color
    };
  }

  function matchProfiles(settings, evidence) {
    return sanitizeSettings(settings).profiles.map(profile => matchProfile(profile, evidence)).filter(Boolean);
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
    CONFIDENCE_POLICIES,
    SCHEMA_VERSION,
    defaultSettings,
    doiMatches,
    hostnameMatches,
    matchProfile,
    matchProfiles,
    migrateLegacySettings,
    normalizeAction,
    normalizeColor,
    normalizeConfidencePolicy,
    normalizeDomain,
    normalizeDoiPrefix,
    normalizeProfile,
    profileMap,
    resolveVisualMatch,
    sanitizeSettings
  });
});
