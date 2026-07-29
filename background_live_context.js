'use strict';

;(function initializeLiveContextRuntime() {
  if (globalThis.NotandiaLiveContextRuntime) return;
  globalThis.NotandiaLiveContextRuntime = true;

  const baseRefreshBadge = refreshBadge;

  function contextKey(record, fallback = '') {
    const doi = normalizeDOI(record?.doi || '');
    if (doi) return `doi:${doi}`;
    return `${record?.kind || 'item'}:${record?.id || fallback}`;
  }

  function refreshCombinedContextBadge(tabId) {
    if (!Number.isInteger(tabId)) return;
    const publisher = publisherTabData.get(tabId);
    const integrity = integrityTabData.get(tabId);
    const allKeys = new Set();
    const publisherKeys = new Set();
    const integrityKeys = new Set();

    const publisherRecords = [
      publisher?.currentArticle,
      ...(publisher?.references || []),
      ...(publisher?.searchResults || [])
    ].filter(Boolean);
    for (const record of publisherRecords) {
      if (!(record.matches || []).some(match => match.action !== 'none')) continue;
      const key = contextKey(record, `publisher-${publisherKeys.size + 1}`);
      publisherKeys.add(key);
      allKeys.add(key);
    }

    for (const record of integrity?.records || []) {
      if (!record?.primaryStatus) continue;
      const key = contextKey(record, `integrity-${integrityKeys.size + 1}`);
      integrityKeys.add(key);
      allKeys.add(key);
    }

    if (!allKeys.size) {
      baseRefreshBadge(tabId);
      return;
    }

    const primaryStatus = integrity?.summary?.primaryStatus;
    const statusColor = primaryStatus ? STATUS_DEFINITIONS[primaryStatus]?.color : null;
    const color = statusColor || publisher?.summary?.primaryColor || '#48627A';
    const total = allKeys.size;
    const formal = integrityKeys.size;
    const watchlist = publisherKeys.size;
    const parts = [`${total} contextual item${total === 1 ? '' : 's'}`];
    if (formal) parts.push(`${formal} with formal signal${formal === 1 ? '' : 's'}`);
    if (watchlist) parts.push(`${watchlist} publisher watchlist match${watchlist === 1 ? '' : 'es'}`);
    setBadge(tabId, total, color, parts.join(' · '));
  }

  refreshBadge = refreshCombinedContextBadge;

  function publishProgress(tabId) {
    refreshCombinedContextBadge(tabId);
    chrome.runtime.sendMessage({ type: 'integrityProgressUpdated', tabId }, () => void chrome.runtime.lastError);
  }

  async function persistCompletedReport(tabId) {
    const save = globalThis.NotandiaBackgroundPersistence?.saveTab;
    if (typeof save !== 'function') return;
    try {
      await save(tabId);
    } catch {
      // The completed report remains available in memory even if session storage fails.
    }
  }

  processIntegrityScan = async function processIntegrityScanWithProgress(tabId, data) {
    if (!Number.isInteger(tabId)) return;
    cancelIntegrityScan(tabId);
    const scan = { cancelled: false, controllers: new Set() };
    activeIntegrityScans.set(tabId, scan);
    const input = normalizeIntegrityInput(data);
    const attempted = input.slice(0, MAX_INTEGRITY_LOOKUPS_PER_SCAN);
    const pendingRecords = attempted.map(record => ({
      ...record,
      lookupStatus: 'pending',
      events: [],
      primaryStatus: null
    }));

    integrityTabData.set(tabId, {
      state: input.length ? 'loading' : 'ready',
      provider: 'Crossref + Retraction Watch',
      totalDiscovered: input.length,
      attempted: attempted.length,
      completed: 0,
      progressPercent: attempted.length ? 0 : 100,
      notChecked: Math.max(0, input.length - attempted.length),
      records: pendingRecords,
      summary: summarizeIntegrityRecords([], input.length),
      updatedAt: new Date().toISOString()
    });
    publishProgress(tabId);

    if (!attempted.length) {
      activeIntegrityScans.delete(tabId);
      await persistCompletedReport(tabId);
      chrome.runtime.sendMessage({ type: 'integrityReportUpdated', tabId }, () => void chrome.runtime.lastError);
      return;
    }

    const results = new Array(attempted.length);
    let completed = 0;
    await mapWithConcurrency(attempted, CROSSREF_CONCURRENCY, async (record, index) => {
      if (scan.cancelled) return null;
      const lookup = await fetchCrossrefRecord(record.doi, scan);
      if (scan.cancelled) return null;
      const events = Array.isArray(lookup.events) ? lookup.events : [];
      const result = {
        ...record,
        lookupStatus: lookup.lookupStatus,
        error: lookup.error,
        events,
        primaryStatus: derivePrimaryStatus(events)
      };
      results[index] = result;
      completed += 1;

      if (activeIntegrityScans.get(tabId) === scan) {
        const completedRecords = results.filter(Boolean);
        integrityTabData.set(tabId, {
          state: 'loading',
          provider: 'Crossref + Retraction Watch',
          totalDiscovered: input.length,
          attempted: attempted.length,
          completed,
          progressPercent: Math.min(100, Math.round((completed / attempted.length) * 100)),
          notChecked: Math.max(0, input.length - attempted.length),
          records: attempted.map((base, recordIndex) => results[recordIndex] || pendingRecords[recordIndex] || base),
          summary: summarizeIntegrityRecords(completedRecords, input.length),
          updatedAt: new Date().toISOString()
        });
        publishProgress(tabId);
      }
      return result;
    });

    if (scan.cancelled || activeIntegrityScans.get(tabId) !== scan) return;
    activeIntegrityScans.delete(tabId);
    const visibleRecords = results.filter(record => record && record.lookupStatus !== 'cancelled');
    integrityTabData.set(tabId, {
      state: 'ready',
      provider: 'Crossref + Retraction Watch',
      totalDiscovered: input.length,
      attempted: attempted.length,
      completed: visibleRecords.length,
      progressPercent: 100,
      notChecked: Math.max(0, input.length - attempted.length),
      records: visibleRecords,
      summary: summarizeIntegrityRecords(visibleRecords, input.length),
      updatedAt: new Date().toISOString()
    });
    refreshCombinedContextBadge(tabId);
    await persistCompletedReport(tabId);
    chrome.runtime.sendMessage({ type: 'integrityReportUpdated', tabId }, () => void chrome.runtime.lastError);
  };

  chrome.runtime.onMessage.addListener(message => {
    if ((message?.type === 'publisherContextUpdated' || message?.type === 'integrityReportUpdated') && Number.isInteger(message.tabId)) {
      refreshCombinedContextBadge(message.tabId);
    }
    return false;
  });
})();
