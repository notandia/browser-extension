'use strict';

;(function initializeBackgroundSupport() {
  if (globalThis.NotandiaBackgroundSupport) return;
  globalThis.NotandiaBackgroundSupport = true;

  const NCBI_ENDPOINT = 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/';
  const NCBI_MAX_IDS = 200;
  const NCBI_TIMEOUT_MS = 10000;
  const RECOVERY_KEY_PREFIX = 'notandia-integrity-tab-';
  const fallbackRecoveryTabs = new Set();

  function normalizeDoi(value) {
    return globalThis.MDPIIntegrity?.normalizeDOI?.(String(value || '')) || null;
  }

  function normalizeNcbiId(value, idType) {
    let normalized = String(value || '').trim();
    if (idType === 'pmid') return /^\d{1,12}$/.test(normalized) ? normalized : null;
    if (idType === 'pmcid') {
      normalized = normalized.toUpperCase();
      return /^PMC\d{1,12}$/.test(normalized) ? normalized : null;
    }
    if (idType === 'doi') return normalizeDoi(normalized);
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
      if (!contentType.toLowerCase().includes('json')) throw new Error('NCBI returned a non-JSON response');
      const payload = await response.json();
      return Array.isArray(payload?.records)
        ? payload.records.slice(0, NCBI_MAX_IDS * 2).map(sanitizeNcbiRecord).filter(Boolean)
        : [];
    } finally {
      clearTimeout(timeout);
    }
  }

  function recoveryKey(tabId) {
    return `${RECOVERY_KEY_PREFIX}${tabId}`;
  }

  function rememberIntegrityTab(tabId) {
    if (!Number.isInteger(tabId)) return;
    fallbackRecoveryTabs.add(tabId);
    if (!chrome.storage?.session) return;
    chrome.storage.session.set({ [recoveryKey(tabId)]: true }, () => void chrome.runtime.lastError);
  }

  function forgetIntegrityTab(tabId) {
    if (!Number.isInteger(tabId)) return;
    fallbackRecoveryTabs.delete(tabId);
    if (!chrome.storage?.session) return;
    chrome.storage.session.remove(recoveryKey(tabId), () => void chrome.runtime.lastError);
  }

  function requestIntegrityRescan(tabId) {
    if (!Number.isInteger(tabId)) return;
    chrome.tabs.sendMessage(tabId, { type: 'forceIntegrityRescan' }, () => void chrome.runtime.lastError);
  }

  function restoreOrRescan(tabId) {
    if (!Number.isInteger(tabId)) return Promise.resolve(false);
    const restore = globalThis.NotandiaBackgroundPersistence?.restoreTab;
    if (typeof restore !== 'function') {
      requestIntegrityRescan(tabId);
      return Promise.resolve(false);
    }
    return Promise.resolve(restore(tabId)).then(restored => {
      if (!restored) requestIntegrityRescan(tabId);
      return restored;
    }).catch(() => {
      requestIntegrityRescan(tabId);
      return false;
    });
  }

  function restoreIntegrityScans() {
    if (!chrome.storage?.session) {
      for (const tabId of fallbackRecoveryTabs) void restoreOrRescan(tabId);
      return;
    }
    chrome.storage.session.get(null, stored => {
      if (chrome.runtime.lastError) return;
      for (const key of Object.keys(stored || {})) {
        if (!key.startsWith(RECOVERY_KEY_PREFIX)) continue;
        const tabId = Number(key.slice(RECOVERY_KEY_PREFIX.length));
        if (Number.isInteger(tabId)) void restoreOrRescan(tabId);
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
    const tabId = sender.tab?.id;

    if (message.type === 'integrityScan') {
      rememberIntegrityTab(tabId);
      return false;
    }

    if (message.type === 'integrityScanDisabled') {
      forgetIntegrityTab(tabId);
      return false;
    }

    if (message.type === 'integrityPresentationNeedsRescan') {
      if (!Number.isInteger(tabId)) {
        sendResponse({ success: false });
        return false;
      }
      rememberIntegrityTab(tabId);
      void restoreOrRescan(tabId).then(restored => sendResponse({ success: true, restored }));
      return true;
    }

    if (message.type === 'ncbiIdConversion') {
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

    return false;
  });

  chrome.runtime.onStartup?.addListener(restoreIntegrityScans);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') forgetIntegrityTab(tabId);
  });
  chrome.tabs.onRemoved.addListener(forgetIntegrityTab);

  setTimeout(restoreIntegrityScans, 250);
})();
