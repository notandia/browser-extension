'use strict';

if (typeof importScripts === 'function') {
  if (!globalThis.NotandiaPublisherProfiles) importScripts('shared/publisher_profiles.js');
  if (!globalThis.MDPIIntegrity) importScripts('shared/integrity.js');
}

const publisherApi = globalThis.NotandiaPublisherProfiles;
const integrityApi = globalThis.MDPIIntegrity;
if (!publisherApi) throw new Error('Publisher profile runtime failed to load');
if (!integrityApi) throw new Error('Integrity runtime failed to load');

const {
  STATUS_DEFINITIONS,
  badgeForSummary,
  createStartRateLimiter,
  derivePrimaryStatus,
  normalizeCrossrefEvents,
  normalizeCrossrefUpdateRecords,
  normalizeDOI,
  summarizeIntegrityRecords
} = integrityApi;

const tabData = new Map();
const legacyBadgeData = new Map();
const integrityTabData = new Map();
const publisherTabData = new Map();
const integrityCache = new Map();
const activeIntegrityScans = new Map();
let publisherSettings = publisherApi.defaultSettings();

const MAX_REFERENCES_PER_TAB = 500;
const MAX_REFERENCE_TEXT_LENGTH = 1000;
const MAX_INTEGRITY_REFERENCES = 250;
const MAX_INTEGRITY_LOOKUPS_PER_SCAN = 50;
const CROSSREF_CONCURRENCY = 2;
const CROSSREF_TIMEOUT_MS = 10000;
const CROSSREF_CACHE_MS = 24 * 60 * 60 * 1000;
const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
const SAFE_PROFILE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_COLOR = /^#[0-9A-F]{6}$/i;
const waitForCrossrefStart = createStartRateLimiter(250);

function normalizeReference(reference) {
  if (!reference || typeof reference !== 'object') return null;
  if (typeof reference.id !== 'string' || !SAFE_REFERENCE_ID.test(reference.id)) return null;
  if (typeof reference.text !== 'string') return null;
  const normalized = { id: reference.id, text: reference.text.slice(0, MAX_REFERENCE_TEXT_LENGTH) };
  if (Number.isFinite(reference.number)) normalized.number = Math.max(1, Math.trunc(reference.number));
  const doi = normalizeDOI(reference.doi || '');
  if (doi) normalized.doi = doi;
  if (typeof reference.listItemDomId === 'string' && SAFE_REFERENCE_ID.test(reference.listItemDomId)) {
    normalized.listItemDomId = reference.listItemDomId;
  }
  return normalized;
}

