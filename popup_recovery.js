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

  function forceIntegrityRescan() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id;
      if (!Number.isInteger(tabId)) return;
      chrome.tabs.sendMessage(tabId, { type: 'forceIntegrityRescan' }, () => void chrome.runtime.lastError);
    });
  }

  function restoreSessionState({ allowRescan = false } = {}) {
    if (recoveryRequested) return;
    recoveryRequested = true;
    chrome.runtime.sendMessage({ type: 'restorePersistedTabState' }, response => {
      const restored = !chrome.runtime.lastError && response?.restored === true;
      if (restored) return;
      recoveryRequested = false;
      if (allowRescan) forceIntegrityRescan();
    });
  }

  function recoverMissingReport() {
    const enabled = document.getElementById('integrityLookupsEnabled')?.checked === true;
    const coverage = document.getElementById('integrityCoverage');
    if (!enabled || recoveryRequested || !/Waiting for identifiable DOI records/i.test(coverage?.textContent || '')) return;
    coverage.textContent = 'Restoring integrity results…';
    markPendingCounts();
    restoreSessionState({ allowRescan: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const coverage = document.getElementById('integrityCoverage');
    if (coverage) {
      new MutationObserver(() => {
        markPendingCounts();
        setTimeout(recoverMissingReport, 700);
      }).observe(coverage, { childList: true, characterData: true, subtree: true });
    }
    markPendingCounts();
    restoreSessionState();
    setTimeout(() => {
      recoveryRequested = false;
      recoverMissingReport();
    }, 900);
  }, { once: true });
})();
