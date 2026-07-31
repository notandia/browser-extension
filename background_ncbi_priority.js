'use strict';

;(function initializeNcbiContextPriority() {
  const bestPublisherByTab = new Map();
  const bestIntegrityByTab = new Map();

  function isNcbiArticleUrl(value) {
    try {
      const url = new URL(String(value || ''));
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      return (
        (host === 'pubmed.ncbi.nlm.nih.gov' && /^\/\d{1,12}\/?$/.test(url.pathname)) ||
        (host === 'pmc.ncbi.nlm.nih.gov' && /^\/articles\/PMC\d{1,12}\/?$/i.test(url.pathname))
      );
    } catch {
      return false;
    }
  }

  function mergeMatches(left, right) {
    const merged = new Map();
    for (const match of [...(left || []), ...(right || [])]) {
      if (!match?.profileId) continue;
      const key = `${match.profileId}:${match.confidence || 'confirmed'}`;
      const existing = merged.get(key);
      merged.set(key, existing ? {
        ...existing,
        ...match,
        reasons: Array.from(new Set([...(existing.reasons || []), ...(match.reasons || [])])).slice(0, 6)
      } : match);
    }
    return Array.from(merged.values());
  }

  function mergePublisherRecord(left, right) {
    if (!left) return right;
    if (!right) return left;
    return {
      ...left,
      ...right,
      doi: right.doi || left.doi || null,
      text: right.text || left.text || '',
      number: Number.isFinite(right.number) ? right.number : left.number,
      matches: mergeMatches(left.matches, right.matches)
    };
  }

  function publisherRecordKey(record) {
    return record?.doi ? `doi:${record.doi}` : `id:${record?.id || ''}`;
  }

  function mergePublisherReports(left, right) {
    if (!left) return right;
    const mergeList = (first, second) => {
      const records = new Map();
      for (const record of [...(first || []), ...(second || [])]) {
        const key = publisherRecordKey(record);
        if (!key || key === 'id:') continue;
        records.set(key, mergePublisherRecord(records.get(key), record));
      }
      return Array.from(records.values());
    };
    const report = {
      currentArticle: mergePublisherRecord(left.currentArticle, right.currentArticle),
      references: mergeList(left.references, right.references),
      searchResults: mergeList(left.searchResults, right.searchResults),
      updatedAt: new Date().toISOString()
    };
    report.summary = summarizePublisherContext(report);
    return report;
  }

  function integrityDataFromInput(data) {
    const input = normalizeIntegrityInput(data || {});
    const current = input.find(record => record.kind === 'current-article');
    return {
      pageDoi: current?.doi || null,
      references: input
        .filter(record => record.kind === 'reference')
        .map(record => ({
          id: record.id,
          number: record.number,
          doi: record.doi,
          text: record.text
        }))
    };
  }

  function mergeIntegrityData(left, right) {
    const current = integrityDataFromInput(right);
    if (!left) return current;
    const previous = integrityDataFromInput(left);
    const references = new Map();
    for (const record of [...previous.references, ...current.references]) {
      if (!record.doi) continue;
      references.set(record.doi, {
        ...(references.get(record.doi) || {}),
        ...record,
        text: record.text || references.get(record.doi)?.text || ''
      });
    }
    return {
      pageDoi: current.pageDoi || previous.pageDoi || null,
      references: Array.from(references.values())
    };
  }

  function integrityFingerprint(data) {
    const normalized = integrityDataFromInput(data);
    return JSON.stringify([
      normalized.pageDoi,
      normalized.references.map(record => record.doi).sort()
    ]);
  }

  function persistTab(tabId) {
    const save = globalThis.NotandiaBackgroundPersistence?.saveTab;
    if (typeof save === 'function') void save(tabId);
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab?.id;
    if (!Number.isInteger(tabId) || !isNcbiArticleUrl(sender.url)) return false;

    if (message?.type === 'publisherContextUpdate') {
      const incoming = normalizePublisherContext(message.data || {});
      const merged = mergePublisherReports(bestPublisherByTab.get(tabId), incoming);
      bestPublisherByTab.set(tabId, merged);
      queueMicrotask(() => {
        publisherTabData.set(tabId, merged);
        mergeLegacyMdpiContext(tabId, tabData.get(tabId) || []);
        refreshBadge(tabId);
        persistTab(tabId);
        chrome.runtime.sendMessage({ type: 'publisherContextUpdated', tabId }, () => void chrome.runtime.lastError);
      });
      return false;
    }

    if (message?.type === 'integrityScan') {
      const previous = bestIntegrityByTab.get(tabId);
      const merged = mergeIntegrityData(previous, message.data || {});
      bestIntegrityByTab.set(tabId, merged);
      if (previous && integrityFingerprint(merged) !== integrityFingerprint(message.data || {})) {
        queueMicrotask(() => {
          void hasIntegrityTransmissionConsent().then(granted => {
            if (granted) void processIntegrityScan(tabId, merged);
          });
        });
      }
    }
    return false;
  });

  function clear(tabId) {
    bestPublisherByTab.delete(tabId);
    bestIntegrityByTab.delete(tabId);
  }

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') clear(tabId);
  });
  chrome.tabs.onRemoved.addListener(clear);
})();
