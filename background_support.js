'use strict';

;(function initializeBackgroundSupport() {
  if (globalThis.NotandiaBackgroundSupport) return;
  globalThis.NotandiaBackgroundSupport = true;

  const NCBI_ENDPOINT = 'https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/';
  const NCBI_TOOL = 'NotandiaBrowser';
  const NCBI_EMAIL = 'mario.marcolongo.dev@gmail.com';
  const NCBI_MAX_IDS = 50;
  const NCBI_TIMEOUT_MS = 10000;
  const NCBI_MIN_REQUEST_INTERVAL_MS = 1100;
  const NCBI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const NCBI_MAX_CACHE_ENTRIES = 200;
  const NCBI_DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
  const NCBI_BLOCKED_COOLDOWN_MS = 30 * 60 * 1000;
  const RECOVERY_KEY_PREFIX = 'notandia-integrity-tab-';
  const fallbackRecoveryTabs = new Set();
  const ncbiCache = new Map();
  const ncbiInflight = new Map();
  let ncbiRequestTail = Promise.resolve();
  let ncbiNextRequestAt = 0;
  let ncbiBlockedUntil = 0;
  let ncbiBlockedStatus = 'cooldown';

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

  function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));
  }

  function ncbiRequestKey(ids, idType) {
    return `${idType}:${[...ids].sort().join(',')}`;
  }

  function readCachedNcbiResult(key) {
    const cached = ncbiCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.storedAt > NCBI_CACHE_TTL_MS) {
      ncbiCache.delete(key);
      return null;
    }
    return cached.result;
  }

  function cacheNcbiResult(key, result) {
    ncbiCache.set(key, { storedAt: Date.now(), result });
    while (ncbiCache.size > NCBI_MAX_CACHE_ENTRIES) {
      ncbiCache.delete(ncbiCache.keys().next().value);
    }
  }

  function retryAfterMilliseconds(response) {
    const raw = String(response.headers.get('retry-after') || '').trim();
    if (!raw) return NCBI_DEFAULT_COOLDOWN_MS;
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.max(seconds * 1000, 60 * 1000), NCBI_BLOCKED_COOLDOWN_MS);
    }
    const date = Date.parse(raw);
    if (Number.isFinite(date)) {
      return Math.min(Math.max(date - Date.now(), 60 * 1000), NCBI_BLOCKED_COOLDOWN_MS);
    }
    return NCBI_DEFAULT_COOLDOWN_MS;
  }

  function ncbiCooldownResult() {
    const retryAfterMs = Math.max(0, ncbiBlockedUntil - Date.now());
    return {
      status: ncbiBlockedStatus,
      records: [],
      retryAfterMs
    };
  }

  function ncbiLookupEnabled() {
    return new Promise(resolve => {
      if (!chrome.storage?.sync) {
        resolve(false);
        return;
      }
      chrome.storage.sync.get({ ncbiApiEnabled: false }, stored => {
        resolve(!chrome.runtime.lastError && stored?.ncbiApiEnabled === true);
      });
    });
  }

  async function performNcbiFetch(ids, idType) {
    if (Date.now() < ncbiBlockedUntil) return ncbiCooldownResult();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NCBI_TIMEOUT_MS);
    try {
      const url = new URL(NCBI_ENDPOINT);
      url.search = new URLSearchParams({
        ids: ids.join(','),
        idtype: idType,
        format: 'json',
        versions: 'no',
        tool: NCBI_TOOL,
        email: NCBI_EMAIL
      }).toString();
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      if (response.status === 403 || response.status === 429) {
        const cooldown = response.status === 429
          ? retryAfterMilliseconds(response)
          : NCBI_BLOCKED_COOLDOWN_MS;
        ncbiBlockedUntil = Date.now() + cooldown;
        ncbiBlockedStatus = response.status === 429 ? 'throttled' : 'blocked';
        return ncbiCooldownResult();
      }

      if (!response.ok) {
        ncbiBlockedUntil = Date.now() + Math.min(NCBI_DEFAULT_COOLDOWN_MS, 60 * 1000);
        ncbiBlockedStatus = 'unavailable';
        return ncbiCooldownResult();
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('json')) {
        return { status: 'unavailable', records: [], retryAfterMs: 0 };
      }
      const payload = await response.json();
      const records = Array.isArray(payload?.records)
        ? payload.records.slice(0, NCBI_MAX_IDS * 2).map(sanitizeNcbiRecord).filter(Boolean)
        : [];
      return { status: 'ok', records, retryAfterMs: 0 };
    } catch (_error) {
      return { status: 'unavailable', records: [], retryAfterMs: 0 };
    } finally {
      clearTimeout(timeout);
    }
  }

  function enqueueNcbiFetch(ids, idType) {
    const queued = ncbiRequestTail.then(async () => {
      if (Date.now() < ncbiBlockedUntil) return ncbiCooldownResult();
      const wait = Math.max(0, ncbiNextRequestAt - Date.now());
      if (wait) await delay(wait);
      if (Date.now() < ncbiBlockedUntil) return ncbiCooldownResult();
      ncbiNextRequestAt = Date.now() + NCBI_MIN_REQUEST_INTERVAL_MS;
      return performNcbiFetch(ids, idType);
    });
    ncbiRequestTail = queued.then(() => undefined, () => undefined);
    return queued;
  }

  async function fetchNcbiRecords(ids, idType) {
    if (!(await ncbiLookupEnabled())) {
      return { status: 'disabled', records: [], retryAfterMs: 0 };
    }
    const key = ncbiRequestKey(ids, idType);
    const cached = readCachedNcbiResult(key);
    if (cached) return cached;
    if (ncbiInflight.has(key)) return ncbiInflight.get(key);

    const request = enqueueNcbiFetch(ids, idType)
      .then(result => {
        if (result.status === 'ok') cacheNcbiResult(key, result);
        return result;
      })
      .finally(() => ncbiInflight.delete(key));
    ncbiInflight.set(key, request);
    return request;
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
        sendResponse({ success: false, records: [], providerStatus: 'invalid' });
        return false;
      }
      const ids = Array.from(new Set(message.ids.map(value => normalizeNcbiId(value, idType)).filter(Boolean))).slice(0, NCBI_MAX_IDS);
      if (!ids.length) {
        sendResponse({ success: false, records: [], providerStatus: 'invalid' });
        return false;
      }
      fetchNcbiRecords(ids, idType)
        .then(result => sendResponse({
          success: result.status === 'ok',
          records: result.records,
          providerStatus: result.status,
          retryAfterMs: result.retryAfterMs
        }))
        .catch(() => sendResponse({
          success: false,
          records: [],
          providerStatus: 'unavailable',
          retryAfterMs: 0
        }));
      return true;
    }

    return false;
  });

  chrome.runtime.onInstalled?.addListener(details => {
    if (details.reason !== 'install' || !chrome.storage?.sync) return;
    chrome.storage.sync.get(['ncbiApiEnabled'], stored => {
      if (chrome.runtime.lastError || typeof stored?.ncbiApiEnabled === 'boolean') return;
      chrome.storage.sync.set({ ncbiApiEnabled: false }, () => void chrome.runtime.lastError);
    });
  });

  chrome.runtime.onStartup?.addListener(restoreIntegrityScans);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') forgetIntegrityTab(tabId);
  });
  chrome.tabs.onRemoved.addListener(forgetIntegrityTab);

  setTimeout(restoreIntegrityScans, 250);
})();
