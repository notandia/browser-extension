'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const api = globalThis.NotandiaPublisherProfiles;
  if (!api) return;

  const $ = id => document.getElementById(id);
  const el = {
    summary: $('contextOverviewSummary'),
    scanState: $('contextScanState'),
    scanText: $('contextScanText'),
    publisherGrid: $('publisherStatusGrid'),
    integrityGrid: $('integrityStatusGrid'),
    filter: $('contextFilter'),
    referencesHeading: $('referencesHeading')
  };
  if (!el.publisherGrid || !el.integrityGrid || !el.filter) return;

  let settings = api.defaultSettings();
  let publisherReport = null;
  let integrityReport = null;
  let scanState = { publisherScanning: true, integrityScanning: false };
  let loadPending = false;
  let loadQueued = false;

  function runtimeSend(message, callback) {
    try {
      chrome.runtime.sendMessage(message, response => {
        const error = chrome.runtime.lastError;
        callback?.(error ? null : response);
      });
    } catch {
      callback?.(null);
    }
  }

  function keyFor(record, fallback) {
    const doi = String(record?.doi || '').trim().toLowerCase();
    return doi ? `doi:${doi}` : `${record?.kind || 'item'}:${record?.id || fallback}`;
  }

  function allContextCounts() {
    const all = new Set();
    const publishers = new Set();
    const formal = new Set();
    const publisherRecords = [
      publisherReport?.currentArticle,
      ...(publisherReport?.references || []),
      ...(publisherReport?.searchResults || [])
    ].filter(Boolean);

    for (const record of publisherRecords) {
      if (!(record.matches || []).length) continue;
      const key = keyFor(record, `publisher-${publishers.size + 1}`);
      publishers.add(key);
      all.add(key);
    }
    for (const record of integrityReport?.records || []) {
      if (!record?.primaryStatus) continue;
      const key = keyFor(record, `integrity-${formal.size + 1}`);
      formal.add(key);
      all.add(key);
    }
    return { total: all.size, publishers: publishers.size, formal: formal.size };
  }

  function profileCounts() {
    const counts = new Map();
    const records = [...(publisherReport?.references || []), ...(publisherReport?.searchResults || [])];
    for (const record of records) {
      const seen = new Set();
      for (const match of record.matches || []) {
        if (!match?.profileId || seen.has(match.profileId)) continue;
        seen.add(match.profileId);
        counts.set(match.profileId, (counts.get(match.profileId) || 0) + 1);
      }
    }
    return counts;
  }

  function createSignalCard({ filter, count, label, color, detail = '', zero = false, className = '' }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `signal-card ${className}`.trim();
    button.dataset.contextFilter = filter;
    button.setAttribute('aria-pressed', 'false');
    button.title = `Filter reference results by ${label}`;
    if (color) {
      button.style.setProperty('--signal-color', color);
      button.style.setProperty('--signal-tint', `${color}0D`);
    }
    if (zero) button.classList.add('is-zero');

    const value = document.createElement('strong');
    value.textContent = String(count);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(value, text);
    if (detail) {
      const small = document.createElement('small');
      small.textContent = detail;
      button.appendChild(small);
    }
    return button;
  }

  function renderPublisherCards() {
    const counts = profileCounts();
    const profiles = (settings.profiles || []).filter(profile => profile.enabled);
    el.publisherGrid.replaceChildren();

    const totalMatches = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
    el.publisherGrid.appendChild(createSignalCard({
      filter: 'publisher:any',
      count: totalMatches,
      label: 'All publishers',
      color: '#48627A',
      detail: 'Watchlist'
    }));

    for (const profile of profiles) {
      const count = counts.get(profile.id) || 0;
      el.publisherGrid.appendChild(createSignalCard({
        filter: `profile:${profile.id}`,
        count,
        label: profile.name,
        color: profile.color,
        detail: profile.action === 'none' ? 'Context' : profile.action,
        zero: count === 0,
        className: 'publisher-signal-card'
      }));
    }
  }

  function renderSummary() {
    if (!el.summary) return;
    const counts = allContextCounts();
    const parts = [`${counts.total} contextual item${counts.total === 1 ? '' : 's'}`];
    if (counts.publishers) parts.push(`${counts.publishers} publisher match${counts.publishers === 1 ? '' : 'es'}`);
    if (counts.formal) parts.push(`${counts.formal} formal signal${counts.formal === 1 ? '' : 's'}`);
    el.summary.textContent = parts.join(' · ');
  }

  function completedIntegrityRecords() {
    if (Number.isFinite(integrityReport?.completed)) return Math.max(0, Math.trunc(integrityReport.completed));
    return (integrityReport?.records || []).filter(record => record?.lookupStatus && !['pending', 'cancelled'].includes(record.lookupStatus)).length;
  }

  function renderScanState() {
    if (!el.scanState || !el.scanText) return;
    const publisherScanning = scanState.publisherScanning === true || !publisherReport;
    const integrityScanning = integrityReport?.state === 'loading' || scanState.integrityScanning === true;

    if (!publisherScanning && !integrityScanning) {
      el.scanState.hidden = true;
      return;
    }

    el.scanState.hidden = false;
    el.scanState.dataset.state = 'loading';
    if (publisherScanning && integrityScanning) {
      el.scanText.textContent = 'Scanning citation context and checking formal updates…';
    } else if (publisherScanning) {
      el.scanText.textContent = 'Scanning publisher profiles and citation links…';
    } else {
      const attempted = Math.max(0, Math.trunc(Number(integrityReport?.attempted) || 0));
      const completed = Math.min(attempted, completedIntegrityRecords());
      el.scanText.textContent = attempted
        ? `Publisher scan complete · checking formal updates ${completed}/${attempted}…`
        : 'Checking formal update records…';
    }
  }

  function syncActiveCards() {
    const selected = el.filter.value || 'all';
    for (const card of document.querySelectorAll('[data-context-filter]')) {
      const active = card.dataset.contextFilter === selected;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', String(active));
    }
  }

  function activateFilter(filter) {
    const next = el.filter.value === filter ? 'all' : filter;
    const optionExists = Array.from(el.filter.options).some(option => option.value === next);
    if (!optionExists) return;
    el.filter.value = next;
    el.filter.dispatchEvent(new Event('change', { bubbles: true }));
    syncActiveCards();
    if (next !== 'all') el.referencesHeading?.scrollIntoView({ block: 'start' });
  }

  function render() {
    renderPublisherCards();
    renderSummary();
    renderScanState();
    syncActiveCards();
  }

  function load() {
    if (loadPending) {
      loadQueued = true;
      return;
    }
    loadPending = true;
    let remaining = 3;
    const done = () => {
      remaining -= 1;
      if (remaining > 0) return;
      loadPending = false;
      render();
      if (loadQueued) {
        loadQueued = false;
        setTimeout(load, 25);
      }
    };

    runtimeSend({ type: 'getPublisherContext' }, response => {
      publisherReport = response?.report || null;
      settings = response?.settings || settings;
      done();
    });
    runtimeSend({ type: 'getIntegrityReport' }, response => {
      integrityReport = response?.report || null;
      done();
    });
    runtimeSend({ type: 'getContextScanState' }, response => {
      scanState = response || scanState;
      done();
    });
  }

  document.addEventListener('click', event => {
    const card = event.target.closest('[data-context-filter]');
    if (!card) return;
    activateFilter(card.dataset.contextFilter);
  });
  el.filter.addEventListener('change', syncActiveCards);

  chrome.runtime.onMessage.addListener(message => {
    if ([
      'publisherScanStateUpdated',
      'publisherContextUpdated',
      'integrityProgressUpdated',
      'integrityReportUpdated'
    ].includes(message?.type)) load();
    return false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.publisherWatchlist) load();
  });

  load();
  setTimeout(load, 500);
});