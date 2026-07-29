'use strict';

;(function keepPopupIntegrityStateLive() {
  let reloadScheduled = false;
  let recoveryRequested = false;

  function markPendingCounts() {
    const coverage = document.getElementById('integrityCoverage')?.textContent || '';
    if (!/Checking|Restoring|Loading/i.test(coverage)) return;
    for (const id of ['countRetracted', 'countConcern', 'countCorrected', 'countOther']) {
      const node = document.getElementById(id);
      if (node) node.textContent = '…';
    }
  }

  function scheduleReload() {
    if (reloadScheduled) return;
    reloadScheduled = true;
    setTimeout(() => window.location.reload(), 80);
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'integrityReportUpdated') scheduleReload();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const coverage = document.getElementById('integrityCoverage');
    if (coverage) new MutationObserver(markPendingCounts).observe(coverage, { childList: true, characterData: true, subtree: true });
    markPendingCounts();

    setTimeout(() => {
      const enabled = document.getElementById('integrityLookupsEnabled')?.checked === true;
      const text = coverage?.textContent || '';
      if (!enabled || recoveryRequested || !/Waiting for identifiable DOI metadata/i.test(text)) return;
      recoveryRequested = true;
      coverage.textContent = 'Restoring integrity results…';
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tabId = tabs[0]?.id;
        if (!Number.isInteger(tabId)) return;
        chrome.tabs.sendMessage(tabId, { type: 'forceIntegrityRescan' }, () => void chrome.runtime.lastError);
      });
    }, 1400);
  }, { once: true });
})();