function normalizeReferences(references) {
  if (!Array.isArray(references)) return [];
  const unique = new Map();
  for (const reference of references.slice(0, MAX_REFERENCES_PER_TAB)) {
    const normalized = normalizeReference(reference);
    if (!normalized) continue;
    const key = normalized.doi ? `doi:${normalized.doi}` : `${normalized.id}\u0000${normalized.text}`;
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return Array.from(unique.values());
}

function normalizeIntegrityInput(data) {
  const unique = new Map();
  const pageDoi = normalizeDOI(data?.pageDoi || '');
  if (pageDoi) unique.set(pageDoi, { id: 'current-article', kind: 'current-article', number: null, doi: pageDoi, text: 'Current article' });
  const references = Array.isArray(data?.references) ? data.references : [];
  for (const reference of references.slice(0, MAX_INTEGRITY_REFERENCES)) {
    if (!reference || typeof reference !== 'object') continue;
    const doi = normalizeDOI(reference.doi || '');
    if (!doi || unique.has(doi)) continue;
    const id = typeof reference.id === 'string' && SAFE_REFERENCE_ID.test(reference.id)
      ? reference.id
      : `integrity-ref-${unique.size + 1}`;
    unique.set(doi, {
      id,
      kind: 'reference',
      number: Number.isFinite(reference.number) ? Math.max(1, Math.trunc(reference.number)) : null,
      doi,
      text: String(reference.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_REFERENCE_TEXT_LENGTH)
    });
  }
  return Array.from(unique.values());
}

function currentProfileMap() {
  return publisherApi.profileMap(publisherSettings);
}

function normalizePublisherMatch(match) {
  if (!match || typeof match !== 'object') return null;
  const profileId = String(match.profileId || '').trim().toLowerCase();
  if (!SAFE_PROFILE_ID.test(profileId)) return null;
  const profile = currentProfileMap().get(profileId);
  if (!profile?.enabled) return null;
  const reasons = Array.isArray(match.reasons)
    ? match.reasons.map(value => String(value).slice(0, 40)).filter(value => /^[a-z0-9-]+$/i.test(value)).slice(0, 6)
    : [];
  return {
    profileId,
    profileName: profile.name,
    confidence: match.confidence === 'potential' ? 'potential' : 'confirmed',
    reasons,
    action: profile.action,
    color: profile.color
  };
}

function normalizePublisherRecord(record, index, kind) {
  if (!record || typeof record !== 'object') return null;
  const id = typeof record.id === 'string' && SAFE_REFERENCE_ID.test(record.id)
    ? record.id
    : `notandia-${kind}-${index + 1}`;
  const matches = Array.isArray(record.matches) ? record.matches.map(normalizePublisherMatch).filter(Boolean) : [];
  if (!matches.length) return null;
  return {
    id,
    kind,
    number: Number.isFinite(record.number) ? Math.max(1, Math.trunc(record.number)) : index + 1,
    doi: normalizeDOI(record.doi || ''),
    text: String(record.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_REFERENCE_TEXT_LENGTH),
    matches
  };
}

function summarizePublisherContext(report) {
  const records = [report.currentArticle, ...(report.references || []), ...(report.searchResults || [])].filter(Boolean);
  const actionable = records.filter(record => (record.matches || []).some(match => match.action !== 'none'));
  const allMatches = records.flatMap(record => record.matches || []);
  const visual = publisherApi.resolveVisualMatch(allMatches);
  const profileCounts = {};
  for (const match of allMatches) profileCounts[match.profileId] = (profileCounts[match.profileId] || 0) + 1;
  return {
    matchedItems: records.filter(record => (record.matches || []).length).length,
    actionableItems: actionable.length,
    primaryColor: visual?.color || '#48627A',
    profileCounts
  };
}

function normalizePublisherContext(data) {
  const currentMatches = Array.isArray(data?.currentArticle?.matches)
    ? data.currentArticle.matches.map(normalizePublisherMatch).filter(Boolean)
    : [];
  const report = {
    currentArticle: currentMatches.length ? {
      id: 'current-article', kind: 'current-article', number: null,
      doi: normalizeDOI(data?.currentArticle?.doi || ''), text: 'Current article', matches: currentMatches
    } : null,
    references: (Array.isArray(data?.references) ? data.references : []).slice(0, MAX_INTEGRITY_REFERENCES)
      .map((record, index) => normalizePublisherRecord(record, index, 'reference')).filter(Boolean),
    searchResults: (Array.isArray(data?.searchResults) ? data.searchResults : []).slice(0, MAX_INTEGRITY_REFERENCES)
      .map((record, index) => normalizePublisherRecord(record, index, 'search-result')).filter(Boolean),
    updatedAt: new Date().toISOString()
  };
  report.summary = summarizePublisherContext(report);
  return report;
}

function mergeLegacyMdpiContext(tabId, references) {
  if (!Number.isInteger(tabId)) return;
  const mdpi = currentProfileMap().get('mdpi');
  if (!mdpi?.enabled) return;
  const report = publisherTabData.get(tabId) || { currentArticle: null, references: [], searchResults: [], updatedAt: new Date().toISOString() };
  const byKey = new Map((report.references || []).map(record => [record.doi ? `doi:${record.doi}` : `id:${record.id}`, record]));
  for (const [index, reference] of (Array.isArray(references) ? references : []).entries()) {
    const key = reference.doi ? `doi:${reference.doi}` : `id:${reference.id}`;
    const existing = byKey.get(key) || {
      id: reference.id,
      kind: 'reference',
      number: Number.isFinite(reference.number) ? reference.number : index + 1,
      doi: reference.doi || null,
      text: reference.text,
      matches: []
    };
    if (!existing.matches.some(match => match.profileId === 'mdpi')) {
      existing.matches.push({
        profileId: 'mdpi', profileName: mdpi.name, confidence: 'confirmed',
        reasons: ['legacy-mdpi-detector'], action: mdpi.action, color: mdpi.color
      });
    }
    byKey.set(key, existing);
  }
  report.references = Array.from(byKey.values());
  report.updatedAt = new Date().toISOString();
  report.summary = summarizePublisherContext(report);
  publisherTabData.set(tabId, report);
}

function setBadge(tabId, count, color = '#48627A', title = 'Notandia') {
  if (!Number.isInteger(tabId)) return;
  const numericCount = Number.isFinite(count) ? Math.max(0, Math.min(999, Math.trunc(count))) : 0;
  const safeColor = typeof color === 'string' && SAFE_COLOR.test(color) ? color : '#48627A';
  chrome.action.setBadgeText({ tabId, text: numericCount ? String(numericCount) : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: safeColor });
  chrome.action.setTitle({ tabId, title: String(title || 'Notandia').slice(0, 200) });
}

function refreshBadge(tabId) {
  if (!Number.isInteger(tabId)) return;
  const integrity = integrityTabData.get(tabId);
  if (integrity?.summary?.affected > 0) {
    const badge = badgeForSummary(integrity.summary);
    setBadge(tabId, badge.count, badge.color, badge.title);
    return;
  }
  const publisher = publisherTabData.get(tabId);
  if (publisher?.summary?.actionableItems > 0) {
    const count = publisher.summary.actionableItems;
    setBadge(tabId, count, publisher.summary.primaryColor, `${count} publisher watchlist match${count === 1 ? '' : 'es'}`);
    return;
  }
  const mdpiEnabled = currentProfileMap().get('mdpi')?.enabled;
  const legacy = legacyBadgeData.get(tabId);
  setBadge(tabId, mdpiEnabled ? (legacy?.count || 0) : 0, legacy?.color || '#48627A', 'Notandia');
}

function cancelIntegrityScan(tabId) {
  const scan = activeIntegrityScans.get(tabId);
  if (!scan) return;
  scan.cancelled = true;
  for (const controller of scan.controllers) controller.abort();
  scan.controllers.clear();
  activeIntegrityScans.delete(tabId);
}

function clearTabData(tabId) {
  cancelIntegrityScan(tabId);
  tabData.delete(tabId);
  legacyBadgeData.delete(tabId);
  integrityTabData.delete(tabId);
  publisherTabData.delete(tabId);
  setBadge(tabId, 0);
}

function storeTabReferences(tabId, references, requestedCount, color) {
  if (!Number.isInteger(tabId)) return [];
  const normalized = normalizeReferences(references);
  tabData.set(tabId, normalized);
  legacyBadgeData.set(tabId, {
    count: Number.isFinite(requestedCount) ? Math.max(0, Math.trunc(requestedCount)) : normalized.length,
    color: typeof color === 'string' && SAFE_COLOR.test(color) ? color : '#E2211C'
  });
  mergeLegacyMdpiContext(tabId, normalized);
  refreshBadge(tabId);
  return normalized;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function hasIntegrityTransmissionConsent() {
  const optional = chrome.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional;
  if (!Array.isArray(optional) || !optional.includes('websiteContent')) return true;
  if (!globalThis.browser?.permissions) return false;
  try {
    const permissions = await browser.permissions.getAll();
    return Array.isArray(permissions.data_collection) && permissions.data_collection.includes('websiteContent');
  } catch {
    return false;
  }
}

async function fetchCrossrefJson(url, controller) {
  await waitForCrossrefStart();
  const response = await fetch(url, {
    method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' }, signal: controller.signal
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Crossref returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('json')) throw new Error('Crossref returned a non-JSON response');
  return response.json();
}

async function fetchCrossrefRecord(doi, scan) {
  const cached = integrityCache.get(doi);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (scan.cancelled) return { lookupStatus: 'cancelled', events: [] };
  const controller = new AbortController();
  scan.controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), CROSSREF_TIMEOUT_MS);
  try {
    const singletonPayload = await fetchCrossrefJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, controller);
    if (scan.cancelled) return { lookupStatus: 'cancelled', events: [] };
    let events = normalizeCrossrefEvents(singletonPayload?.message);
    if (!events.length) {
      const updatesPayload = await fetchCrossrefJson(`https://api.crossref.org/works?filter=updates:${encodeURIComponent(doi)}&rows=100`, controller);
      events = normalizeCrossrefUpdateRecords(updatesPayload?.message?.items, doi);
    }
    const value = { lookupStatus: singletonPayload || events.length ? 'checked' : 'not-found', events };
    integrityCache.set(doi, { expiresAt: Date.now() + CROSSREF_CACHE_MS, value });
    return value;
  } catch (error) {
    if (scan.cancelled || error?.name === 'AbortError') return { lookupStatus: 'cancelled', events: [] };
    return { lookupStatus: 'failed', events: [], error: error instanceof Error ? error.message.slice(0, 160) : 'Crossref lookup failed' };
  } finally {
    clearTimeout(timeout);
    scan.controllers.delete(controller);
  }
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
}

