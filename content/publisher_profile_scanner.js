'use strict';

;(function initializePublisherProfileScanner() {
  if (window.notandiaPublisherScannerInjected) return;
  window.notandiaPublisherScannerInjected = true;

  const api = window.NotandiaPublisherProfiles;
  if (!api) return;

  const DOI_PATTERN = /\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi;
  const MAX_REFERENCES = 300;
  const MAX_SEARCH_RESULTS = 150;
  const MAX_TEXT = 500;
  const STYLE_ATTRIBUTE = 'data-notandia-profile-style';
  const LEGACY_MDPI_SELECTOR = '.mdpi-highlighted-reference,.mdpi-potential-reference,.mdpi-hidden-reference,.mdpi-highlighted-google,.mdpi-potential-google,.mdpi-search-result-highlight,.mdpi-search-result-hidden';
  let settings = api.defaultSettings();
  let scanTimer = null;
  let lastFingerprint = '';

  function normalizeDoi(value) {
    let normalized = String(value || '').trim();
    try { normalized = decodeURIComponent(normalized); } catch {}
    normalized = normalized
      .replace(/^doi\s*:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
    return /^10\.\d{4,9}\/[\w.()/:;+-]+$/i.test(normalized) ? normalized : null;
  }

  function addDoi(set, value) {
    const direct = normalizeDoi(value);
    if (direct) set.add(direct);
    for (const match of String(value || '').matchAll(DOI_PATTERN)) {
      const doi = normalizeDoi(match[0]);
      if (doi) set.add(doi);
    }
  }

  function addHostname(set, value) {
    try {
      const url = new URL(String(value || ''), document.baseURI);
      if (/^https?:$/.test(url.protocol)) set.add(url.hostname.toLowerCase().replace(/^www\./, ''));
    } catch {}
  }

  function evidenceFromElement(element) {
    const dois = new Set();
    const hostnames = new Set();
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi']) {
      const value = element.getAttribute?.(attribute);
      if (value) addDoi(dois, value);
    }
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      const href = link.getAttribute('href') || '';
      addHostname(hostnames, href);
      addDoi(dois, href);
      addDoi(dois, link.getAttribute('data-doi') || '');
    }
    addDoi(dois, element.textContent || '');
    return { dois: Array.from(dois), hostnames: Array.from(hostnames) };
  }

  function currentArticleEvidence() {
    const dois = new Set();
    const hostnames = new Set([location.hostname.toLowerCase().replace(/^www\./, '')]);
    for (const selector of [
      'meta[name="citation_doi"]', 'meta[name="dc.identifier"]', 'meta[name="DC.Identifier"]',
      'meta[name="doi"]', 'meta[property="citation_doi"]'
    ]) addDoi(dois, document.querySelector(selector)?.getAttribute('content') || '');
    addDoi(dois, document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '');
    addDoi(dois, location.href);
    return { dois: Array.from(dois), hostnames: Array.from(hostnames) };
  }

  function safeRecordId(element, index, kind) {
    const existing = element.dataset?.mdpiFilterRefId || element.id || element.getAttribute?.('data-bib-id') || element.getAttribute?.('data-reference-id');
    const normalized = String(existing || '').trim();
    if (/^[A-Za-z0-9_.:-]{1,256}$/.test(normalized)) return normalized;
    const generated = `notandia-${kind}-${index + 1}`;
    element.setAttribute('data-mdpi-filter-ref-id', generated);
    return generated;
  }

  function referenceNodes() {
    const selector = window.MDPIFilterReferenceSelectors;
    if (typeof selector !== 'string' || !selector.trim()) return [];
    try {
      const nodes = Array.from(document.querySelectorAll(selector));
      return nodes.filter(node => !nodes.some(other => other !== node && other.contains(node))).slice(0, MAX_REFERENCES);
    } catch {
      return [];
    }
  }

  function searchNodes() {
    const config = window.MDPIFilterDomainUtils?.getActiveSearchConfig?.(location.hostname, location.pathname, window.MDPIFilterDomains);
    if (!config) return [];
    try {
      return Array.from(document.querySelectorAll(config.itemSelector || config.container || '')).slice(0, MAX_SEARCH_RESULTS);
    } catch {
      return [];
    }
  }

  function rgba(hex, alpha) {
    const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(hex || '');
    if (!match) return `rgba(72,98,122,${alpha})`;
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})`;
  }

  function legacyMdpiSignal(element) {
    const target = element.matches?.(LEGACY_MDPI_SELECTOR) ? element : element.querySelector?.(LEGACY_MDPI_SELECTOR);
    if (!target) return null;
    const potential = target.classList.contains('mdpi-potential-reference') || target.classList.contains('mdpi-potential-google');
    return potential ? 'potential' : 'confirmed';
  }

  function clearLegacyMdpiPresentation(element) {
    const targets = [element, ...(element.querySelectorAll?.(LEGACY_MDPI_SELECTOR) || [])];
    for (const target of targets) {
      target.classList?.remove(
        'mdpi-highlighted-reference', 'mdpi-potential-reference', 'mdpi-hidden-reference',
        'mdpi-highlighted-google', 'mdpi-potential-google', 'mdpi-search-result-highlight', 'mdpi-search-result-hidden'
      );
      for (const property of ['display', 'opacity', 'border', 'border-left', 'padding', 'padding-left', 'background-color', 'outline', 'box-shadow']) {
        target.style?.removeProperty(property);
      }
    }
    element.querySelectorAll?.(':scope > .notandia-mdpi-profile-badge').forEach(node => node.remove());
  }

  function clearProfileStyle(element) {
    if (!element?.hasAttribute?.(STYLE_ATTRIBUTE)) return;
    for (const property of ['display', 'opacity', 'border', 'border-left', 'padding-left', 'background-color']) element.style.removeProperty(property);
    element.querySelectorAll?.(':scope > .notandia-publisher-badges').forEach(node => node.remove());
    element.removeAttribute(STYLE_ATTRIBUTE);
  }

  function addBadges(element, matches) {
    const visible = matches.filter(match => match.action !== 'none');
    if (!visible.length) return;
    const container = document.createElement('span');
    container.className = 'notandia-publisher-badges';
    container.setAttribute('aria-label', 'Notandia publisher watchlist matches');
    for (const match of visible) {
      const badge = document.createElement('span');
      badge.className = 'notandia-publisher-badge';
      badge.textContent = match.profileName;
      badge.style.setProperty('--notandia-profile-color', match.color);
      badge.title = `${match.profileName}: ${match.confidence} match (${match.reasons.join(', ')})`;
      container.appendChild(badge);
    }
    element.prepend(container);
  }

  function applyStyle(element, matches) {
    clearProfileStyle(element);
    clearLegacyMdpiPresentation(element);
    if (!matches.length) return;
    const visual = api.resolveVisualMatch(matches);
    if (!visual) return;
    element.setAttribute(STYLE_ATTRIBUTE, visual.profileId);
    addBadges(element, matches);
    if (visual.action === 'hide') element.style.setProperty('display', 'none', 'important');
    else if (visual.action === 'dim') element.style.setProperty('opacity', '0.45', 'important');
    else if (visual.action === 'highlight') {
      element.style.setProperty('border-left', `4px solid ${visual.color}`, 'important');
      element.style.setProperty('padding-left', '8px', 'important');
      element.style.setProperty('background-color', rgba(visual.color, 0.08), 'important');
    }
  }

  function ensureStyleSheet() {
    if (document.getElementById('notandia-publisher-profile-styles')) return;
    const style = document.createElement('style');
    style.id = 'notandia-publisher-profile-styles';
    style.textContent = `
      .notandia-publisher-badges{display:flex!important;flex-wrap:wrap!important;gap:4px!important;margin:3px 0 5px!important;font:600 11px/1.2 system-ui,-apple-system,sans-serif!important}
      .notandia-publisher-badge{display:inline-flex!important;align-items:center!important;border:1px solid var(--notandia-profile-color)!important;border-radius:999px!important;padding:2px 6px!important;color:var(--notandia-profile-color)!important;background:#fff!important;letter-spacing:.01em!important}
    `;
    document.documentElement.appendChild(style);
  }

  function matchesForElement(element, evidence, legacySignal) {
    const matches = api.matchProfiles(settings, evidence);
    const mdpi = api.profileMap(settings).get('mdpi');
    if (legacySignal && mdpi?.enabled && !matches.some(match => match.profileId === 'mdpi')) {
      if (legacySignal === 'confirmed' || mdpi.confidencePolicy === 'confirmed-and-potential') {
        matches.push({
          profileId: 'mdpi', profileName: mdpi.name, confidence: legacySignal,
          reasons: ['legacy-mdpi-detector'], action: mdpi.action, color: mdpi.color
        });
      }
    }
    return matches;
  }

  function buildRecord(element, index, kind) {
    const legacySignal = legacyMdpiSignal(element);
    const evidence = evidenceFromElement(element);
    const matches = matchesForElement(element, evidence, legacySignal);
    applyStyle(element, matches);
    return {
      id: safeRecordId(element, index, kind),
      kind,
      number: index + 1,
      doi: evidence.dois[0] || null,
      text: String(element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
      matches
    };
  }

  function clearUnmanagedLegacyStyles(managed) {
    for (const element of document.querySelectorAll(LEGACY_MDPI_SELECTOR)) {
      const owner = managed.find(candidate => candidate === element || candidate.contains(element));
      if (!owner) clearLegacyMdpiPresentation(element);
    }
  }

  function scan() {
    ensureStyleSheet();
    const referenceElements = referenceNodes();
    const searchElements = searchNodes();
    const managed = Array.from(new Set([...referenceElements, ...searchElements]));
    const currentEvidence = currentArticleEvidence();
    const currentArticle = { doi: currentEvidence.dois[0] || null, matches: api.matchProfiles(settings, currentEvidence) };
    const references = referenceElements.map((element, index) => buildRecord(element, index, 'reference')).filter(record => record.matches.length);
    const searchResults = searchElements.map((element, index) => buildRecord(element, index, 'search-result')).filter(record => record.matches.length);
    clearUnmanagedLegacyStyles(managed);
    const fingerprint = JSON.stringify([
      settings,
      currentArticle,
      references.map(record => [record.id, record.matches.map(match => [match.profileId, match.action, match.confidence])]),
      searchResults.map(record => [record.id, record.matches.map(match => [match.profileId, match.action, match.confidence])])
    ]);
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    chrome.runtime.sendMessage({ type: 'publisherContextUpdate', data: { currentArticle, references, searchResults } }, () => void chrome.runtime.lastError);
  }

  function scheduleScan(delay = 250) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  function loadSettings() {
    chrome.storage.sync.get({
      publisherWatchlist: null,
      mode: 'highlight',
      highlightPotentialMdpiSites: true,
      potentialMdpiHighlightColor: '#E2211C'
    }, stored => {
      if (chrome.runtime.lastError) return;
      settings = api.migrateLegacySettings(stored);
      if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== api.SCHEMA_VERSION) {
        chrome.storage.sync.set({ publisherWatchlist: settings });
      }
      lastFingerprint = '';
      scheduleScan(0);
    });
  }

  chrome.storage.onChanged.addListener(changes => {
    if (changes.publisherWatchlist || changes.mode || changes.highlightPotentialMdpiSites || changes.potentialMdpiHighlightColor) loadSettings();
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'forcePublisherRescan') {
      lastFingerprint = '';
      scheduleScan(0);
    }
  });

  loadSettings();
  const observer = new MutationObserver(() => scheduleScan(700));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => scheduleScan(0), 1800);
})();
