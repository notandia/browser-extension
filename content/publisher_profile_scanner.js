'use strict';

;(function initializePublisherProfileScanner() {
  if (window.notandiaPublisherScannerInjected) return;
  window.notandiaPublisherScannerInjected = true;

  const api = window.NotandiaPublisherProfiles;
  const workIds = window.NotandiaWorkIdentifiers;
  if (!api || !workIds) return;

  const DOI_PATTERN = /\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi;
  const MAX_REFERENCES = 300;
  const MAX_SEARCH_RESULTS = 150;
  const MAX_TEXT = 500;
  const STYLE_ATTRIBUTE = 'data-notandia-profile-style';
  const SIGNATURE_ATTRIBUTE = 'data-notandia-profile-signature';
  const INLINE_ACTION_ATTRIBUTE = 'data-notandia-publisher-action';
  const INLINE_PROFILE_ATTRIBUTE = 'data-notandia-publisher-profile';
  const STYLE_PROPERTIES = Object.freeze(['display', 'opacity', 'border-left', 'padding-left', 'background-color']);
  const OWN_NODE_SELECTOR = '.notandia-publisher-badges,.notandia-publisher-badge,.notandia-integrity-chip';
  const originalStyles = new WeakMap();
  const managedElements = new Set();
  const managedInlineAnchors = new Set();
  let settings = api.defaultSettings();
  let ncbiEnabled = false;
  let scanTimer = null;
  let scanGeneration = 0;
  let lastFingerprint = '';

  function normalizeDoi(value) {
    return workIds.normalizeDOI(value) || null;
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

  function addEuropePmcIdentifiers(identity, value) {
    try {
      const url = new URL(String(value || ''), document.baseURI);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'europepmc.org' && !host.endsWith('.europepmc.org')) return;
      const match = url.pathname.match(/^\/article\/(med|pmc)\/([^/?#]+)/i);
      if (!match) return;
      if (match[1].toLowerCase() === 'med') {
        const pmid = /^\d{1,12}$/.test(match[2]) ? match[2] : null;
        if (pmid) identity.identifiers.pmid.push(pmid);
      } else {
        const pmcid = /^PMC\d{1,12}$/i.test(match[2]) ? match[2].toUpperCase() : null;
        if (pmcid) identity.identifiers.pmcid.push(pmcid);
      }
    } catch {}
  }

  function finalizeIdentifierList(values) {
    return Array.from(new Set((values || []).filter(Boolean))).sort();
  }

  function cleanElementText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.notandia-publisher-badges,.notandia-mdpi-profile-badge,.notandia-integrity-chip').forEach(node => node.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  }

  function evidenceFromElement(element, cleanText) {
    const hostnames = new Set();
    const values = [cleanText];
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi']) {
      const value = element.getAttribute?.(attribute);
      if (value) values.push(value);
    }
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      const href = link.getAttribute('href') || '';
      values.push(href, link.getAttribute('data-doi') || '');
      addHostname(hostnames, href);
    }

    const identity = workIds.extract(values, {
      source: 'publisher-profile-scanner',
      method: 'page-evidence',
      confidence: 'exact'
    });
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      addEuropePmcIdentifiers(identity, link.getAttribute('href') || '');
    }

    return {
      dois: finalizeIdentifierList(identity.identifiers.doi),
      pmids: finalizeIdentifierList(identity.identifiers.pmid),
      pmcids: finalizeIdentifierList(identity.identifiers.pmcid),
      hostnames: Array.from(hostnames)
    };
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
    const id = /^[A-Za-z0-9_.:-]{1,256}$/.test(normalized) ? normalized : `notandia-${kind}-${index + 1}`;
    element.setAttribute('data-mdpi-filter-ref-id', id);
    return id;
  }

  function referenceNumber(element, index) {
    const counter = String(element.getAttribute?.('data-counter') || '').match(/\d+/)?.[0];
    const numericCounter = Number(counter);
    if (Number.isFinite(numericCounter) && numericCounter > 0) return numericCounter;

    const aria = String(element.getAttribute?.('aria-label') || '').match(/(?:reference|citation)\s*(\d+)/i)?.[1];
    const numericAria = Number(aria);
    if (Number.isFinite(numericAria) && numericAria > 0) return numericAria;

    const identifier = String(element.dataset?.mdpiFilterRefId || element.id || '');
    const knownPattern = identifier.match(/(?:^|[-_:])(?:ref(?:erence)?|cr|cit|bib|b|r)?[-_:]*0*(\d+)$/i)?.[1];
    const numericIdentifier = Number(knownPattern);
    return Number.isFinite(numericIdentifier) && numericIdentifier > 0 ? numericIdentifier : index + 1;
  }

  function configuredReferenceSelector() {
    const selector = window.MDPIFilterReferenceSelectors;
    return typeof selector === 'string' && selector.trim() ? selector : '';
  }

  function activeSearchConfig() {
    return window.MDPIFilterDomainUtils?.getActiveSearchConfig?.(
      location.hostname,
      location.pathname,
      window.MDPIFilterDomains
    ) || null;
  }

  function configuredSearchSelector() {
    const config = activeSearchConfig();
    const selector = config?.itemSelector || config?.container || '';
    return typeof selector === 'string' && selector.trim() ? selector : '';
  }

  function referenceNodes() {
    const selector = configuredReferenceSelector();
    if (!selector) return [];
    try {
      let nodes = Array.from(document.querySelectorAll(selector));
      nodes = nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
      const hasNatureMainBibliography = nodes.some(node => node.matches?.('li.c-article-references__item'));
      if (hasNatureMainBibliography) {
        nodes = nodes.filter(node => !node.closest?.('.c-reading-companion,.c-reading-companion__reference-item'));
      }
      return nodes.slice(0, MAX_REFERENCES);
    } catch {
      return [];
    }
  }

  function searchNodes() {
    const selector = configuredSearchSelector();
    if (!selector) return [];
    try {
      return Array.from(document.querySelectorAll(selector)).slice(0, MAX_SEARCH_RESULTS);
    } catch {
      return [];
    }
  }

  function rgba(hex, alpha) {
    const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(hex || '');
    if (!match) return `rgba(72,98,122,${alpha})`;
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})`;
  }

  function rememberOriginalStyles(element) {
    if (originalStyles.has(element)) return;
    const snapshot = {};
    for (const property of STYLE_PROPERTIES) {
      snapshot[property] = {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      };
    }
    originalStyles.set(element, snapshot);
  }

  function restoreOriginalStyles(element) {
    const snapshot = originalStyles.get(element);
    if (!snapshot) return;
    for (const [property, state] of Object.entries(snapshot)) {
      if (state.value) element.style.setProperty(property, state.value, state.priority);
      else element.style.removeProperty(property);
    }
    originalStyles.delete(element);
  }

  function clearProfileStyle(element) {
    if (!element) return;
    const hasManagedState = managedElements.has(element) ||
      element.hasAttribute?.(STYLE_ATTRIBUTE) ||
      element.hasAttribute?.(SIGNATURE_ATTRIBUTE) ||
      Boolean(element.querySelector?.(':scope > .notandia-publisher-badges'));
    if (!hasManagedState) return;
    restoreOriginalStyles(element);
    element.querySelectorAll?.(':scope > .notandia-publisher-badges').forEach(node => node.remove());
    element.removeAttribute(STYLE_ATTRIBUTE);
    element.removeAttribute(SIGNATURE_ATTRIBUTE);
    managedElements.delete(element);
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

  function styleSignature(matches) {
    return matches
      .map(match => [match.profileId, match.confidence, match.action, match.color, ...(match.reasons || [])].join(':'))
      .sort()
      .join('|');
  }

  function applyVisualProperties(element, visual) {
    for (const property of STYLE_PROPERTIES) element.style.removeProperty(property);
    const snapshot = originalStyles.get(element);
    if (snapshot) {
      for (const [property, state] of Object.entries(snapshot)) {
        if (state.value) element.style.setProperty(property, state.value, state.priority);
      }
    }
    if (visual.action === 'hide') element.style.setProperty('display', 'none', 'important');
    else if (visual.action === 'dim') element.style.setProperty('opacity', '0.45', 'important');
    else if (visual.action === 'highlight') {
      element.style.setProperty('border-left', `4px solid ${visual.color}`, 'important');
      element.style.setProperty('padding-left', '8px', 'important');
      element.style.setProperty('background-color', rgba(visual.color, 0.08), 'important');
    }
  }

  function applyStyle(element, matches) {
    const signature = styleSignature(matches);
    const currentSignature = element.getAttribute(SIGNATURE_ATTRIBUTE) || '';
    const visual = api.resolveVisualMatch(matches);
    const badges = element.querySelectorAll?.(':scope > .notandia-publisher-badges') || [];
    const expectedBadges = matches.some(match => match.action !== 'none');
    if (currentSignature === signature && Boolean(badges.length) === expectedBadges) return;

    clearProfileStyle(element);
    if (!matches.length || !visual) return;
    rememberOriginalStyles(element);
    element.setAttribute(STYLE_ATTRIBUTE, visual.profileId);
    element.setAttribute(SIGNATURE_ATTRIBUTE, signature);
    addBadges(element, matches);
    applyVisualProperties(element, visual);
    managedElements.add(element);
  }

  function clearInlineAnchor(anchor) {
    anchor.classList.remove('notandia-publisher-citation');
    anchor.removeAttribute(INLINE_ACTION_ATTRIBUTE);
    anchor.removeAttribute(INLINE_PROFILE_ATTRIBUTE);
    anchor.style.removeProperty('--notandia-profile-color');
    managedInlineAnchors.delete(anchor);
  }

  function styleInlineCitations(record) {
    const visual = api.resolveVisualMatch(record.matches || []);
    if (!visual || !['highlight', 'dim', 'hide'].includes(visual.action)) return [];
    const generator = window.MDPIFilterUtils?.generateInlineFootnoteSelectors;
    if (typeof generator !== 'function') return [];
    const selectors = generator(record.id);
    if (!selectors) return [];
    const styled = [];
    try {
      for (const matched of document.querySelectorAll(selectors)) {
        const anchor = matched.tagName?.toLowerCase() === 'a' ? matched : matched.querySelector?.('a');
        if (!(anchor instanceof HTMLAnchorElement)) continue;
        anchor.classList.add('notandia-publisher-citation');
        anchor.setAttribute(INLINE_ACTION_ATTRIBUTE, visual.action);
        anchor.setAttribute(INLINE_PROFILE_ATTRIBUTE, visual.profileId);
        anchor.style.setProperty('--notandia-profile-color', visual.color);
        managedInlineAnchors.add(anchor);
        styled.push(anchor);
      }
    } catch {
      return [];
    }
    return styled;
  }

  function buildRecord(element, index, kind) {
    const text = cleanElementText(element);
    const evidence = evidenceFromElement(element, text);
    return {
      element,
      evidence,
      id: safeRecordId(element, index, kind),
      kind,
      number: kind === 'reference' ? referenceNumber(element, index) : index + 1,
      doi: evidence.dois[0] || null,
      text,
      matches: api.matchProfiles(settings, evidence)
    };
  }

  async function enrichRecordsWithNcbi(records) {
    if (!ncbiEnabled || !records.length) return;
    const resolver = window.MDPIFilterNcbiApiHandler?.resolveNcbiIdsToDois;
    if (typeof resolver !== 'function') return;

    const pmids = new Set();
    const pmcids = new Set();
    for (const record of records) {
      if (record.evidence.dois.length) continue;
      for (const pmid of record.evidence.pmids || []) pmids.add(pmid);
      for (const pmcid of record.evidence.pmcids || []) pmcids.add(pmcid);
    }

    const pmidResolution = pmids.size
      ? await resolver(Array.from(pmids), 'pmid')
      : { doiById: new Map() };
    const pmcidResolution = pmcids.size
      ? await resolver(Array.from(pmcids), 'pmcid')
      : { doiById: new Map() };

    for (const record of records) {
      if (record.evidence.dois.length) continue;
      let resolved = null;
      for (const pmid of record.evidence.pmids || []) {
        resolved = pmidResolution.doiById?.get(pmid) || null;
        if (resolved) break;
      }
      if (!resolved) {
        for (const pmcid of record.evidence.pmcids || []) {
          resolved = pmcidResolution.doiById?.get(pmcid) || null;
          if (resolved) break;
        }
      }
      if (!resolved) continue;
      record.evidence.dois = [resolved];
      record.doi = resolved;
      record.matches = api.matchProfiles(settings, record.evidence);
    }
  }

  function ensureStyleSheet() {
    if (document.getElementById('notandia-publisher-profile-styles')) return;
    const style = document.createElement('style');
    style.id = 'notandia-publisher-profile-styles';
    style.textContent = `
      .notandia-publisher-badges{display:flex!important;flex-wrap:wrap!important;gap:4px!important;margin:3px 0 5px!important;font:600 11px/1.2 system-ui,-apple-system,sans-serif!important}
      .notandia-publisher-badge{display:inline-flex!important;align-items:center!important;border:1px solid var(--notandia-profile-color)!important;border-radius:999px!important;padding:2px 6px!important;color:var(--notandia-profile-color)!important;background:#fff!important;letter-spacing:.01em!important}
      .notandia-publisher-citation[data-notandia-publisher-action="highlight"]:not(.notandia-integrity-citation),
      .notandia-publisher-citation[data-notandia-publisher-action="highlight"]:not(.notandia-integrity-citation) *{color:var(--notandia-profile-color)!important;font-weight:800!important;text-decoration-line:underline!important;text-decoration-style:dotted!important;text-decoration-color:var(--notandia-profile-color)!important;text-decoration-thickness:2px!important;text-underline-offset:2px!important}
      .notandia-publisher-citation[data-notandia-publisher-action="dim"]:not(.notandia-integrity-citation){opacity:.45!important}
      .notandia-publisher-citation[data-notandia-publisher-action="hide"]:not(.notandia-integrity-citation){display:none!important}
    `;
    document.documentElement.appendChild(style);
  }

  async function scan(generation) {
    ensureStyleSheet();
    const referenceRecords = referenceNodes().map((element, index) => buildRecord(element, index, 'reference'));
    const searchRecords = searchNodes().map((element, index) => buildRecord(element, index, 'search-result'));
    await enrichRecordsWithNcbi([...referenceRecords, ...searchRecords]);
    if (generation !== scanGeneration) return;

    const allElements = new Set([...referenceRecords, ...searchRecords].map(record => record.element));
    for (const element of Array.from(managedElements)) {
      if (!allElements.has(element)) clearProfileStyle(element);
    }

    const currentInline = new Set();
    for (const record of [...referenceRecords, ...searchRecords]) {
      applyStyle(record.element, record.matches);
      if (record.kind === 'reference' && record.matches.length) {
        for (const anchor of styleInlineCitations(record)) currentInline.add(anchor);
      }
    }
    for (const anchor of Array.from(managedInlineAnchors)) {
      if (!currentInline.has(anchor)) clearInlineAnchor(anchor);
    }

    const currentEvidence = currentArticleEvidence();
    const currentArticle = { doi: currentEvidence.dois[0] || null, matches: api.matchProfiles(settings, currentEvidence) };
    const references = referenceRecords
      .filter(record => record.matches.length)
      .map(({ element, evidence, ...record }) => record);
    const searchResults = searchRecords
      .filter(record => record.matches.length)
      .map(({ element, evidence, ...record }) => record);
    const fingerprint = JSON.stringify([
      settings,
      ncbiEnabled,
      currentArticle,
      references.map(record => [record.id, record.number, record.doi, record.matches.map(match => [match.profileId, match.action, match.confidence])]),
      searchResults.map(record => [record.id, record.number, record.doi, record.matches.map(match => [match.profileId, match.action, match.confidence])])
    ]);
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    chrome.runtime.sendMessage(
      { type: 'publisherContextUpdate', data: { currentArticle, references, searchResults } },
      () => void chrome.runtime.lastError
    );
  }

  function scheduleScan(delay = 250) {
    clearTimeout(scanTimer);
    const generation = ++scanGeneration;
    scanTimer = setTimeout(() => void scan(generation), delay);
  }

  function loadSettings() {
    chrome.storage.sync.get({
      publisherWatchlist: null,
      mode: 'highlight',
      highlightPotentialMdpiSites: true,
      potentialMdpiHighlightColor: '#E2211C',
      ncbiApiEnabled: false
    }, stored => {
      if (chrome.runtime.lastError) return;
      settings = api.migrateLegacySettings(stored);
      ncbiEnabled = stored.ncbiApiEnabled === true;
      if (!window.MDPIFilterSettings) window.MDPIFilterSettings = {};
      window.MDPIFilterSettings.ncbiApiEnabled = ncbiEnabled;
      if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== api.SCHEMA_VERSION) {
        chrome.storage.sync.set({ publisherWatchlist: settings });
      }
      lastFingerprint = '';
      scheduleScan(0);
    });
  }

  function nodeTouchesRelevantContent(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches(OWN_NODE_SELECTOR) || node.closest(OWN_NODE_SELECTOR)) return false;

    const selectors = [configuredReferenceSelector(), configuredSearchSelector()].filter(Boolean);
    try {
      for (const selector of selectors) {
        if (node.matches(selector) || node.querySelector(selector)) return true;
      }
      if (node.matches('a[href*="#"],a[href*="doi.org"],a[href*="10."],a[href*="pubmed.ncbi.nlm.nih.gov"],a[href*="pmc.ncbi.nlm.nih.gov"],a[href*="europepmc.org/article/"]')) return true;
      return Boolean(node.querySelector('a[href*="#"],a[href*="doi.org"],a[href*="10."],a[href*="pubmed.ncbi.nlm.nih.gov"],a[href*="pmc.ncbi.nlm.nih.gov"],a[href*="europepmc.org/article/"]'));
    } catch {
      return false;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (
      changes.publisherWatchlist ||
      changes.mode ||
      changes.highlightPotentialMdpiSites ||
      changes.potentialMdpiHighlightColor ||
      changes.ncbiApiEnabled
    )) loadSettings();
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'forcePublisherRescan') return false;
    lastFingerprint = '';
    scheduleScan(0);
    sendResponse?.({ scheduled: true });
    return false;
  });

  loadSettings();
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation =>
      Array.from(mutation.addedNodes).some(nodeTouchesRelevantContent) ||
      Array.from(mutation.removedNodes).some(nodeTouchesRelevantContent)
    )) scheduleScan(500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => scheduleScan(0), 1800);
})();