async function processIntegrityScan(tabId, data) {
  if (!Number.isInteger(tabId)) return;
  cancelIntegrityScan(tabId);
  const scan = { cancelled: false, controllers: new Set() };
  activeIntegrityScans.set(tabId, scan);
  const input = normalizeIntegrityInput(data);
  const attempted = input.slice(0, MAX_INTEGRITY_LOOKUPS_PER_SCAN);
  integrityTabData.set(tabId, {
    state: input.length ? 'loading' : 'ready', provider: 'Crossref + Retraction Watch',
    totalDiscovered: input.length, attempted: attempted.length,
    notChecked: Math.max(0, input.length - attempted.length),
    records: attempted.map(record => ({ ...record, lookupStatus: 'pending', events: [], primaryStatus: null })),
    summary: summarizeIntegrityRecords([], input.length), updatedAt: new Date().toISOString()
  });
  refreshBadge(tabId);
  if (!attempted.length) {
    activeIntegrityScans.delete(tabId);
    chrome.runtime.sendMessage({ type: 'integrityReportUpdated', tabId }, () => void chrome.runtime.lastError);
    return;
  }
  const records = await mapWithConcurrency(attempted, CROSSREF_CONCURRENCY, async record => {
    if (scan.cancelled) return { ...record, lookupStatus: 'cancelled', events: [], primaryStatus: null };
    const lookup = await fetchCrossrefRecord(record.doi, scan);
    const events = Array.isArray(lookup.events) ? lookup.events : [];
    return { ...record, lookupStatus: lookup.lookupStatus, error: lookup.error, events, primaryStatus: derivePrimaryStatus(events) };
  });
  if (scan.cancelled || activeIntegrityScans.get(tabId) !== scan) return;
  activeIntegrityScans.delete(tabId);
  const visibleRecords = records.filter(record => record.lookupStatus !== 'cancelled');
  integrityTabData.set(tabId, {
    state: 'ready', provider: 'Crossref + Retraction Watch',
    totalDiscovered: input.length, attempted: attempted.length,
    notChecked: Math.max(0, input.length - attempted.length), records: visibleRecords,
    summary: summarizeIntegrityRecords(visibleRecords, input.length), updatedAt: new Date().toISOString()
  });
  refreshBadge(tabId);
  chrome.runtime.sendMessage({ type: 'integrityReportUpdated', tabId }, () => void chrome.runtime.lastError);
}

