'use strict';

;(function initializePublisherBackground() {
  if (globalThis.NotandiaPublisherBackground) return;
  const api = globalThis.NotandiaPublisherProfiles;
  if (!api) throw new Error('Publisher-profile runtime failed to load');

  const reportsByTab = new Map();
  const SAFE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const MAX_RECORDS = 500;
  const MAX_TEXT = 1000;
  const NCBI_ENDPOINT = 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/';
  const NCBI_MAX_IDS = 200;
  const NCBI_TIMEOUT_MS = 10000;

  function usesFirefoxDataConsent() {
    const optional = chrome.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional;
    return Array.isArray(optional) && optional.includes('websiteContent');
  }

  function migrateStorage(reason = 'runtime') {
    chrome.storage.sync.get(null, storage => {
      if (chrome.runtime.lastError) return;
      const publisherProfiles = api.migratePublisherSettings(storage || {});
      const updates = {
        publisherProfiles,
        publisherProfilesEnabled: true,
        mode: 'none'
      };
      if (reason === 'install' && typeof storage.integrityLookupsEnabled !== 'boolean') {
        updates.integrityLookupsEnabled = !usesFirefoxDataConsent();
      } else if (reason === 'update' && typeof storage.integrityLookupsEnabled !== 'boolean') {
        updates.integrityLookupsEnabled = false;
      }
      chrome.storage.sync.set(updates);
    });
  }

  function sanitizeMatch(match) {
    if (!match || typeof match !== 'object') return null;
    const profileId = String(match.profileId || '').slice(0, 64);
    const name = String(match.name || '').slice(0, 80);
    const confidence = match.confidence === 'potential' ? 'potential' : 'confirmed';
    const action = api.ACTIONS.includes(match.action) ? match.action : 'none';
    const color = /^#[0-9a-f]{6}$/i.test(String(match.color || '')) ? String(match.color).toUpperCase() : '#48627A';
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(profileId) || !name) return null;
    return {
      profileId,
      name,
      confidence,
      action,
      color,
      reasons: Array.isArray(match.reasons) ? match.reasons.map(value => String(value).slice(0, 40)).slice(0, 10) : []
    };
  }

  function sanitizeRecord(record, kind) {
    if (!record || typeof record !== 'object') return null;
    const id = String(record.id || '').slice(0, 256);
    if (!SAFE_ID.test(id)) return null;
    const matches = Array.isArray(record.matches) ? record.matches.map(sanitizeMatch).filter(Boolean).slice(0, 20) : [];
    if (!matches.length) return null;
    return {
      id,
      kind,
      number: Number.isFinite(record.number) ? Math.max(1, Math.trunc(record.number)) : null,
      doi: api.normalizeDoi(record.doi || '') || null,
      text: String(record.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
      matches
    };
  }

  function sanitizeReport(report) {
    const currentArticle = report?.currentArticle ? sanitizeRecord(report.currentArticle, 'current-article') : null;
    const references = Array.isArray(report?.references)
      ? report.references.slice(0, MAX_RECORDS).map(record => sanitizeRecord(record, 'reference')).filter(Boolean)
      : [];
    const searchResults = Array.isArray(report?.searchResults)
      ? report.searchResults.slice(0, MAX_RECORDS).map(record => sanitizeRecord(record, 'search-result')).filter(Boolean)
      : [];
    const profileCounts = {};
    for (const record of [currentArticle, ...references, ...searchResults].filter(Boolean)) {
      for (const match of record.matches) profileCounts[match.profileId] = (profileCounts[match.profileId] || 0) + 1;
    }
    return {
      currentArticle,
      references,
      searchResults,
      summary: {
        matchedItems: (currentArticle ? 1 : 0) + references.length + searchResults.length,
        matchedReferences: references.length,
        matchedSearchResults: searchResults.length,
        profileCounts
      },
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeNcbiId(value, idType) {
    let normalized = String(value || '').trim();
    if (idType === 'pmid') return /^\d{1,12}$/.test(normalized) ? normalized : null;
    if (idType === 'pmcid') {
      normalized = normalized.toUpperCase();
      return /^PMC\d{1,12}$/.test(normalized) ? normalized : null;
    }
    if (idType === 'doi') return api.normalizeDoi(normalized);
    return null;
  }

  function sanitizeNcbiCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const output = {};
    const pmid = normalizeNcbiId(candidate.pmid, 'pmid');
    const pmcid = normalizeNcbiId(candidate.pmcid, 'pmcid');
    const doi = normalizeNcbiId(candidate.doi, 'doi');
    if (pmid) output.pmid = pmid;
    if (pmcid) output.pmcid = pmcid;
    if (doi) output.doi = doi;
    return Object.keys(output).length ? output : null;
  }

  function sanitizeNcbiRecord(record) {
    const output = sanitizeNcbiCandidate(record) || {};
    const versions = Array.isArray(record?.versions)
      ? record.versions.slice(0, 20).map(sanitizeNcbiCandidate).filter(Boolean)
      : [];
    if (versions.length) output.versions = versions;
    return Object.keys(output).length ? output : null;
  }

  async function fetchNcbiRecords(ids, idType) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NCBI_TIMEOUT_MS);
    try {
      const url = new URL(NCBI_ENDPOINT);
      url.search = new URLSearchParams({
        ids: ids.join(','),
        idtype: idType,
        format: 'json',
        versions: 'no',
        tool: 'notandia'
      }).toString();
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`NCBI returned HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) throw new Error('NCBI returned a non-JSON response');
      const payload = await response.json();
      return Array.isArray(payload?.records)
        ? payload.records.slice(0, NCBI_MAX_IDS * 2).map(sanitizeNcbiRecord).filter(Boolean)
        : [];
    } finally {
      clearTimeout(timeout);
    }
  }

  function badgeForTab(tabId) {
    const report = reportsByTab.get(tabId);
    const count = report?.summary?.matchedItems || 0;
    if (!count) return null;
    const first = report.currentArticle?.matches?.[0] || report.references?.[0]?.matches?.[0] || report.searchResults?.[0]?.matches?.[0];
    return {
      count: Math.min(999, count),
      color: first?.color || '#48627A',
      title: `${count} item${count === 1 ? '' : 's'} matched your publisher watchlists`
    };
  }

  function applyBadge(tabId) {
    if (!Number.isInteger(tabId)) return;
    const badge = badgeForTab(tabId);
    if (!badge) return;
    chrome.action.setBadgeText({ tabId, text: String(badge.count) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
    chrome.action.setTitle({ tabId, title: badge.title });
  }

  async function activeTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  function broadcastRescan() {
    chrome.tabs.query({}, tabs => {
      if (chrome.runtime.lastError) return;
      for (const tab of tabs) {
        if (!Number.isInteger(tab.id)) continue;
        chrome.tabs.sendMessage(tab.id, { type: 'forcePublisherRescan' }, () => void chrome.runtime.lastError);
      }
    });
  }

  chrome.runtime.onInstalled.addListener(details => migrateStorage(details?.reason || 'runtime'));
  migrateStorage('runtime');

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.publisherProfiles) broadcastRescan();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;

    if (message.type === 'ncbiIdConversion') {
      const tabId = sender.tab?.id;
      const idType = String(message.idType || '');
      if (!Number.isInteger(tabId) || !['pmid', 'pmcid', 'doi'].includes(idType) || !Array.isArray(message.ids)) {
        sendResponse({ success: false, records: [] });
        return false;
      }
      const ids = Array.from(new Set(message.ids.map(value => normalizeNcbiId(value, idType)).filter(Boolean))).slice(0, NCBI_MAX_IDS);
      if (!ids.length) {
        sendResponse({ success: false, records: [] });
        return false;
      }
      fetchNcbiRecords(ids, idType)
        .then(records => sendResponse({ success: true, records }))
        .catch(() => sendResponse({ success: false, records: [] }));
      return true;
    }

    if (message.type === 'integrityPresentationNeedsRescan') {
      const tabId = sender.tab?.id;
      if (!Number.isInteger(tabId)) {
        sendResponse({ success: false });
        return false;
      }
      chrome.tabs.sendMessage(tabId, { type: 'forceIntegrityRescan' }, response => {
        sendResponse({ success: !chrome.runtime.lastError && response !== false });
      });
      return true;
    }

    if (message.type === 'publisherContextUpdate') {
      const tabId = sender.tab?.id;
      if (!Number.isInteger(tabId)) {
        sendResponse({ success: false });
        return false;
      }
      const report = sanitizeReport(message.report || {});
      reportsByTab.set(tabId, report);
      applyBadge(tabId);
      sendResponse({ success: true, summary: report.summary });
      return false;
    }

    if (message.type === 'getPublisherContext') {
      activeTab().then(tab => {
        const report = Number.isInteger(tab?.id) ? reportsByTab.get(tab.id) : null;
        sendResponse({ report: report || null });
      }).catch(() => sendResponse({ report: null }));
      return true;
    }

    if (message.type === 'publisherSettingsChanged') {
      broadcastRescan();
      sendResponse({ success: true });
      return false;
    }

    return false;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') reportsByTab.delete(tabId);
  });
  chrome.tabs.onRemoved.addListener(tabId => reportsByTab.delete(tabId));

  globalThis.NotandiaPublisherBackground = Object.freeze({
    applyBadge,
    badgeForTab,
    getReport: tabId => reportsByTab.get(tabId) || null,
    clearTab: tabId => reportsByTab.delete(tabId)
  });
})();
