'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const api = globalThis.NotandiaPublisherProfiles;
  if (!api) throw new Error('Publisher profile runtime failed to load');
  const $ = id => document.getElementById(id);
  const el = {
    settings: $('settingsIcon'), panel: $('settingsPanel'), quickProfiles: $('quickProfiles'), save: $('save'), status: $('status'),
    integrity: $('integrityLookupsEnabled'), ncbi: $('ncbiApiEnabledPopup'), logging: $('loggingEnabled'), manage: $('managePublishers'),
    articleSection: $('articleContextSection'), article: $('articleContext'), articleSummary: $('articleContextSummary'), integrityCoverage: $('integrityCoverage'),
    contextList: $('contextList'), referencesSummary: $('referencesSummary'), contextFilter: $('contextFilter'), contextSort: $('contextSort'),
    rescan: $('rescan'), report: $('reportIssue'), reportCategory: $('reportCategory')
  };
  const countIds = { retracted: 'countRetracted', 'expression-of-concern': 'countConcern', corrected: 'countCorrected', withdrawn: 'countWithdrawn' };
  let watchlist = api.defaultSettings();
  let publisherReport = null;
  let integrityReport = null;
  let integrityStatuses = {};
  let restoreInFlight = false;
  let reloadQueued = false;

  function setStatus(message) {
    el.status.textContent = message;
    if (message) setTimeout(() => { if (el.status.textContent === message) el.status.textContent = ''; }, 3500);
  }

  function rgba(hex, alpha) {
    const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(String(hex || ''));
    if (!match) return `rgba(72,98,122,${alpha})`;
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})`;
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function cleanReferenceText(record) {
    let text = String(record?.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';

    text = text
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/\bPubMed Central\b/gi, ' ')
      .replace(/\bGoogle Scholar\b/gi, ' ')
      .replace(/\bPubMed\b/gi, ' ')
      .replace(/\bCAS\b/g, ' ')
      .replace(/\bArticle\b(?=\s*(?:$|[.,;]))/gi, ' ');

    const doi = String(record?.doi || '').trim();
    if (doi) {
      const pattern = new RegExp(`(?:doi\\s*:\\s*)?(?:https?:\\/\\/(?:dx\\.)?doi\\.org\\/)?${escapeRegExp(doi)}`, 'ig');
      text = text.replace(pattern, ' ');
    }

    text = text
      .replace(/\s+([,.;:)])/g, '$1')
      .replace(/([,.;:])(?:\s*\1)+/g, '$1')
      .replace(/\.\s*\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s,;:.-]+$/g, '')
      .trim();

    return text.slice(0, 420);
  }

  function usesFirefoxDataConsent() {
    const optional = chrome.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional;
    return Array.isArray(optional) && optional.includes('websiteContent') && Boolean(globalThis.browser?.permissions);
  }

  async function hasFirefoxDataConsent() {
    if (!usesFirefoxDataConsent()) return true;
    const permissions = await browser.permissions.getAll();
    return Array.isArray(permissions.data_collection) && permissions.data_collection.includes('websiteContent');
  }

  async function setFirefoxDataConsent(enabled) {
    if (!usesFirefoxDataConsent()) return true;
    if (enabled) return browser.permissions.request({ data_collection: ['websiteContent'] });
    await browser.permissions.remove({ data_collection: ['websiteContent'] });
    return true;
  }

  function chip(label, color, extraClass = '') {
    const node = document.createElement('span');
    node.className = `chip ${extraClass}`.trim();
    node.textContent = label;
    if (color) {
      node.style.setProperty('--chip-color', color);
      node.style.setProperty('--chip-tint', rgba(color, 0.055));
    }
    return node;
  }

  function statusDefinition(status) {
    return integrityStatuses?.[status] || null;
  }

  function uniqueIntegrityEvents(events) {
    const byStatus = new Map();
    for (const event of Array.isArray(events) ? events : []) {
      const status = String(event?.status || '');
      if (!status) continue;
      const existing = byStatus.get(status);
      if (!existing || Number(event?.timestamp || 0) > Number(existing?.timestamp || 0)) byStatus.set(status, event);
    }
    return Array.from(byStatus.values()).sort((left, right) => {
      const leftSeverity = Number(statusDefinition(left.status)?.severity || 0);
      const rightSeverity = Number(statusDefinition(right.status)?.severity || 0);
      return rightSeverity - leftSeverity || String(left.status).localeCompare(String(right.status));
    });
  }

  function refreshContextFilterOptions() {
    const previous = el.contextFilter.value || 'all';
    const options = [
      ['all', 'All results'],
      ['integrity:any', 'Formal updates'],
      ['status:retracted', 'Retracted'],
      ['status:expression-of-concern', 'Expression of concern'],
      ['status:corrected', 'Corrected'],
      ['status:withdrawn', 'Withdrawn'],
      ['publisher:any', 'Publisher matches']
    ];
    for (const profile of watchlist.profiles.filter(profile => profile.enabled)) {
      options.push([`profile:${profile.id}`, profile.name]);
    }
    el.contextFilter.replaceChildren();
    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      el.contextFilter.appendChild(option);
    }
    el.contextFilter.value = options.some(([value]) => value === previous) ? previous : 'all';
  }

  function renderQuickProfiles() {
    el.quickProfiles.replaceChildren();
    for (const profile of watchlist.profiles) {
      const row = document.createElement('div');
      row.className = 'quick-profile';
      row.dataset.profileId = profile.id;
      const label = document.createElement('label');
      const enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.className = 'quick-enabled';
      enabled.checked = profile.enabled;
      const name = document.createElement('strong');
      name.textContent = profile.name;
      label.append(enabled, name);
      const action = document.createElement('select');
      action.className = 'quick-action';
      for (const value of api.ACTIONS) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = { none: 'Context', badge: 'Badge', highlight: 'Highlight', dim: 'Dim', hide: 'Hide' }[value];
        option.selected = value === profile.action;
        action.appendChild(option);
      }
      const color = document.createElement('input');
      color.type = 'color';
      color.className = 'quick-color';
      color.value = profile.color;
      color.title = `${profile.name} color`;
      row.append(label, action, color);
      el.quickProfiles.appendChild(row);
    }
    refreshContextFilterOptions();
  }

  function readQuickProfiles() {
    const byId = new Map(watchlist.profiles.map(profile => [profile.id, profile]));
    for (const row of el.quickProfiles.querySelectorAll('.quick-profile')) {
      const profile = byId.get(row.dataset.profileId);
      if (!profile) continue;
      profile.enabled = row.querySelector('.quick-enabled').checked;
      profile.action = row.querySelector('.quick-action').value;
      profile.color = row.querySelector('.quick-color').value;
    }
    watchlist = api.sanitizeSettings({ ...watchlist, profiles: Array.from(byId.values()) });
    refreshContextFilterOptions();
  }

  function appendIntegrityChips(container, events, primaryStatus) {
    for (const event of uniqueIntegrityEvents(events)) {
      const definition = statusDefinition(event.status);
      const label = definition?.label || event.status;
      const color = definition?.color || '#B42318';
      const extraClass = event.status === primaryStatus ? 'integrity primary-integrity' : 'integrity';
      container.appendChild(chip(label, color, extraClass));
    }
  }

  function renderArticleContext() {
    el.article.replaceChildren();
    const matches = publisherReport?.currentArticle?.matches || [];
    const currentIntegrity = (integrityReport?.records || []).find(record => record.kind === 'current-article');
    if (!matches.length && !currentIntegrity?.primaryStatus) {
      el.articleSection.hidden = true;
      el.articleSummary.textContent = '';
      return;
    }

    el.articleSection.hidden = false;
    const title = document.createElement('strong');
    title.textContent = matches.length ? matches.map(match => match.profileName).join(', ') : 'Formal update found';
    const doi = document.createElement('code');
    doi.textContent = publisherReport?.currentArticle?.doi || currentIntegrity?.doi || '';
    const chips = document.createElement('div');
    chips.className = 'chip-row';
    for (const match of matches) chips.appendChild(chip(match.profileName, match.color));
    appendIntegrityChips(chips, currentIntegrity?.events || [], currentIntegrity?.primaryStatus);
    el.article.append(title);
    if (doi.textContent) el.article.append(doi);
    el.article.append(chips);

    const parts = [];
    if (matches.length) parts.push(`${matches.length} publisher match${matches.length === 1 ? '' : 'es'}`);
    if (currentIntegrity?.primaryStatus) parts.push('formal update');
    el.articleSummary.textContent = parts.join(' · ');
  }

  function setIntegrityCounts() {
    const counts = integrityReport?.summary?.counts || {};
    for (const [status, id] of Object.entries(countIds)) {
      const count = Number(counts[status]) || 0;
      const node = $(id);
      node.textContent = String(count);
      const card = node.closest('[data-context-filter]');
      const active = card?.dataset.contextFilter === el.contextFilter.value;
      if (card) card.hidden = count === 0 && !active;
    }

    if (!el.integrity.checked) el.integrityCoverage.textContent = 'Formal checks off';
    else if (!integrityReport) el.integrityCoverage.textContent = 'Waiting for DOI records';
    else if (integrityReport.state === 'loading') el.integrityCoverage.textContent = `Checking ${integrityReport.attempted || 0} DOI records`;
    else {
      const summary = integrityReport.summary || {};
      const parts = [`${summary.checked || 0} checked`];
      if (summary.failed) parts.push(`${summary.failed} not verified`);
      if (integrityReport.notChecked) parts.push(`${integrityReport.notChecked} deferred`);
      el.integrityCoverage.textContent = parts.join(' · ');
    }
  }

  function recordKey(record) {
    return record?.doi ? `doi:${record.doi.toLowerCase()}` : `id:${record?.id || ''}`;
  }

  function recordMatchesFilter(record) {
    const filter = el.contextFilter.value || 'all';
    if (filter === 'all') return true;
    if (filter === 'publisher:any') return (record.matches || []).length > 0;
    if (filter === 'integrity:any') return Boolean(record.primaryStatus);
    if (filter.startsWith('status:')) {
      const status = filter.slice('status:'.length);
      return record.primaryStatus === status || uniqueIntegrityEvents(record.events).some(event => event.status === status);
    }
    if (filter.startsWith('profile:')) {
      const profileId = filter.slice('profile:'.length);
      return (record.matches || []).some(match => match.profileId === profileId);
    }
    return true;
  }

  function recordSeverity(record) {
    const statuses = uniqueIntegrityEvents(record.events).map(event => Number(statusDefinition(event.status)?.severity || 0));
    if (record.primaryStatus) statuses.push(Number(statusDefinition(record.primaryStatus)?.severity || 0));
    return Math.max(0, ...statuses);
  }

  function recordAccent(record) {
    const definition = statusDefinition(record.primaryStatus);
    if (definition?.color) return definition.color;
    return api.resolveVisualMatch(record.matches || [])?.color || null;
  }

  function renderContextList() {
    el.contextList.replaceChildren();
    const merged = new Map();
    for (const record of [...(publisherReport?.references || []), ...(publisherReport?.searchResults || [])]) {
      merged.set(recordKey(record), { ...record, matches: record.matches || [], events: [] });
    }
    for (const record of integrityReport?.records || []) {
      if (record.kind === 'current-article') continue;
      const key = recordKey(record);
      const existing = merged.get(key) || { id: record.id, kind: record.kind, number: record.number, doi: record.doi, text: record.text, matches: [] };
      existing.events = uniqueIntegrityEvents(record.events || []);
      existing.primaryStatus = record.primaryStatus;
      merged.set(key, existing);
    }

    const allRecords = Array.from(merged.values()).filter(record => (record.matches || []).length || record.primaryStatus);
    refreshContextFilterOptions();
    const records = allRecords.filter(recordMatchesFilter);
    const sortMode = el.contextSort.value || 'reference';
    records.sort((left, right) => {
      if (sortMode === 'severity') {
        const severityDifference = recordSeverity(right) - recordSeverity(left);
        if (severityDifference) return severityDifference;
      }
      return (left.number || 9999) - (right.number || 9999);
    });

    if (!records.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'placeholder';
      placeholder.textContent = allRecords.length
        ? 'No references match this filter.'
        : 'No publisher matches or known formal updates were found.';
      el.contextList.appendChild(placeholder);
      el.referencesSummary.textContent = allRecords.length ? `0 of ${allRecords.length} references shown` : 'Nothing to review';
      return;
    }

    for (const record of records) {
      const item = document.createElement('li');
      item.className = 'context-item';
      const accent = recordAccent(record);
      if (accent) {
        item.classList.add('context-item-accented');
        item.style.setProperty('--context-accent', accent);
        item.style.setProperty('--context-tint', rgba(accent, 0.025));
      }
      if (record.id) {
        item.dataset.refId = record.id;
        item.tabIndex = 0;
      }

      const heading = document.createElement('div');
      heading.className = 'context-item-heading';
      const label = document.createElement('strong');
      label.textContent = record.kind === 'search-result' ? `Search result ${record.number || ''}`.trim() : `Reference ${record.number || ''}`.trim();
      const doi = document.createElement('code');
      doi.textContent = record.doi || '';
      doi.title = record.doi || '';
      heading.append(label, doi);
      item.appendChild(heading);

      const cleanedText = cleanReferenceText(record);
      if (cleanedText) {
        const text = document.createElement('p');
        text.textContent = cleanedText;
        text.title = cleanedText;
        item.appendChild(text);
      }

      const chips = document.createElement('div');
      chips.className = 'chip-row';
      for (const match of record.matches || []) chips.appendChild(chip(match.profileName, match.color));
      appendIntegrityChips(chips, record.events || [], record.primaryStatus);
      if (chips.childElementCount) item.appendChild(chips);
      el.contextList.appendChild(item);
    }

    el.referencesSummary.textContent = records.length === allRecords.length
      ? `${records.length} reference${records.length === 1 ? '' : 's'} shown`
      : `${records.length} of ${allRecords.length} references shown`;
  }

  function renderAll() {
    renderArticleContext();
    setIntegrityCounts();
    renderContextList();
  }

  function fetchReports() {
    chrome.runtime.sendMessage({ type: 'getPublisherContext' }, response => {
      if (!chrome.runtime.lastError) {
        publisherReport = response?.report || null;
        renderAll();
      }
    });
    chrome.runtime.sendMessage({ type: 'getIntegrityReport' }, response => {
      if (!chrome.runtime.lastError) {
        integrityReport = response?.report || null;
        integrityStatuses = response?.statuses || {};
        renderAll();
      }
    });
  }

  function loadReports() {
    if (restoreInFlight) {
      reloadQueued = true;
      return;
    }
    restoreInFlight = true;
    chrome.runtime.sendMessage({ type: 'restorePersistedTabState' }, () => {
      void chrome.runtime.lastError;
      restoreInFlight = false;
      fetchReports();
      if (reloadQueued) {
        reloadQueued = false;
        setTimeout(loadReports, 25);
      }
    });
  }

  function forceRescan() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!Number.isInteger(tabs[0]?.id)) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'forcePublisherRescan' }, () => void chrome.runtime.lastError);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'forceIntegrityRescan' }, () => void chrome.runtime.lastError);
      setTimeout(loadReports, 500);
      setTimeout(loadReports, 1600);
    });
  }

  el.settings.addEventListener('click', () => {
    const open = el.panel.classList.toggle('open');
    el.settings.setAttribute('aria-expanded', String(open));
  });
  el.manage.addEventListener('click', () => chrome.runtime.openOptionsPage());
  el.rescan.addEventListener('click', forceRescan);
  el.contextFilter.addEventListener('change', () => {
    setIntegrityCounts();
    renderContextList();
  });
  el.contextSort.addEventListener('change', renderContextList);

  el.contextList.addEventListener('click', event => {
    const item = event.target.closest('li[data-ref-id]');
    if (!item) return;
    chrome.runtime.sendMessage({ type: 'scrollToRef', refId: item.dataset.refId }, () => void chrome.runtime.lastError);
  });
  el.contextList.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const item = event.target.closest('li[data-ref-id]');
    if (!item) return;
    event.preventDefault();
    chrome.runtime.sendMessage({ type: 'scrollToRef', refId: item.dataset.refId }, () => void chrome.runtime.lastError);
  });

  el.save.addEventListener('click', () => {
    void (async () => {
      readQuickProfiles();
      const consent = await setFirefoxDataConsent(el.integrity.checked).catch(() => false);
      if (el.integrity.checked && !consent) {
        el.integrity.checked = false;
        return setStatus('Firefox data permission was not granted.');
      }
      const mdpi = watchlist.profiles.find(profile => profile.id === 'mdpi');
      chrome.storage.sync.set({
        publisherWatchlist: watchlist,
        integrityLookupsEnabled: el.integrity.checked,
        ncbiApiEnabled: el.ncbi.checked,
        loggingEnabled: el.logging.checked,
        mode: mdpi?.action === 'hide' ? 'hide' : 'highlight',
        highlightPotentialMdpiSites: mdpi?.confidencePolicy === 'confirmed-and-potential',
        potentialMdpiHighlightColor: mdpi?.color || '#E2211C'
      }, () => {
        if (chrome.runtime.lastError) return setStatus('Could not save settings.');
        setStatus('Settings saved.');
        forceRescan();
      });
    })();
  });

  el.report.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      try {
        const parsed = new URL(tabs[0]?.url || '');
        if (!/^https?:$/.test(parsed.protocol)) throw new Error();
        const address = `${parsed.origin}${parsed.pathname}`;
        const manifest = chrome.runtime.getManifest();
        const enabledProfiles = watchlist.profiles.filter(profile => profile.enabled).map(profile => profile.id).join(', ') || 'none';
        const category = el.reportCategory.value;
        const title = encodeURIComponent(`[${category}] Context issue on ${parsed.hostname}`);
        const body = encodeURIComponent(`**Notandia article/context report**\n\n**Category:** ${category}\n\n**Page address (query and fragment omitted):**\n${address}\n\n**What happened?**\n[Describe the incorrect or missing context. Add a DOI or citation only when useful and safe to share.]\n\n---\n- Extension version: ${manifest.version}\n- Enabled publisher profiles: ${enabledProfiles}\n- Integrity checks: ${el.integrity.checked ? 'enabled' : 'disabled'}\n- Browser: ${navigator.userAgent}`);
        chrome.tabs.create({ url: `https://github.com/notandia/browser-extension/issues/new?title=${title}&body=${body}` });
      } catch {
        setStatus('Reports are available only for web pages.');
      }
    });
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'integrityReportUpdated' || message?.type === 'publisherContextUpdated') loadReports();
  });

  chrome.storage.sync.get({
    publisherWatchlist: null,
    mode: 'highlight',
    highlightPotentialMdpiSites: true,
    potentialMdpiHighlightColor: '#E2211C',
    integrityLookupsEnabled: false,
    ncbiApiEnabled: true,
    loggingEnabled: false
  }, stored => {
    watchlist = api.migrateLegacySettings(stored);
    renderQuickProfiles();
    el.ncbi.checked = stored.ncbiApiEnabled !== false;
    el.logging.checked = stored.loggingEnabled === true;
    void hasFirefoxDataConsent().then(permitted => {
      el.integrity.checked = stored.integrityLookupsEnabled === true && permitted;
      renderAll();
    }).catch(() => { el.integrity.checked = false; });
    if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== api.SCHEMA_VERSION) chrome.storage.sync.set({ publisherWatchlist: watchlist });
    loadReports();
    setTimeout(loadReports, 500);
  });
});