function refreshPublisherSettings() {
  chrome.storage.sync.get({
    publisherWatchlist: null,
    mode: 'highlight',
    highlightPotentialMdpiSites: true,
    potentialMdpiHighlightColor: '#E2211C'
  }, stored => {
    if (chrome.runtime.lastError) return;
    publisherSettings = publisherApi.migrateLegacySettings(stored);
    if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== publisherApi.SCHEMA_VERSION) {
      chrome.storage.sync.set({ publisherWatchlist: publisherSettings });
    }
    for (const tabId of publisherTabData.keys()) {
      const report = publisherTabData.get(tabId);
      publisherTabData.set(tabId, normalizePublisherContext(report || {}));
      mergeLegacyMdpiContext(tabId, tabData.get(tabId) || []);
      refreshBadge(tabId);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
  const tabId = sender.tab?.id;

  if (message.type === 'mdpiUpdate') {
    const data = message.data || {};
    const references = Array.isArray(data.references) ? data.references : [];
    const count = Number.isFinite(data.badgeCount) ? data.badgeCount : (Number.isFinite(data.count) ? data.count : references.length);
    storeTabReferences(tabId, references, count, data.color);
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.action === 'updateBadge') {
    if (Number.isInteger(tabId)) {
      legacyBadgeData.set(tabId, { count: Number(message.count) || 0, color: message.color });
      refreshBadge(tabId);
    }
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.action === 'updateReferences') {
    if (Number.isInteger(tabId)) {
      const normalized = storeTabReferences(tabId, message.references, message.references?.length, message.color);
      sendResponse({ success: true, count: normalized.length });
    } else sendResponse({ success: false });
    return false;
  }

  if (message.type === 'publisherContextUpdate') {
    if (Number.isInteger(tabId)) {
      publisherTabData.set(tabId, normalizePublisherContext(message.data || {}));
      mergeLegacyMdpiContext(tabId, tabData.get(tabId) || []);
      refreshBadge(tabId);
      chrome.runtime.sendMessage({ type: 'publisherContextUpdated', tabId }, () => void chrome.runtime.lastError);
    }
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.type === 'integrityScan') {
    if (Number.isInteger(tabId)) {
      void hasIntegrityTransmissionConsent().then(granted => {
        if (granted) void processIntegrityScan(tabId, message.data || {});
        else {
          cancelIntegrityScan(tabId);
          integrityTabData.delete(tabId);
          refreshBadge(tabId);
        }
      });
    }
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.type === 'integrityScanDisabled') {
    if (Number.isInteger(tabId)) {
      cancelIntegrityScan(tabId);
      integrityTabData.delete(tabId);
      refreshBadge(tabId);
    }
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.type === 'getMdpiReferences') {
    getActiveTab().then(tab => sendResponse({ references: Number.isInteger(tab?.id) ? (tabData.get(tab.id) || []) : [] }))
      .catch(() => sendResponse({ references: [] }));
    return true;
  }

  if (message.type === 'getPublisherContext') {
    getActiveTab().then(tab => {
      const report = Number.isInteger(tab?.id) ? publisherTabData.get(tab.id) : null;
      sendResponse({ report: report || null, settings: publisherSettings });
    }).catch(() => sendResponse({ report: null, settings: publisherSettings }));
    return true;
  }

  if (message.type === 'getIntegrityReport') {
    getActiveTab().then(tab => {
      const report = Number.isInteger(tab?.id) ? integrityTabData.get(tab.id) : null;
      sendResponse({ report: report || null, statuses: STATUS_DEFINITIONS });
    }).catch(() => sendResponse({ report: null, statuses: STATUS_DEFINITIONS }));
    return true;
  }

  if (message.type === 'scrollToRef') {
    if (typeof message.refId !== 'string' || !SAFE_REFERENCE_ID.test(message.refId)) {
      sendResponse({ success: false, error: 'invalid-reference-id' });
      return false;
    }
    getActiveTab().then(tab => {
      if (!Number.isInteger(tab?.id)) return sendResponse({ success: false, error: 'no-active-tab' });
      chrome.tabs.sendMessage(tab.id, { type: 'scrollToRefOnPage', refId: message.refId }, response => {
        if (chrome.runtime.lastError) sendResponse({ success: false, error: 'content-script-unavailable' });
        else {
          const status = response?.status;
          sendResponse({ success: status === 'scrolled' || status === 'expanded-and-scrolled' || status === 'success' });
        }
      });
    }).catch(() => sendResponse({ success: false, error: 'tab-query-failed' }));
    return true;
  }

  return false;
});

refreshPublisherSettings();
chrome.runtime.onInstalled.addListener(refreshPublisherSettings);
chrome.runtime.onStartup.addListener(refreshPublisherSettings);
chrome.storage.onChanged.addListener(changes => {
  if (changes.publisherWatchlist || changes.mode || changes.highlightPotentialMdpiSites || changes.potentialMdpiHighlightColor) refreshPublisherSettings();
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') clearTabData(tabId);
});
chrome.tabs.onRemoved.addListener(tabId => clearTabData(tabId));
