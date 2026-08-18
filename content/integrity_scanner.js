'use strict';

;(function initializeIntegrityScanner() {
  if (window.notandiaIntegrityScannerInjected) return;
  window.notandiaIntegrityScannerInjected = true;

  const runtime = window.NotandiaRuntime;
  const workIds = window.NotandiaWorkIdentifiers;
  const sourceContext = window.NotandiaSourceContext;
  if (!runtime?.isAvailable() || !workIds || !sourceContext) return;

  const MAX_REFERENCES = 250;
  const MAX_SEARCH_RESULTS = 150;
  const MAX_TEXT_LENGTH = 500;
  const OWN_NODE_SELECTOR = '.notandia-publisher-badges,.notandia-integrity-chip,#notandia-publisher-profile-styles';
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
    return sourceContext.buildRecord(element, index, kind, MAX_TEXT_LENGTH);
  }

  async function enrichRecordsWithNcbi(records, enabled) {
    if (!enabled || !records.length) return;
    const resolver = (window.NotandiaNcbiApiHandler || window.MDPIFilterNcbiApiHandler)?.resolveNcbiIdsToDois;
    if (typeof resolver !== 'function') return;

    const pmids = new Set();
    const pmcids = new Set();
    for (const record of records) {
      if (record.doi) continue;
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
      if (record.doi) continue;
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
      if (resolved) sourceContext.setResolvedDoi(record, resolved);
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
      sourceContext.setResolvedDoi(record, Array.from(candidates)[0]);
    }
  }

  function extractCurrentArticleDoi() {
    const values = [];
    for (const selector of [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="DC.Identifier"]',
      'meta[name="doi"]',
      'meta[property="citation_doi"]'
    ]) values.push(document.querySelector(selector)?.getAttribute('content') || '');
    values.push(document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '', document.location.href);
    return workIds.extract(values, {
      source: 'notandia-source-context',
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

      // Source discovery is publisher-agnostic. Every structurally identifiable
      // source/reference is admitted here; only the later DOI lookup determines
      // whether formal integrity metadata can be checked.
      const referenceRecords = sourceContext.referenceNodes(MAX_REFERENCES)
        .map((element, index) => buildRecord(element, index, 'reference'));
      const searchRecords = sourceContext.searchNodes(MAX_SEARCH_RESULTS)
        .map((element, index) => buildRecord(element, index, 'search-result'));
      const allRecords = [...referenceRecords, ...searchRecords];

      await enrichRecordsWithNcbi(allRecords, settings.ncbiApiEnabled === true);
      if (!runtime.isAvailable() || generation !== scanGeneration) return;

      // Search engines may expose the same work through publisher, PubMed, PMC,
      // Europe PMC, or other URLs. Propagate a DOI only when an exact normalized
      // title maps to exactly one already-resolved DOI on this page.
      propagateExactTitleIdentities(allRecords);

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

      // `references` is the historical background field name. It now contains
      // DOI-bearing source records as well as bibliography references; `kind`
      // preserves the distinction for presentation and future consumers.
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
    const selectors = [
      sourceContext.configuredReferenceSelector(),
      sourceContext.configuredSearchSelector()
    ].filter(Boolean);
    try {
      for (const selector of selectors) {
        if (node.matches(selector) || node.querySelector(selector)) return true;
      }
      const evidenceSelector = 'a[href*="doi.org"],a[href*="10."],a[href*="pubmed.ncbi.nlm.nih.gov"],a[href*="pmc.ncbi.nlm.nih.gov"],a[href*="europepmc.org/article/"]';
      if (node.matches(evidenceSelector)) return true;
      return Boolean(node.querySelector(evidenceSelector));
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
