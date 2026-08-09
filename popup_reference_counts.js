'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const statusIds = {
    retracted: 'countRetracted',
    'expression-of-concern': 'countConcern',
    corrected: 'countCorrected',
    withdrawn: 'countWithdrawn'
  };
  const filter = document.getElementById('contextFilter');
  let refreshTimer = null;

  function render(report) {
    const counts = Object.fromEntries(Object.keys(statusIds).map(status => [status, 0]));
    for (const record of report?.records || []) {
      if (record?.kind === 'current-article') continue;
      const statuses = new Set();
      if (record?.primaryStatus) statuses.add(String(record.primaryStatus));
      for (const event of record?.events || []) {
        if (event?.status) statuses.add(String(event.status));
      }
      for (const status of statuses) {
        if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
      }
    }

    for (const [status, id] of Object.entries(statusIds)) {
      const value = document.getElementById(id);
      if (!value) continue;
      value.textContent = String(counts[status]);
      const card = value.closest('[data-context-filter]');
      if (!card) continue;
      const active = filter?.value === `status:${status}`;
      card.hidden = counts[status] === 0 && !active;
    }
  }

  function refresh() {
    try {
      chrome.runtime.sendMessage({ type: 'getIntegrityReport' }, response => {
        if (chrome.runtime.lastError) return;
        render(response?.report || null);
      });
    } catch {}
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 0);
  }

  chrome.runtime.onMessage.addListener(message => {
    if (['integrityProgressUpdated', 'integrityReportUpdated'].includes(message?.type)) {
      scheduleRefresh();
    }
    return false;
  });

  filter?.addEventListener('change', scheduleRefresh);
  refresh();
  setTimeout(refresh, 500);
});
