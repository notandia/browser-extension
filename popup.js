'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const api = globalThis.NotandiaPublisherProfiles;
  if (!api) throw new Error('Publisher profile runtime failed to load');
  const $ = id => document.getElementById(id);
  const el = {
    settings: $('settingsIcon'), panel: $('settingsPanel'), quickProfiles: $('quickProfiles'), save: $('save'), status: $('status'),
    integrity: $('integrityLookupsEnabled'), ncbi: $('ncbiApiEnabledPopup'), logging: $('loggingEnabled'), manage: $('managePublishers'),
    article: $('articleContext'), articleSummary: $('articleContextSummary'), integrityCoverage: $('integrityCoverage'),
    contextList: $('contextList'), referencesSummary: $('referencesSummary'), rescan: $('rescan'), report: $('reportIssue'), reportCategory: $('reportCategory')
  };
  const countIds = { retracted: 'countRetracted', 'expression-of-concern': 'countConcern', corrected: 'countCorrected', withdrawn: 'countWithdrawn' };
  let watchlist = api.defaultSettings();
  let publisherReport = null;
  let integrityReport = null;
  let integrityStatuses = {};

  function setStatus(message) {
    el.status.textContent = message;
    if (message) setTimeout(() => { if (el.status.textContent === message) el.status.textContent = ''; }, 3500);
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
    if (color) node.style.setProperty('--chip-color', color);
    return node;
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
  }

  function renderArticleContext() {
    el.article.replaceChildren();
    const matches = publisherReport?.currentArticle?.matches || [];
    const currentIntegrity = (integrityReport?.records || []).find(record => record.kind === 'current-article');
    if (!matches.length && !currentIntegrity?.primaryStatus) {
      const placeholder = document.createElement('p');
      placeholder.className = 'placeholder';
      placeholder.textContent = 'No enabled publisher profile or formal integrity signal was detected for the current article.';
      el.article.appendChild(placeholder);
      el.articleSummary.textContent = 'Current article has no enabled watchlist match.';
      return;
    }
    const title = document.createElement('strong');
    title.textContent = matches.length ? matches.map(match => match.profileName).join(', ') : 'Current article';
    const doi = document.createElement('code');
    doi.textContent = publisherReport?.currentArticle?.doi || currentIntegrity?.doi || '';
    const chips = document.createElement('div');
    chips.className = 'chip-row';
    for (const match of matches) chips.appendChild(chip(`${match.profileName} · ${match.action}`, match.color));
    for (const event of currentIntegrity?.events || []) chips.appendChild(chip(integrityStatuses[event.status]?.label || event.status, integrityStatuses[event.status]?.color || '#B42318', 'integrity'));
    el.article.append(title);
    if (doi.textContent) el.article.append(doi);
    el.article.append(chips);
    el.articleSummary.textContent = `${matches.length} publisher profile match${matches.length === 1 ? '' : 'es'}${currentIntegrity?.primaryStatus ? ' · formal update found' : ''}`;
  }

  function setIntegrityCounts() {
    const counts = integrityReport?.summary?.counts || {};
    for (const [status, id] of Object.entries(countIds)) $(id).textContent = String(Number(counts[status]) || 0);
    if (!el.integrity.checked) el.integrityCoverage.textContent = 'Integrity lookups are disabled.';
    else if (!integrityReport) el.integrityCoverage.textContent = 'Waiting for identifiable DOI records…';
    else if (integrityReport.state === 'loading') el.integrityCoverage.textContent = `Checking ${integrityReport.attempted || 0} DOI records…`;
    else {
      const summary = integrityReport.summary || {};
      const parts = [`${summary.checked || 0} checked`];
      if (summary.failed) parts.push(`${summary.failed} unresolved`);
      if (integrityReport.notChecked) parts.push(`${integrityReport.notChecked} deferred`);
      parts.push(integrityReport.provider || 'Crossref');
      el.integrityCoverage.textContent = parts.join(' · ');
    }
  }

  function recordKey(record) {
    return record?.doi ? `doi:${record.doi.toLowerCase()}` : `id:${record?.id || ''}`;
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
      existing.events = record.events || [];
      existing.primaryStatus = record.primaryStatus;
      merged.set(key, existing);
    }
    const records = Array.from(merged.values()).filter(record => (record.matches || []).length || record.primaryStatus);
    if (!records.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'placeholder';
      placeholder.textContent = 'No enabled publisher matches or known formal integrity signals were found.';
      el.contextList.appendChild(placeholder);
      el.referencesSummary.textContent = 'No actionable context found.';
      return;
    }
    records.sort((a, b) => (a.number || 9999) - (b.number || 9999));
    for (const record of records) {
      const item = document.createElement('li');
      item.className = 'context-item';
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
      heading.append(label, doi);
      item.appendChild(heading);
      if (record.text) {
        const text = document.createElement('p');
        text.textContent = record.text;
        item.appendChild(text);
      }
      const chips = document.createElement('div');
      chips.className = 'chip-row';
      for (const match of record.matches || []) chips.appendChild(chip(`${match.profileName} · ${match.action}`, match.color));
      for (const event of record.events || []) chips.appendChild(chip(integrityStatuses[event.status]?.label || event.status, integrityStatuses[event.status]?.color || '#B42318', 'integrity'));
      item.appendChild(chips);
      el.contextList.appendChild(item);
    }
    el.referencesSummary.textContent = `${records.length} item${records.length === 1 ? '' : 's'} with watchlist or formal integrity context.`;
  }

  function renderAll() {
    renderArticleContext();
    setIntegrityCounts();
    renderContextList();
  }

  function loadReports() {
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
