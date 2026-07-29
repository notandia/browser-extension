'use strict';

;(function initializePopupRecovery() {
  let recoveryRequested = false;

  function markPendingCounts() {
    const coverage = document.getElementById('integrityCoverage')?.textContent || '';
    if (!/Checking|Restoring|Loading|Waiting/i.test(coverage)) return;
    for (const id of ['countRetracted', 'countConcern', 'countCorrected', 'countWithdrawn']) {
      const node = document.getElementById(id);
      if (node) node.textContent = '…';
    }
  }

  function recoverMissingReport() {
    const enabled = document.getElementById('integrityLookupsEnabled')?.checked === true;
    const coverage = document.getElementById('integrityCoverage');
    if (!enabled || recoveryRequested || !/Waiting for identifiable DOI records/i.test(coverage?.textContent || '')) return;
    recoveryRequested = true;
    coverage.textContent = 'Restoring integrity results…';
    markPendingCounts();
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id;
      if (!Number.isInteger(tabId)) return;
      chrome.tabs.sendMessage(tabId, { type: 'forceIntegrityRescan' }, () => void chrome.runtime.lastError);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const coverage = document.getElementById('integrityCoverage');
    if (coverage) {
      new MutationObserver(() => {
        markPendingCounts();
        setTimeout(recoverMissingReport, 900);
      }).observe(coverage, { childList: true, characterData: true, subtree: true });
    }
    markPendingCounts();
    setTimeout(recoverMissingReport, 1400);
  }, { once: true });
})();
