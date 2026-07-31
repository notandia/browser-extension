'use strict';

;(function initializePopupProgress() {
  let requestPending = false;

  function elements() {
    return {
      coverage: document.getElementById('integrityCoverage'),
      container: document.getElementById('integrityProgressContainer'),
      progress: document.getElementById('integrityProgress'),
      label: document.getElementById('integrityProgressLabel')
    };
  }

  function completedCount(report) {
    if (Number.isFinite(report?.completed)) return Math.max(0, Math.trunc(report.completed));
    return (report?.records || []).filter(record => record?.lookupStatus && !['pending', 'cancelled'].includes(record.lookupStatus)).length;
  }

  function render(report) {
    const el = elements();
    if (!el.container || !el.progress || !el.label) return;
    const loading = report?.state === 'loading' && Number(report?.attempted) > 0;
    el.container.hidden = !loading;
    if (!loading) return;

    const attempted = Math.max(1, Math.trunc(Number(report.attempted) || 0));
    const completed = Math.min(attempted, completedCount(report));
    const percent = Number.isFinite(report.progressPercent)
      ? Math.max(0, Math.min(100, Math.round(report.progressPercent)))
      : Math.round((completed / attempted) * 100);
    el.progress.max = 100;
    el.progress.value = percent;
    el.label.textContent = `${completed} of ${attempted} DOI records · ${percent}%`;
    if (el.coverage) el.coverage.textContent = `Checking formal update records… ${completed}/${attempted} (${percent}%)`;
  }

  function loadProgress() {
    if (requestPending) return;
    requestPending = true;
    chrome.runtime.sendMessage({ type: 'getIntegrityReport' }, response => {
      requestPending = false;
      if (chrome.runtime.lastError) return;
      render(response?.report || null);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    setTimeout(loadProgress, 350);
  }, { once: true });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'integrityProgressUpdated' || message?.type === 'integrityReportUpdated') loadProgress();
    return false;
  });
})();
