'use strict';

;(function exposePublisherProfiles(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NotandiaPublisherProfiles = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const SCHEMA_VERSION = 2;
  const ACTIONS = Object.freeze(['none', 'badge', 'highlight', 'dim', 'hide']);
  const CONFIDENCE_POLICIES = Object.freeze(['verified-only', 'include-potential']);
  const ACTION_PRIORITY = Object.freeze({ none: 0, badge: 1, highlight: 2, dim: 3, hide: 4 });
  const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const SAFE_COLOR = /^#[0-9a-f]{6}$/i;
  const SAFE_DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  const SAFE_DOI_PREFIX = /^10\.\d{4,9}$/;

  const BUILTIN_PROFILES = Object.freeze([
    Object.freeze({
      id: 'mdpi',
      name: 'MDPI',
      domains: Object.freeze(['mdpi.com', 'mdpi.org']),
      doiPrefixes: Object.freeze(['10.3390']),
      enabled: true,
      action: 'highlight',
      color: '#E2211C',
      potentialColor: '#F79009',
      confidencePolicy: 'verified-only',
      source: 'builtin'
    }),
    Object.freeze({
      id: 'frontiers',
      name: 'Frontiers',
      domains: Object.freeze(['frontiersin.org']),
      doiPrefixes: Object.freeze(['10.3389']),
      enabled: true,
      action: 'highlight',
      color: '#B54708',
      potentialColor: '#F79009',
      confidencePolicy: 'verified-only',
      source: 'builtin'
    })
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeDomain(value) {
    let domain = String(value || '').trim().toLowerCase();
    if (!domain) return null;
    try {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(domain)) domain = new URL(domain).hostname;
    } catch {
      return null;
    }
    domain = domain.replace(/^\*\./, '').replace(/^www\./, '').replace(/\.$/, '');
    return SAFE_DOMAIN.test(domain) ? domain : null;
  }

  function normalizeDoiPrefix(value) {
    const prefix = String(value || '').trim().toLowerCase().replace(/^doi\s*:\s*/i, '').replace(/\/$/, '');
    return SAFE_DOI_PREFIX.test(prefix) ? prefix : null;
  }

  function normalizeDoi(value) {
    if (typeof value !== 'string') return null;
    let normalized = value.trim();
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Keep malformed percent-encoded input unchanged.
    }
    normalized = normalized
      .replace(/^doi\s*:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
    return /^10\.\d{4,9}\/[\w.()/:;+-]+$/i.test(normalized) ? normalized : null;
  }

  function uniqueValid(values, normalizer, limit) {
    const output = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
      const normalized = normalizer(value);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      output.push(normalized);
      if (output.length >= limit) break;
    }
    return output;
  }

  function normalizeProfile(profile, fallback = {}) {
    if (!profile || typeof profile !== 'object') return null;
    const rawId = String(profile.id || fallback.id || '').trim().toLowerCase();
    if (!SAFE_ID.test(rawId)) return null;
    const name = String(profile.name || fallback.name || rawId).trim().slice(0, 80);
    if (!name) return null;
    const source = profile.source === 'builtin' || fallback.source === 'builtin' ? 'builtin' : 'custom';
    const action = ACTIONS.includes(profile.action) ? profile.action : (ACTIONS.includes(fallback.action) ? fallback.action : 'highlight');
    const confidencePolicy = CONFIDENCE_POLICIES.includes(profile.confidencePolicy)
      ? profile.confidencePolicy
      : (CONFIDENCE_POLICIES.includes(fallback.confidencePolicy) ? fallback.confidencePolicy : 'verified-only');
    const color = SAFE_COLOR.test(String(profile.color || ''))
      ? String(profile.color).toUpperCase()
      : (SAFE_COLOR.test(String(fallback.color || '')) ? String(fallback.color).toUpperCase() : '#48627A');
    const potentialColor = SAFE_COLOR.test(String(profile.potentialColor || ''))
      ? String(profile.potentialColor).toUpperCase()
      : (SAFE_COLOR.test(String(fallback.potentialColor || '')) ? String(fallback.potentialColor).toUpperCase() : '#F79009');
    const domains = uniqueValid(profile.domains ?? fallback.domains, normalizeDomain, 20);
    const doiPrefixes = uniqueValid(profile.doiPrefixes ?? fallback.doiPrefixes, normalizeDoiPrefix, 20);
    if (!domains.length && !doiPrefixes.length) return null;
    return {
      id: rawId,
      name,
      domains,
      doiPrefixes,
      enabled: profile.enabled !== false,
      action,
      color,
      potentialColor,
      confidencePolicy,
      source
    };
  }

  function defaultProfiles() {
    return BUILTIN_PROFILES.map(profile => clone(profile));
  }

  function createDefaultSettings() {
    return { schemaVersion: SCHEMA_VERSION, profiles: defaultProfiles() };
  }

  function normalizeSettings(value) {
    const supplied = value && typeof value === 'object' ? value : {};
    const suppliedProfiles = Array.isArray(supplied.profiles) ? supplied.profiles : [];
    const normalizedById = new Map();

    for (const builtin of BUILTIN_PROFILES) {
      const override = suppliedProfiles.find(profile => profile?.id === builtin.id);
      normalizedById.set(builtin.id, normalizeProfile(override || builtin, builtin));
    }

    for (const profile of suppliedProfiles) {
      if (profile?.source === 'builtin' || normalizedById.has(profile?.id)) continue;
      const normalized = normalizeProfile({ ...profile, source: 'custom' });
      if (normalized && normalizedById.size < 52) normalizedById.set(normalized.id, normalized);
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      profiles: Array.from(normalizedById.values()).filter(Boolean)
    };
  }

  function migratePublisherSettings(storage = {}) {
    if (storage.publisherProfiles && typeof storage.publisherProfiles === 'object') {
      return normalizeSettings(storage.publisherProfiles);
    }

    const defaults = createDefaultSettings();
    const mdpi = defaults.profiles.find(profile => profile.id === 'mdpi');
    mdpi.action = storage.mode === 'hide' ? 'hide' : 'highlight';
    mdpi.confidencePolicy = storage.highlightPotentialMdpiSites === true ? 'include-potential' : 'verified-only';
    if (SAFE_COLOR.test(String(storage.potentialMdpiHighlightColor || ''))) {
      mdpi.potentialColor = String(storage.potentialMdpiHighlightColor).toUpperCase();
    }
    return defaults;
  }

  function domainMatches(hostname, domain) {
    const host = normalizeDomain(hostname);
    const target = normalizeDomain(domain);
    return Boolean(host && target && (host === target || host.endsWith(`.${target}`)));
  }

  function extractHostname(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : null;
    } catch {
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function matchProfile(profile, evidence = {}) {
    if (!profile?.enabled) return null;
    const reasons = [];
    const doi = normalizeDoi(evidence.doi || '');
    if (doi && profile.doiPrefixes.some(prefix => doi.startsWith(`${prefix}/`))) reasons.push('doi-prefix');

    const urls = Array.isArray(evidence.urls) ? evidence.urls : [];
    for (const value of urls.slice(0, 40)) {
      const hostname = extractHostname(value);
      if (hostname && profile.domains.some(domain => domainMatches(hostname, domain))) {
        reasons.push('publisher-domain');
        break;
      }
    }

    if (reasons.length) {
      return {
        profileId: profile.id,
        name: profile.name,
        confidence: 'confirmed',
        reasons: Array.from(new Set(reasons)),
        action: profile.action,
        color: profile.color,
        source: profile.source
      };
    }

    if (profile.confidencePolicy !== 'include-potential') return null;
    const haystack = normalizeText(`${evidence.publisher || ''} ${evidence.text || ''}`);
    const needle = normalizeText(profile.name);
    if (!needle || !new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`, 'i').test(haystack)) return null;
    return {
      profileId: profile.id,
      name: profile.name,
      confidence: 'potential',
      reasons: ['publisher-name'],
      action: profile.action,
      color: profile.potentialColor,
      source: profile.source
    };
  }

  function matchProfiles(settings, evidence = {}) {
    const normalized = normalizeSettings(settings);
    return normalized.profiles.map(profile => matchProfile(profile, evidence)).filter(Boolean);
  }

  function resolvePresentation(matches) {
    const list = Array.isArray(matches) ? matches : [];
    const actionable = list.filter(match => ACTIONS.includes(match?.action));
    if (!actionable.length) return { action: 'none', color: '#48627A', profileId: null };
    const sorted = [...actionable].sort((a, b) => {
      const priority = ACTION_PRIORITY[b.action] - ACTION_PRIORITY[a.action];
      return priority || String(a.profileId).localeCompare(String(b.profileId));
    });
    return { action: sorted[0].action, color: sorted[0].color, profileId: sorted[0].profileId };
  }

  function customProfileFromInput(input, existingIds = []) {
    const name = String(input?.name || '').trim().slice(0, 80);
    if (!name) return { profile: null, error: 'A publisher name is required.' };
    const base = normalizeText(name).replace(/\s+/g, '-').slice(0, 48) || 'publisher';
    let id = `custom-${base}`.replace(/[^a-z0-9-]/g, '');
    let suffix = 2;
    const used = new Set(existingIds);
    while (used.has(id)) id = `custom-${base}-${suffix++}`.slice(0, 64);
    const domains = uniqueValid(input.domains, normalizeDomain, 20);
    const doiPrefixes = uniqueValid(input.doiPrefixes, normalizeDoiPrefix, 20);
    if (!domains.length && !doiPrefixes.length) {
      return { profile: null, error: 'Add at least one valid publisher domain or DOI prefix.' };
    }
    return {
      profile: normalizeProfile({
        id,
        name,
        domains,
        doiPrefixes,
        enabled: true,
        action: ACTIONS.includes(input.action) ? input.action : 'highlight',
        color: SAFE_COLOR.test(String(input.color || '')) ? input.color : '#48627A',
        potentialColor: '#F79009',
        confidencePolicy: CONFIDENCE_POLICIES.includes(input.confidencePolicy) ? input.confidencePolicy : 'verified-only',
        source: 'custom'
      }),
      error: null
    };
  }

  function enabledProfileIds(settings) {
    return normalizeSettings(settings).profiles.filter(profile => profile.enabled).map(profile => profile.id);
  }

  function exportSettings(settings) {
    return JSON.stringify(normalizeSettings(settings), null, 2);
  }

  return Object.freeze({
    ACTIONS,
    BUILTIN_PROFILES,
    CONFIDENCE_POLICIES,
    SCHEMA_VERSION,
    createDefaultSettings,
    customProfileFromInput,
    domainMatches,
    enabledProfileIds,
    exportSettings,
    matchProfile,
    matchProfiles,
    migratePublisherSettings,
    normalizeDoi,
    normalizeDoiPrefix,
    normalizeDomain,
    normalizeProfile,
    normalizeSettings,
    resolvePresentation
  });
});
