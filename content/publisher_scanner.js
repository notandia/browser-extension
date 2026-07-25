'use strict';

;(function initializePublisherScanner() {
  if (window.notandiaPublisherScannerInjected) return;
  window.notandiaPublisherScannerInjected = true;

  const api = window.NotandiaPublisherProfiles;
  if (!api) return;

  const DOI_PATTERN = /\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi;
  const SAFE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const MAX_ITEMS = 500;
  const MAX_TEXT = 700;
  let settings = api.createDefaultSettings();
  let timer = null;
  let fingerprint = '';
  let suppressMutations = false;

  function doisFromValue(value) {
    const output = [];
    const seen = new Set();
    for (const match of String(value || '').matchAll(DOI_PATTERN)) {
      const doi = api.normalizeDoi(match[0]);
      if (doi && !seen.has(doi)) {
        seen.add(doi);
        output.push(doi);
      }
    }
    return output;
  }

  function extractDoi(element) {
    const candidates = [];
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi']) {
      const value = element?.getAttribute?.(attribute);
      if (value) candidates.push(value);
    }
    for (const link of element?.querySelectorAll?.('a[href]') || []) {
      const href = link.getAttribute('href') || '';
      const dataDoi = link.getAttribute('data-doi') || '';
      if (href) candidates.push(href);
      if (dataDoi) candidates.push(dataDoi);
    }
    candidates.push(element?.textContent || '');
    for (const candidate of candidates) {
      const doi = api.normalizeDoi(candidate) || doisFromValue(candidate)[0];
      if (doi) return doi;
    }
    return null;
  }

  function collectUrls(element, includePage = false) {
    const values = [];
    if (includePage) {
      values.push(document.location.href);
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
      if (canonical) values.push(canonical);
    }
    for (const link of element?.querySelectorAll?.('a[href]') || []) {
      const href = link.href || link.getAttribute('href');
      if (href && values.length < 40) values.push(href);
    }
    return values;
  }

  function currentArticleEvidence() {
    const metaDoiSelectors = [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="DC.Identifier"]',
      'meta[name="doi"]',
      'meta[property="citation_doi"]'
    ];
    let doi = null;
    for (const selector of metaDoiSelectors) {
      const value = document.querySelector(selector)?.getAttribute('content') || '';
      doi = api.normalizeDoi(value) || doisFromValue(value)[0] || null;
      if (doi) break;
    }
    if (!doi) doi = doisFromValue(`${document.location.href} ${document.querySelector('link[rel="canonical"]')?.href || ''}`)[0] || null;
    const publisher = [
      'meta[name="citation_publisher"]',
      'meta[name="dc.publisher"]',
      'meta[name="DC.Publisher"]',
      'meta[property="og:site_name"]'
    ].map(selector => document.querySelector(selector)?.getAttribute('content') || '').find(Boolean) || '';
    return {
      doi,
      publisher,
      text: `${document.title || ''} ${publisher}`,
      urls: collectUrls(null, true)
    };
  }

  function referenceNodes() {
    const selector = window.MDPIFilterReferenceSelectors;
    if (typeof selector === 'string' && selector.trim()) {
      try {
        return Array.from(document.querySelectorAll(selector)).slice(0, MAX_ITEMS);
      } catch {
        // Fall through to generic bibliography selectors.
      }
    }
    return Array.from(document.querySelectorAll(
      'ol.references > li, ul.references > li, .reference-list li, #references li, [role="doc-bibliography"] li'
    )).slice(0, MAX_ITEMS);
  }

  function activeSearchConfig() {
    try {
      return window.MDPIFilterDomainUtils?.getActiveSearchConfig?.(
        window.location.hostname,
        window.location.pathname,
        window.MDPIFilterDomains
      ) || null;
    } catch {
      return null;
    }
  }

  function searchNodes(config) {
    if (!config) return [];
    try {
      return Array.from(document.querySelectorAll(config.itemSelector || config.container || '')).slice(0, MAX_ITEMS);
    } catch {
      return [];
    }
  }

  function recordId(element, kind, index) {
    const existing = element?.dataset?.notandiaRefId || element?.dataset?.mdpiFilterRefId || element?.id || element?.getAttribute?.('data-bib-id');
    const normalized = String(existing || '').trim();
    const generated = `${kind === 'reference' ? 'notandia-ref' : 'notandia-result'}-${index + 1}`;
    const id = SAFE_ID.test(normalized) ? normalized : generated;
    element?.setAttribute?.('data-notandia-ref-id', id);
    if (kind === 'reference') element?.setAttribute?.('data-mdpi-filter-ref-id', id);
    return id;
  }

  function itemNumber(element, index) {
    const candidate = String(element?.getAttribute?.('data-counter') || '').replace(/\D+/g, '');
    const number = Number(candidate);
    return Number.isFinite(number) && number > 0 ? number : index + 1;
  }

  function clearLegacyStyles(element) {
    if (!element) return;
    const legacyClasses = [
      'mdpi-highlighted-reference', 'mdpi-potential-reference', 'mdpi-hidden-reference',
      'mdpi-highlighted-google', 'mdpi-potential-google', 'mdpi-search-result-highlight',
      'mdpi-search-result-hidden', 'mdpi-highlighted-similar-article'
    ];
    const legacyStyled = legacyClasses.some(className => element.classList?.contains(className)) ||
      element.hasAttribute?.('data-mdpi-filter-cited-by-styled') || element.hasAttribute?.('data-mdpi-filter-mode');
    if (!legacyStyled) return;
    element.classList?.remove(...legacyClasses);
    for (const property of ['border', 'border-left', 'padding', 'padding-left', 'background-color', 'display', 'outline', 'opacity', 'filter']) {
      element.style?.removeProperty(property);
    }
  }

  function restoreElement(element) {
    if (!element?.hasAttribute?.('data-notandia-publisher-styled')) return;
    const originalStyle = element.getAttribute('data-notandia-original-style');
    if (originalStyle) element.setAttribute('style', originalStyle);
    else element.removeAttribute('style');
    element.removeAttribute('data-notandia-original-style');
    element.removeAttribute('data-notandia-publisher-styled');
    element.classList.remove('notandia-publisher-highlight', 'notandia-publisher-dim', 'notandia-publisher-hidden');
    element.querySelector(':scope > .notandia-publisher-chips')?.remove();
  }

  function resetStyledElements() {
    document.querySelectorAll('[data-notandia-publisher-styled]').forEach(restoreElement);
  }

  function rgba(hex, alpha) {
    const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '48627A';
    const number = Number.parseInt(value, 16);
    return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
  }

  function addChips(target, matches) {
    const visible = matches.filter(match => match.action !== 'none');
    if (!visible.length || !target?.appendChild) return;
    const container = document.createElement('span');
    container.className = 'notandia-publisher-chips';
    container.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:5px 0;font:600 10px/1.2 system-ui,sans-serif;';
    for (const match of visible) {
      const chip = document.createElement('span');
      chip.textContent = `${match.name}${match.confidence === 'potential' ? ' · potential' : ''}`;
      chip.title = `Personal publisher watchlist · ${match.reasons.join(', ')}`;
      chip.style.cssText = `display:inline-block;padding:2px 6px;border:1px solid ${match.color};border-radius:999px;color:${match.color};background:${rgba(match.color, 0.08)};`;
      container.appendChild(chip);
    }
    target.appendChild(container);
  }

  function styleElement(element, matches, config = null) {
    if (!element || !matches.length) return;
    const target = config?.highlightTargetSelector ? (element.querySelector(config.highlightTargetSelector) || element) : element;
    clearLegacyStyles(element);
    if (target !== element) clearLegacyStyles(target);
    restoreElement(target);
    target.setAttribute('data-notandia-original-style', target.getAttribute('style') || '');
    target.setAttribute('data-notandia-publisher-styled', 'true');
    const presentation = api.resolvePresentation(matches);
    addChips(target, matches);

    if (presentation.action === 'hide') {
      target.classList.add('notandia-publisher-hidden');
      target.style.setProperty('display', 'none', 'important');
    } else if (presentation.action === 'dim') {
      target.classList.add('notandia-publisher-dim');
      target.style.setProperty('opacity', '0.46', 'important');
      target.style.setProperty('filter', 'grayscale(0.25)', 'important');
    } else if (presentation.action === 'highlight') {
      target.classList.add('notandia-publisher-highlight');
      target.style.setProperty('border-left', `4px solid ${presentation.color}`, 'important');
      target.style.setProperty('padding-left', '7px', 'important');
      target.style.setProperty('background-color', rgba(presentation.color, 0.08), 'important');
    }
  }

  function recordForElement(element, kind, index, config = null) {
    const evidence = {
      doi: extractDoi(element),
      publisher: '',
      text: String(element?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
      urls: collectUrls(element)
    };
    const matches = api.matchProfiles(settings, evidence);
    if (!matches.length) return null;
    styleElement(element, matches, config);
    return {
      id: recordId(element, kind, index),
      kind,
      number: kind === 'reference' ? itemNumber(element, index) : index + 1,
      doi: evidence.doi,
      text: evidence.text,
      matches
    };
  }

  function scan() {
    suppressMutations = true;
    resetStyledElements();
    const articleEvidence = currentArticleEvidence();
    const articleMatches = api.matchProfiles(settings, articleEvidence);
    const currentArticle = articleMatches.length ? {
      id: 'current-article',
      kind: 'current-article',
      number: null,
      doi: articleEvidence.doi,
      text: document.title || 'Current article',
      matches: articleMatches
    } : null;

    const references = [];
    const seen = new Set();
    for (const [index, element] of referenceNodes().entries()) {
      const record = recordForElement(element, 'reference', index);
      if (!record) continue;
      const key = record.doi || record.id;
      if (seen.has(key)) continue;
      seen.add(key);
      references.push(record);
    }

    const config = activeSearchConfig();
    const searchResults = [];
    for (const [index, element] of searchNodes(config).entries()) {
      const record = recordForElement(element, 'search-result', index, config);
      if (record) searchResults.push(record);
    }

    const report = { currentArticle, references, searchResults };
    const nextFingerprint = JSON.stringify([
      settings,
      currentArticle?.matches?.map(match => match.profileId),
      references.map(record => [record.id, record.doi, record.matches.map(match => `${match.profileId}:${match.action}`)]),
      searchResults.map(record => [record.id, record.doi, record.matches.map(match => `${match.profileId}:${match.action}`)])
    ]);
    if (nextFingerprint === fingerprint) {
      setTimeout(() => { suppressMutations = false; }, 0);
      return;
    }
    fingerprint = nextFingerprint;
    chrome.runtime.sendMessage({ type: 'publisherContextUpdate', report }, () => void chrome.runtime.lastError);
    setTimeout(() => { suppressMutations = false; }, 0);
  }

  function schedule(delay = 250) {
    clearTimeout(timer);
    timer = setTimeout(scan, delay);
  }

  function loadSettings() {
    chrome.storage.sync.get(null, storage => {
      if (chrome.runtime.lastError) return;
      settings = api.migratePublisherSettings(storage || {});
      if (!storage.publisherProfiles || storage.publisherProfiles.schemaVersion !== api.SCHEMA_VERSION || storage.mode !== 'none') {
        chrome.storage.sync.set({ publisherProfiles: settings, publisherProfilesEnabled: true, mode: 'none' });
      }
      fingerprint = '';
      schedule(0);
    });
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'forcePublisherRescan') {
      fingerprint = '';
      loadSettings();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.publisherProfiles || changes.mode)) loadSettings();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadSettings, { once: true });
  else loadSettings();

  const observer = new MutationObserver(() => { if (!suppressMutations) schedule(700); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => schedule(0), 2200);
})();
