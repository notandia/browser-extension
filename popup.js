'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const api = globalThis.NotandiaPublisherProfiles;
  if (!api) return;

  const $ = id => document.getElementById(id);
  const el = {
    settingsIcon: $('settingsIcon'), settingsPanel: $('settingsPanel'), integrity: $('integrityLookupsEnabled'),
    ncbi: $('ncbiApiEnabledPopup'), logging: $('loggingEnabled'), save: $('saveQuickSettings'),
    manage: $('managePublishers'), status: $('status'), rescan: $('rescan'), article: $('articleContext'),
    pageCoverage: $('pageCoverage'), integrityCoverage: $('integrityCoverage'), itemsCoverage: $('itemsCoverage'),
    items: $('contextItems'), reportCategory: $('reportCategory'), report: $('reportIssue')
  };

  const countIds = { retracted: 'countRetracted', 'expression-of-concern': 'countConcern', corrected: 'countCorrected' };
  const fallbackStatuses = {
    retracted: { label: 'Retracted', icon: '×', color: '#B42318' },
    'expression-of-concern': { label: 'Expression of concern', icon: '!', color: '#B54708' },
    corrected: { label: 'Corrected', icon: '✎', color: '#175CD3' },
    reinstated: { label: 'Reinstated', icon: '↩', color: '#067647' },
    'duplicate-publication': { label: 'Duplicate publication', icon: '≡', color: '#6941C6' },
    withdrawn: { label: 'Withdrawn or removed', icon: '–', color: '#475467' }
  };

  let publisherSettings = api.createDefaultSettings();
  let publisherReport = null;
  let integrityReport = null;
  let integrityStatuses = fallbackStatuses;

  function setStatus(message, timeout = 3500) {
    el.status.textContent = message;
    if (timeout) setTimeout(() => { el.status.textContent = ''; }, timeout);
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

  async function requestFirefoxDataConsent() {
    if (!usesFirefoxDataConsent()) return true;
    return browser.permissions.request({ data_collection: ['websiteContent'] });
  }

  async function removeFirefoxDataConsent() {
    if (!usesFirefoxDataConsent()) return true;
    return browser.permissions.remove({ data_collection: ['websiteContent'] });
  }

  function chip(label, color, title = '') {
    const node = document.createElement('span');
    node.className = 'chip';
    node.textContent = label;
    node.style.setProperty('--chip-color', color || '#48627A');
    if (title) node.title = title;
    return node;
  }

  function publisherChips(matches = []) {
    return matches.map(match => chip(
      `${match.name}${match.confidence === 'potential' ? ' · potential' : ''}`,
      match.color,
      `Personal publisher watchlist · ${(match.reasons || []).join(', ')}`
    ));
  }

  function integrityChips(events = []) {
    return events.map(event => {
      const definition = integrityStatuses[event.status] || fallbackStatuses[event.status] || {};
      return chip(
        `${definition.icon || '•'} ${definition.label || event.status}`,
        definition.color || '#475467',
        [event.date && `Date: ${String(event.date).slice(0, 10)}`, event.source && `Source: ${event.source}`, event.noticeDoi && `Notice DOI: ${event.noticeDoi}`].filter(Boolean).join('\n')
      );
    });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function integrityByKey() {
    const map = new Map();
    for (const record of integrityReport?.records || []) {
      const key = record.doi || record.id;
      if (key) map.set(key, record);
    }
    return map;
  }

  function renderArticle() {
    clear(el.article);
    const publisher = publisherReport?.currentArticle || null;
    const integrity = (integrityReport?.records || []).find(record => record.kind === 'current-article') || null;
    if (!publisher && !integrity?.primaryStatus) {
      const placeholder = document.createElement('p');
      placeholder.className = 'placeholder';
      placeholder.textContent = 'No selected publisher profile or formal integrity signal detected for this page.';
      el.article.appendChild(placeholder);
      el.pageCoverage.textContent = 'Publisher classification and integrity status are independent.';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'context-primary';
    const title = document.createElement('div');
    title.className = 'context-title';
    title.textContent = 'Current article';
    wrapper.appendChild(title);
    const doiValue = publisher?.doi || integrity?.doi;
    if (doiValue) {
      const doi = document.createElement('div');
      doi.className = 'context-doi';
      doi.textContent = doiValue;
      wrapper.appendChild(doi);
    }
    const chips = document.createElement('div');
    chips.className = 'chip-row';
    for (const node of [...publisherChips(publisher?.matches), ...integrityChips(integrity?.events)]) chips.appendChild(node);
    wrapper.appendChild(chips);
    el.article.appendChild(wrapper);
    el.pageCoverage.textContent = publisher?.matches?.length
      ? `${publisher.matches.length} selected publisher profile${publisher.matches.length === 1 ? '' : 's'} matched.`
      : 'No selected publisher profile matched; a formal integrity signal was found.';
  }

  function renderCounts() {
    const counts = integrityReport?.summary?.counts || {};
    for (const [status, id] of Object.entries(countIds)) {
      const value = Number(counts[status]) || 0;
      const node = $(id);
      node.textContent = String(value);
      node.closest('.status-card')?.classList.toggle('has-signal', value > 0);
    }
    const other = (Number(counts.reinstated) || 0) + (Number(counts['duplicate-publication']) || 0) + (Number(counts.withdrawn) || 0);
    $('countOther').textContent = String(other);
    $('countOther').closest('.status-card')?.classList.toggle('has-signal', other > 0);

    if (!el.integrity.checked) el.integrityCoverage.textContent = 'Disabled. Enable integrity checks in quick settings.';
    else if (!integrityReport) el.integrityCoverage.textContent = 'Waiting for identifiable DOI metadata…';
    else if (integrityReport.state === 'loading') el.integrityCoverage.textContent = `Checking ${integrityReport.attempted || 0} of ${integrityReport.totalDiscovered || 0} discovered DOIs…`;
    else {
      const parts = [`${integrityReport.summary?.checked || 0} checked`];
      if (integrityReport.notChecked) parts.push(`${integrityReport.notChecked} deferred`);
      if (integrityReport.summary?.failed) parts.push(`${integrityReport.summary.failed} unresolved`);
      parts.push(integrityReport.provider || 'Crossref');
      el.integrityCoverage.textContent = parts.join(' · ');
    }
  }

  function combinedItems() {
    const map = new Map();
    const integrityMap = integrityByKey();
    for (const record of [...(publisherReport?.references || []), ...(publisherReport?.searchResults || [])]) {
      const key = record.doi || record.id;
      map.set(key, { ...record, integrity: integrityMap.get(key) || null });
    }
    for (const record of integrityReport?.records || []) {
      if (record.kind === 'current-article' || !record.primaryStatus) continue;
      const key = record.doi || record.id;
      if (!map.has(key)) map.set(key, { id: record.id, kind: record.kind, number: record.number, doi: record.doi, text: record.text, matches: [], integrity: record });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'reference' ? -1 : 1;
      return (a.number || 9999) - (b.number || 9999);
    });
  }

  function renderItems() {
    clear(el.items);
    const items = combinedItems();
    if (!items.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'placeholder';
      placeholder.textContent = 'No selected publisher matches or formal integrity signals found.';
      el.items.appendChild(placeholder);
    } else {
      for (const record of items) {
        const item = document.createElement('li');
        item.className = 'context-item';
        if (record.kind === 'reference' && record.id) {
          item.dataset.refId = record.id;
          item.tabIndex = 0;
        }
        const heading = document.createElement('div');
        heading.className = 'item-heading';
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
        for (const node of [...publisherChips(record.matches), ...integrityChips(record.integrity?.events)]) chips.appendChild(node);
        item.appendChild(chips);
        el.items.appendChild(item);
      }
    }

    const matched = publisherReport?.summary?.matchedItems || 0;
    const affected = integrityReport?.summary?.affected || 0;
    el.itemsCoverage.textContent = `${matched} watchlist match${matched === 1 ? '' : 'es'} · ${affected} work${affected === 1 ? '' : 's'} with formal signals`;
  }

  function renderAll() {
    renderArticle();
    renderCounts();
    renderItems();
  }

  function loadReports(attempt = 0) {
    chrome.runtime.sendMessage({ type: 'getPublisherContext' }, response => {
      if (!chrome.runtime.lastError) publisherReport = response?.report || null;
      renderAll();
    });
    chrome.runtime.sendMessage({ type: 'getIntegrityReport' }, response => {
      if (!chrome.runtime.lastError) {
        integrityReport = response?.report || null;
        integrityStatuses = response?.statuses || fallbackStatuses;
      }
      renderAll();
      if (attempt < 3 && (!publisherReport || (el.integrity.checked && !integrityReport))) setTimeout(() => loadReports(attempt + 1), 350);
    });
  }

  function requestRescan() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id;
      if (!Number.isInteger(tabId)) return;
      chrome.tabs.sendMessage(tabId, { type: 'forcePublisherRescan' }, () => void chrome.runtime.lastError);
      chrome.tabs.sendMessage(tabId, { type: 'forceIntegrityRescan' }, () => void chrome.runtime.lastError);
      el.pageCoverage.textContent = 'Rescanning page…';
      setTimeout(() => loadReports(0), 450);
    });
  }

  async function loadSettings() {
    chrome.storage.sync.get(null, async storage => {
      if (chrome.runtime.lastError) return setStatus('Could not load settings.');
      publisherSettings = api.migratePublisherSettings(storage || {});
      el.ncbi.checked = storage.ncbiApiEnabled !== false;
      el.logging.checked = storage.loggingEnabled === true;
      const permitted = await hasFirefoxDataConsent().catch(() => false);
      el.integrity.checked = storage.integrityLookupsEnabled === true && permitted;
      if (storage.integrityLookupsEnabled === true && !permitted) chrome.storage.sync.set({ integrityLookupsEnabled: false });
      renderAll();
      loadReports(0);
    });
  }

  el.settingsIcon.addEventListener('click', () => {
    const open = el.settingsPanel.classList.toggle('open');
    el.settingsIcon.setAttribute('aria-expanded', String(open));
  });

  el.manage.addEventListener('click', () => chrome.runtime.openOptionsPage());
  el.rescan.addEventListener('click', requestRescan);

  el.save.addEventListener('click', () => {
    void (async () => {
      if (el.integrity.checked) {
        const granted = await requestFirefoxDataConsent().catch(() => false);
        if (!granted) {
          el.integrity.checked = false;
          setStatus('Firefox data permission was not granted.');
          return;
        }
      } else await removeFirefoxDataConsent().catch(() => false);

      chrome.storage.sync.set({
        publisherProfiles: api.normalizeSettings(publisherSettings),
        publisherProfilesEnabled: true,
        mode: 'none',
        integrityLookupsEnabled: el.integrity.checked,
        ncbiApiEnabled: el.ncbi.checked,
        loggingEnabled: el.logging.checked
      }, () => {
        if (chrome.runtime.lastError) return setStatus('Could not save settings.');
        chrome.runtime.sendMessage({ type: 'publisherSettingsChanged' }, () => void chrome.runtime.lastError);
        setStatus('Settings saved.');
        requestRescan();
      });
    })();
  });

  function scrollToReference(refId) {
    chrome.runtime.sendMessage({ type: 'scrollToRef', refId }, response => {
      if (chrome.runtime.lastError || !response?.success) setStatus('Could not locate that reference.');
    });
  }

  el.items.addEventListener('click', event => {
    const item = event.target.closest('li[data-ref-id]');
    if (item) scrollToReference(item.dataset.refId);
  });
  el.items.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const item = event.target.closest('li[data-ref-id]');
    if (item) {
      event.preventDefault();
      scrollToReference(item.dataset.refId);
    }
  });

  el.report.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      try {
        const parsed = new URL(tabs[0]?.url || '');
        if (!/^https?:$/.test(parsed.protocol)) throw new Error('unsupported page');
        const manifest = chrome.runtime.getManifest();
        const category = el.reportCategory.value;
        const categoryLabel = el.reportCategory.selectedOptions[0]?.textContent || category;
        const enabledProfiles = api.enabledProfileIds(publisherSettings);
        const address = `${parsed.origin}${parsed.pathname}`;
        const title = encodeURIComponent(`${categoryLabel} on ${parsed.hostname}`);
        const body = encodeURIComponent([
          '**Report an article/context issue**', '',
          'Before submitting, remove information you do not want public.', '',
          `**Category:** ${category}`,
          `**Webpage address (query and fragment omitted):** ${address}`,
          `**Enabled publisher profiles:** ${enabledProfiles.join(', ') || 'none'}`,
          `**Integrity checks:** ${el.integrity.checked ? 'enabled' : 'disabled'}`,
          `**Extension:** ${manifest.name}`,
          `**Version:** ${manifest.version}`,
          `**Browser:** ${navigator.userAgent.slice(0, 240)}`, '',
          '**What happened?**',
          '[Describe the incorrect or missing context. Add a DOI only when useful and safe to share.]'
        ].join('\n'));
        chrome.tabs.create({ url: `https://github.com/notandia/browser-extension/issues/new?title=${title}&body=${body}` });
      } catch {
        setStatus('Reports are available only for normal web pages.');
      }
    });
  });

  loadSettings();
});
