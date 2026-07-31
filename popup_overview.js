'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const api = globalThis.NotandiaPublisherProfiles;
  if (!api) return;

  const $ = id => document.getElementById(id);
  const el = {
    heading: $('contextOverviewHeading'),
    summary: $('contextOverviewSummary'),
    allCount: $('countAllContext'),
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

  function rgba(hex, alpha) {
    const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(String(hex || ''));
    if (!match) return `rgba(72,98,122,${alpha})`;
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})`;
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
      ...(publisherReport?.references || []),
      ...(publisherReport?.searchResults || [])
    ];

    for (const record of publisherRecords) {
      if (!(record.matches || []).length) continue;
      const key = keyFor(record, `publisher-${publishers.size + 1}`);
      publishers.add(key);
      all.add(key);
    }
    for (const record of integrityReport?.records || []) {
      if (record?.kind === 'current-article' || !record?.primaryStatus) continue;
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

  function createSignalCard({ filter, count, label, color }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'signal-card publisher-signal-card';
    button.dataset.contextFilter = filter;
    button.setAttribute('aria-pressed', 'false');
    button.title = `Show ${label} references`;
    if (color) {
      button.style.setProperty('--signal-color', color);
      button.style.setProperty('--signal-tint', rgba(color, 0.07));
    }

    const text = document.createElement('span');
    text.textContent = label;
    const value = document.createElement('strong');
    value.textContent = String(count);
    button.append(text, value);
    return button;
  }

  function renderPublisherCards() {
    const counts = profileCounts();
    const profiles = (settings.profiles || []).filter(profile => profile.enabled && (counts.get(profile.id) || 0) > 0);
    el.publisherGrid.replaceChildren();

    for (const profile of profiles) {
      el.publisherGrid.appendChild(createSignalCard({
        filter: `profile:${profile.id}`,
        count: counts.get(profile.id) || 0,
        label: profile.name,
        color: profile.color
      }));
    }
  }

  function renderSummary() {
    const counts = allContextCounts();
    if (el.allCount) el.allCount.textContent = String(counts.total);

    const stillScanning = scanState.publisherScanning === true || integrityReport?.state === 'loading' || scanState.integrityScanning === true;
    if (el.heading) {
      if (!counts.total && stillScanning) el.heading.textContent = 'Checking this page…';
      else if (!counts.total) el.heading.textContent = 'No reference context found';
      else el.heading.textContent = `${counts.total} reference${counts.total === 1 ? '' : 's'} with context`;
    }

    if (!el.summary) return;
    const parts = [];
    if (counts.publishers) parts.push(`${counts.publishers} publisher match${counts.publishers === 1 ? '' : 'es'}`);
    if (counts.formal) parts.push(`${counts.formal} work${counts.formal === 1 ? '' : 's'} with formal updates`);
    el.summary.textContent = parts.length
      ? parts.join(' · ')
      : stillScanning
        ? 'Looking for publisher matches and formal updates…'
        : 'No watchlist matches or formal updates were found.';
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
        ? `Checking formal updates ${completed}/${attempted}…`
        : 'Checking formal update records…';
    }
  }

  function syncActiveCards() {
    const selected = el.filter.value || 'all';
    for (const card of document.querySelectorAll('[data-context-filter]')) {
      const active = card.dataset.contextFilter === selected;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', String(active));

      if (card.closest('#integrityStatusGrid')) {
        const count = Number(card.querySelector('strong')?.textContent || 0);
        card.hidden = count === 0 && !active;
      }
    }
  }

  function activateFilter(filter) {
    const next = el.filter.value === filter && filter !== 'all' ? 'all' : filter;
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