'use strict';

;(function initializeIntegrityScanner() {
  if (window.notandiaIntegrityScannerInjected) return;
  window.notandiaIntegrityScannerInjected = true;

  const runtime = window.NotandiaRuntime;
  const workIds = window.NotandiaWorkIdentifiers;
  if (!runtime?.isAvailable() || !workIds) return;

  const MAX_REFERENCES = 250;
  const MAX_SEARCH_RESULTS = 150;
  const MAX_TEXT_LENGTH = 500;
  const OWN_NODE_SELECTOR = '.notandia-publisher-badges,.notandia-integrity-chip,#notandia-publisher-profile-styles';
  const REFERENCE_ID_ATTRIBUTE = 'data-notandia-ref-id';
  const LEGACY_REFERENCE_ID_ATTRIBUTE = 'data-mdpi-filter-ref-id';
  const DOI_ATTRIBUTE = 'data-notandia-doi';
  let scanTimer = null;
  let observer = null;
  let scanGeneration = 0;
  let lastFingerprint = '';

  function stop() {
    clearTimeout(scanTimer);
    scanTimer = null;
    observer?.disconnect();
    observer = null;
  }

  function configuredReferenceSelector() {
    const configured = window.NotandiaReferenceSelectors || window.MDPIFilterReferenceSelectors;
    return typeof configured === 'string' && configured.trim() ? configured : '';
  }

  function activeSearchConfig() {
    const domainUtils = window.NotandiaDomainUtils || window.MDPIFilterDomainUtils;
    const domains = window.NotandiaDomains || window.MDPIFilterDomains;
    return domainUtils?.getActiveSearchConfig?.(location.hostname, location.pathname, domains) || null;
  }

  function configuredSearchSelector() {
    const config = activeSearchConfig();
    const selector = config?.itemSelector || config?.container || '';
    return typeof selector === 'string' && selector.trim() ? selector : '';
  }

  function referenceNodes() {
    const configured = configuredReferenceSelector();
    let nodes = [];
    if (configured) {
      try {
        nodes = Array.from(document.querySelectorAll(configured));
      } catch {
        nodes = [];
      }
    }
    if (!nodes.length) {
      nodes = Array.from(document.querySelectorAll(
        'ol.references > li, ul.references > li, .reference-list li, #references li, [role="doc-bibliography"] li'
      ));
    }
    nodes = nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
    const hasNatureMainBibliography = nodes.some(node => node.matches?.('li.c-article-references__item'));
    if (hasNatureMainBibliography) {
      nodes = nodes.filter(node => !node.closest?.('.c-reading-companion,.c-reading-companion__reference-item'));
    }
    return nodes.slice(0, MAX_REFERENCES);
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

  function cleanText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.notandia-publisher-badges,.notandia-integrity-chip').forEach(node => node.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
  }

  function addEuropePmcIdentifiers(identity, value) {
    try {
      const url = new URL(String(value || ''), document.baseURI);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'europepmc.org' && !host.endsWith('.europepmc.org')) return;
      const match = url.pathname.match(/^\/article\/(med|pmc)\/([^/?#]+)/i);
      if (!match) return;
      if (match[1].toLowerCase() === 'med' && /^\d{1,12}$/.test(match[2])) {
        identity.identifiers.pmid.push(match[2]);
      } else if (/^PMC\d{1,12}$/i.test(match[2])) {
        identity.identifiers.pmcid.push(match[2].toUpperCase());
      }
    } catch {
      // Non-URL evidence is handled by the shared identifier mapper.
    }
  }

  function evidenceFromElement(element, text) {
    const values = [text];
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi', DOI_ATTRIBUTE]) {
      const value = element.getAttribute?.(attribute);
      if (value) values.push(value);
    }
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      values.push(link.getAttribute('href') || '', link.getAttribute('data-doi') || '');
    }

    const identity = workIds.extract(values, {
      source: 'notandia-context-scanner',
      method: 'page-evidence',
      confidence: 'exact'
    });
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      addEuropePmcIdentifiers(identity, link.getAttribute('href') || '');
    }
    identity.identifiers.pmid = Array.from(new Set(identity.identifiers.pmid || [])).sort();
    identity.identifiers.pmcid = Array.from(new Set(identity.identifiers.pmcid || [])).sort();
    return identity;
  }

  function safeRecordId(element, index, kind) {
    const existing = element.dataset?.notandiaRefId ||
      element.dataset?.mdpiFilterRefId ||
      element.id ||
      element.getAttribute?.('data-bib-id') ||
      element.getAttribute?.('data-reference-id');
    const normalized = String(existing || '').trim();
    const id = /^[A-Za-z0-9_.:-]{1,256}$/.test(normalized)
      ? normalized
      : `notandia-${kind}-${index + 1}`;
    element.setAttribute(REFERENCE_ID_ATTRIBUTE, id);
    // Compatibility with already-released navigation/presentation code.
    element.setAttribute(LEGACY_REFERENCE_ID_ATTRIBUTE, id);
    return id;
  }

  function positiveNumber(value) {
    const number = Number(String(value || '').match(/0*(\d{1,5})/)?.[1]);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function referenceNumber(element, index) {
    const counter = positiveNumber(element.getAttribute?.('data-counter'));
    if (counter) return counter;
    for (const attribute of ['data-content', 'data-number', 'data-reference-number']) {
      const number = positiveNumber(element.getAttribute?.(attribute));
      if (number) return number;
    }
    const aria = Number(String(element.getAttribute?.('aria-label') || '').match(/(?:reference|citation)\s*0*(\d+)/i)?.[1]);
    if (Number.isFinite(aria) && aria > 0) return aria;
    const identifier = String(element.dataset?.notandiaRefId || element.dataset?.mdpiFilterRefId || element.id || '');
    for (const pattern of [
      /^B0*(\d+)(?:[-_:]|$)/i,
      /^(?:ref-CR|ref|reference|bib|cit|r)[-_:]?0*(\d+)(?:[-_:]|$)/i,
      /(?:^|[-_:])(?:ref-CR|ref|reference|bib|cit|r)[-_:]?0*(\d+)(?:$|[-_:])/i
    ]) {
      const number = Number(identifier.match(pattern)?.[1]);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return index + 1;
  }

  function searchResultNumber(element, index) {
    const direct = positiveNumber(element.getAttribute?.('data-rpos'));
    if (direct) return direct;
    const zeroBased = Number(element.getAttribute?.('data-rp'));
    if (Number.isFinite(zeroBased) && zeroBased >= 0) return zeroBased + 1;
    return index + 1;
  }

  function titleFromElement(element, text) {
    const candidate = element.querySelector?.('h3, [role="heading"], [data-crb-snippet-text]')?.textContent || text;
    return String(candidate || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  function normalizedWorkTitle(value) {
    return String(value || '')
      .replace(/^\s*(?:retracted|withdrawn)\s*:\s*/i, '')
      .replace(/^\s*\[(?:retracted|withdrawn)\]\s*/i, '')
      .replace(/[\s\u00a0]+/g, ' ')
      .replace(/[.\s]+$/g, '')
      .trim()
      .toLocaleLowerCase('en-US');
  }

  function buildRecord(element, index, kind) {
    const text = cleanText(element);
    const identity = evidenceFromElement(element, text);
    return {
      element,
      identity,
      id: safeRecordId(element, index, kind),
      kind,
      number: kind === 'reference' ? referenceNumber(element, index) : searchResultNumber(element, index),
      title: titleFromElement(element, text),
      doi: identity.identifiers.doi?.[0] || null,
      text
    };
  }

  async function enrichRecordsWithNcbi(records, enabled) {
    if (!enabled || !records.length) return;
    const resolver = (window.NotandiaNcbiApiHandler || window.MDPIFilterNcbiApiHandler)?.resolveNcbiIdsToDois;
    if (typeof resolver !== 'function') return;

    const pmids = new Set();
    const pmcids = new Set();
    for (const record of records) {
      if (record.doi) continue;
      for (const pmid of record.identity.identifiers.pmid || []) pmids.add(pmid);
      for (const pmcid of record.identity.identifiers.pmcid || []) pmcids.add(pmcid);
    }

    const pmidResolution = pmids.size
      ? await resolver(Array.from(pmids), 'pmid')
      : { doiById: new Map() };
    const pmcidResolution = pmcids.size
      ? await resolver(Array.from(pmcids), 'pmcid')
      : { doiById: new Map() };

    for (const record of records) {
      if (record.doi) continue;
      for (const pmid of record.identity.identifiers.pmid || []) {
        record.doi = pmidResolution.doiById?.get(pmid) || null;
        if (record.doi) break;
      }
      if (!record.doi) {
        for (const pmcid of record.identity.identifiers.pmcid || []) {
          record.doi = pmcidResolution.doiById?.get(pmcid) || null;
          if (record.doi) break;
        }
      }
    }
  }

  function propagateExactTitleIdentities(records) {
    const resolvedByTitle = new Map();
    for (const record of records) {
      if (!record.doi) continue;
      const title = normalizedWorkTitle(record.title);
      if (title.length < 32) continue;
      if (!resolvedByTitle.has(title)) resolvedByTitle.set(title, new Set());
      resolvedByTitle.get(title).add(record.doi);
    }
    for (const record of records) {
      if (record.doi) continue;
      const title = normalizedWorkTitle(record.title);
      const candidates = resolvedByTitle.get(title);
      if (title.length < 32 || candidates?.size !== 1) continue;
      record.doi = Array.from(candidates)[0];
    }
  }

  function markResolvedIdentity(record) {
    if (record.doi) record.element.setAttribute(DOI_ATTRIBUTE, record.doi);
    else record.element.removeAttribute(DOI_ATTRIBUTE);
  }

  function extractCurrentArticleDoi() {
    const values = [];
    for (const selector of [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="DC.Identifier"]',
      'meta[name="doi"]',
      'meta[property="citation_doi"]'
    ]) {
      values.push(document.querySelector(selector)?.getAttribute('content') || '');
    }
    values.push(document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '', document.location.href);
    return workIds.extract(values, {
      source: 'notandia-context-scanner',
      method: 'current-article',
      confidence: 'exact'
    }).identifiers.doi?.[0] || null;
  }

  async function scanDocument(generation) {
    if (!runtime.isAvailable()) return stop();
    runtime.storageGet('sync', { integrityLookupsEnabled: false, ncbiApiEnabled: false }, async (settings, error) => {
      if (error || !runtime.isAvailable() || generation !== scanGeneration) return;
      if (settings.integrityLookupsEnabled !== true) {
        runtime.sendMessage({ type: 'integrityScanDisabled' });
        return;
      }

      const referenceRecords = referenceNodes().map((element, index) => buildRecord(element, index, 'reference'));
      const searchRecords = searchNodes().map((element, index) => buildRecord(element, index, 'search-result'));
      const allRecords = [...referenceRecords, ...searchRecords];
      await enrichRecordsWithNcbi(allRecords, settings.ncbiApiEnabled === true);
      if (!runtime.isAvailable() || generation !== scanGeneration) return;

      // Exact-title propagation is intentionally local to the current page. It lets
      // alternate search-result URLs for the same work share an identifier only when
      // another result on the page resolved to one unambiguous DOI.
      propagateExactTitleIdentities(allRecords);
      allRecords.forEach(markResolvedIdentity);

      const records = allRecords
        .filter(record => record.doi)
        .map(record => ({
          id: record.id,
          number: record.number,
          doi: record.doi,
          text: record.text,
          kind: record.kind
        }));
      const pageDoi = extractCurrentArticleDoi();
      const fingerprint = JSON.stringify([
        pageDoi,
        records.map(record => [record.id, record.kind, record.number, record.doi])
      ]);
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;

      // The background still accepts the historical `references` field. Search-result
      // records are deliberately sent through the same formal-status pipeline so
      // publisher detection and integrity detection no longer have separate identity
      // resolution paths. `kind` is retained for forward-compatible consumers.
      runtime.sendMessage({ type: 'integrityScan', data: { pageDoi, references: records } });
    });
  }

  function scheduleScan(delay = 300) {
    if (!runtime.isAvailable()) return stop();
    clearTimeout(scanTimer);
    const generation = ++scanGeneration;
    scanTimer = setTimeout(() => void scanDocument(generation), delay);
  }

  function nodeTouchesIntegrityContext(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches(OWN_NODE_SELECTOR) || node.closest(OWN_NODE_SELECTOR)) return false;
    const selectors = [configuredReferenceSelector(), configuredSearchSelector()].filter(Boolean);
    try {
      for (const selector of selectors) {
        if (node.matches(selector) || node.querySelector(selector)) return true;
      }
      if (node.matches('a[href*="doi.org"],a[href*="10."],a[href*="pubmed.ncbi.nlm.nih.gov"],a[href*="pmc.ncbi.nlm.nih.gov"],a[href*="europepmc.org/article/"]')) return true;
      return Boolean(node.querySelector('a[href*="doi.org"],a[href*="10."],a[href*="pubmed.ncbi.nlm.nih.gov"],a[href*="pmc.ncbi.nlm.nih.gov"],a[href*="europepmc.org/article/"]'));
    } catch {
      return false;
    }
  }

  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id || message?.type !== 'forceIntegrityRescan') return false;
      lastFingerprint = '';
      scheduleScan(0);
      sendResponse({ scheduled: true });
      return false;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && (changes.integrityLookupsEnabled || changes.ncbiApiEnabled)) {
        lastFingerprint = '';
        scheduleScan(0);
      }
    });
  } catch (error) {
    if (runtime.isInvalidationError(error)) return stop();
    throw error;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleScan(0), { once: true });
  } else scheduleScan(0);

  observer = new MutationObserver(mutations => {
    if (!runtime.isAvailable()) return stop();
    for (const mutation of mutations) {
      for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
        if (nodeTouchesIntegrityContext(node)) {
          scheduleScan(350);
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();