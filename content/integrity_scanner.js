'use strict';

;(function initializeIntegrityScanner() {
  if (window.notandiaIntegrityScannerInjected) return;
  window.notandiaIntegrityScannerInjected = true;

  const runtime = window.NotandiaRuntime;
  const sourceContext = window.NotandiaSourceContext;
  if (!runtime?.isAvailable() || !sourceContext) return;

  let scanTimer = null;
  let observer = null;
  let scanGeneration = 0;
  let lastFingerprint = '';

  function stop() {
    clearTimeout(scanTimer);
    scanTimer = null;
    observer?.disconnect();
    observer = null;
  }

  function exposeRuntimeSettings(ncbiEnabled) {
    const runtimeSettings = window.NotandiaSettings || window.MDPIFilterSettings || {};
    runtimeSettings.ncbiApiEnabled = ncbiEnabled === true;
    window.NotandiaSettings = runtimeSettings;
    window.MDPIFilterSettings = runtimeSettings;
  }

  async function scanDocument(generation) {
    if (!runtime.isAvailable()) return stop();
    runtime.storageGet(
      'sync',
      { integrityLookupsEnabled: false, ncbiApiEnabled: false },
      async (settings, error) => {
        if (error || !runtime.isAvailable() || generation !== scanGeneration) return;
        if (settings.integrityLookupsEnabled !== true) {
          runtime.sendMessage({ type: 'integrityScanDisabled' });
          return;
        }

        const ncbiEnabled = settings.ncbiApiEnabled === true;
        exposeRuntimeSettings(ncbiEnabled);

        const { all } = sourceContext.collectRecords({
          maxReferences: 250,
          maxSearchResults: 150,
          maxTextLength: 500
        });

        await sourceContext.resolveRecordsWithNcbi(all, ncbiEnabled);
        if (!runtime.isAvailable() || generation !== scanGeneration) return;

        // Keep identity sharing strictly local and exact. If the same long title appears
        // twice on the page and one representation exposes a DOI, reuse it only when the
        // title maps to exactly one DOI.
        sourceContext.propagateExactTitleDois(all);

        const references = all
          .filter(record => record.doi)
          .map(record => ({
            id: record.id,
            number: record.number,
            doi: record.doi,
            text: record.text,
            kind: record.kind
          }));

        const pageDoi = sourceContext.currentArticleEvidence().dois[0] || null;
        const fingerprint = JSON.stringify([
          pageDoi,
          references.map(reference => [reference.id, reference.kind, reference.number, reference.doi])
        ]);
        if (fingerprint === lastFingerprint) return;
        lastFingerprint = fingerprint;

        // Keep the historical `references` transport key for the background contract.
        // Search-result records now use the same formal-integrity pipeline instead of a
        // separate Google/Scholar detector.
        runtime.sendMessage({ type: 'integrityScan', data: { pageDoi, references } });
      }
    );
  }

  function scheduleScan(delay = 300) {
    if (!runtime.isAvailable()) return stop();
    clearTimeout(scanTimer);
    const generation = ++scanGeneration;
    scanTimer = setTimeout(() => void scanDocument(generation), delay);
  }

  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id || message?.type !== 'forceIntegrityRescan') return false;
      lastFingerprint = '';
      scheduleScan(0);
      sendResponse({ scheduled: true });
      return false;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && (changes.integrityLookupsEnabled || changes.ncbiApiEnabled)) {
        lastFingerprint = '';
        scheduleScan(0);
      }
    });
  } catch (error) {
    if (runtime.isInvalidationError(error)) return stop();
    throw error;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleScan(0), { once: true });
  } else scheduleScan(0);

  observer = new MutationObserver(mutations => {
    if (!runtime.isAvailable()) return stop();
    for (const mutation of mutations) {
      for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
        if (sourceContext.nodeTouchesSourceContext(node)) {
          scheduleScan(350);
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
