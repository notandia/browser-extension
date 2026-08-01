'use strict';

;(function initializeNcbiContextBridge() {
  if (window.notandiaNcbiContextBridgeInjected) return;
  window.notandiaNcbiContextBridgeInjected = true;

  const hostname = location.hostname.toLowerCase().replace(/^www\./, '');
  if (!['pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov'].includes(hostname)) return;

  const api = window.NotandiaPublisherProfiles;
  const workIdentifiers = window.NotandiaWorkIdentifiers;
  if (!api || !workIdentifiers) return;

  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const MAX_REFERENCES = 250;
  const MAX_IDS_PER_TYPE = 200;
  const MAX_TEXT = 500;
  let scanTimer = null;
  let observer = null;
  let lastFingerprint = '';
  let runGeneration = 0;

  const normalizeDoi = workIdentifiers.normalizeDOI;
  const normalizePmid = workIdentifiers.normalizePMID;
  const normalizePmcid = workIdentifiers.normalizePMCID;

  function addDoi(set, value, method = 'ncbi-page-value') {
    const identity = workIdentifiers.extract(value, {
      source: hostname,
      method,
      confidence: 'exact'
    });
    for (const doi of identity.identifiers.doi) set.add(doi);
  }

  function addHostname(set, value) {
    try {
      const url = new URL(String(value || ''), document.baseURI);
      if (/^https?:$/.test(url.protocol)) set.add(url.hostname.toLowerCase().replace(/^www\./, ''));
    } catch {}
  }

  function identifiersFromValue(value, output, method = 'ncbi-page-value') {
    const identity = workIdentifiers.extract(value, {
      source: hostname,
      method,
      confidence: 'exact'
    });
    for (const pmid of identity.identifiers.pmid) output.pmids.add(pmid);
    for (const pmcid of identity.identifiers.pmcid) output.pmcids.add(pmcid);
  }

  function identifiersFromElement(element) {
    const output = { pmids: new Set(), pmcids: new Set() };
    identifiersFromValue(element.textContent || '', output, 'reference-text');
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      identifiersFromValue(link.getAttribute('href') || '', output, 'reference-link');
    }
    return output;
  }

  function pageIdentifiers() {
    const output = { pmids: new Set(), pmcids: new Set() };
    identifiersFromValue(location.href, output, 'article-url');
    return output;
  }

  function directDoiFromElement(element) {
    const dois = new Set();
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi']) {
      addDoi(dois, element.getAttribute?.(attribute) || '', 'reference-attribute');
    }
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      addDoi(dois, link.getAttribute('href') || '', 'reference-link');
      addDoi(dois, link.getAttribute('data-doi') || '', 'reference-link-attribute');
    }
    addDoi(dois, element.textContent || '', 'reference-text');
    return Array.from(dois)[0] || null;
  }

  function directPageDoi() {
    const selectors = [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="DC.Identifier"]',
      'meta[name="doi"]',
      'meta[property="citation_doi"]'
    ];
    for (const selector of selectors) {
      const doi = normalizeDoi(document.querySelector(selector)?.getAttribute('content') || '');
      if (doi) return doi;
    }
    const articleDoiLink = document.querySelector(
      'main a[href^="https://doi.org/10."], .full-view a[href^="https://doi.org/10."], a.id-link[href^="https://doi.org/10."]'
    );
    return normalizeDoi(articleDoiLink?.getAttribute('href') || '');
  }

  function referenceNodes() {
    const selector = typeof window.MDPIFilterReferenceSelectors === 'string'
      ? window.MDPIFilterReferenceSelectors.trim()
      : '';
    if (!selector) return [];
    try {
      let nodes = Array.from(document.querySelectorAll(selector));
      nodes = nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
      return nodes.slice(0, MAX_REFERENCES);
    } catch {
      return [];
    }
  }

  function cleanText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.notandia-publisher-badges,.notandia-integrity-chip').forEach(node => node.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  }

  function referenceId(element, index) {
    const candidates = [
      element.getAttribute?.('data-mdpi-filter-ref-id'),
      element.id,
      element.getAttribute?.('data-bib-id'),
      element.getAttribute?.('data-reference-id'),
      element.getAttribute?.('content-id')
    ];
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (SAFE_REFERENCE_ID.test(normalized)) return normalized;
    }
    const generated = `notandia-ncbi-reference-${index + 1}`;
    element.setAttribute('data-mdpi-filter-ref-id', generated);
    return generated;
  }

  function positiveNumber(value) {
    const number = Number(String(value || '').match(/0*(\d{1,5})/)?.[1]);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function referenceNumber(element, index) {
    for (const value of [
      element.getAttribute?.('data-counter'),
      element.getAttribute?.('data-content'),
      element.getAttribute?.('data-number'),
      element.getAttribute?.('data-reference-number')
    ]) {
      const number = positiveNumber(value);
      if (number) return number;
    }
    const aria = positiveNumber(String(element.getAttribute?.('aria-label') || '').match(/(?:reference|citation)\s*(\d+)/i)?.[1]);
    return aria || index + 1;
  }

  function evidenceFromElement(element, doi) {
    const hostnames = new Set();
    for (const link of element.querySelectorAll?.('a[href]') || []) addHostname(hostnames, link.getAttribute('href') || '');
    return { dois: doi ? [doi] : [], hostnames: Array.from(hostnames) };
  }

  function sendMessage(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(response || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get({
        publisherWatchlist: null,
        mode: 'highlight',
        highlightPotentialMdpiSites: true,
        potentialMdpiHighlightColor: '#E2211C',
        integrityLookupsEnabled: false,
        ncbiApiEnabled: true
      }, stored => resolve(chrome.runtime.lastError ? null : stored));
    });
  }

  async function resolveIds(ids, idType) {
    const list = Array.from(ids).slice(0, MAX_IDS_PER_TYPE);
    if (!list.length) return [];
    const response = await sendMessage({ type: 'ncbiIdConversion', idType, ids: list });
    return response?.success && Array.isArray(response.records) ? response.records : [];
  }

  function resolutionMaps(records) {
    const shared = workIdentifiers.resolutionMapsFromNCBI(records);
    return { pmids: shared.pmidToDoi, pmcids: shared.pmcidToDoi };
  }

  function resolvedDoi(identifiers, maps) {
    const identity = workIdentifiers.extract({
      pmid: Array.from(identifiers.pmids || []),
      pmcid: Array.from(identifiers.pmcids || [])
    }, {
      source: hostname,
      method: 'ncbi-identifier-set',
      confidence: 'exact'
    });
    return workIdentifiers.resolvedDOI(identity, {
      pmidToDoi: maps.pmids,
      pmcidToDoi: maps.pmcids
    });
  }

  function clearBridgeVisuals() {
    for (const element of document.querySelectorAll('[data-notandia-ncbi-visual="true"]')) {
      element.querySelectorAll(':scope > [data-notandia-ncbi-badges="true"]').forEach(node => node.remove());
      element.style.removeProperty('display');
      element.style.removeProperty('opacity');
      element.style.removeProperty('border-left');
      element.style.removeProperty('padding-left');
      element.style.removeProperty('background-color');
      element.removeAttribute('data-notandia-profile-style');
      element.removeAttribute('data-notandia-ncbi-visual');
    }
  }

  function rgba(hex, alpha) {
    const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(hex || '');
    if (!match) return `rgba(72,98,122,${alpha})`;
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})`;
  }

  function applyResolvedVisual(element, matches) {
    if (!matches.length || element.hasAttribute('data-notandia-profile-style')) return;
    const visual = api.resolveVisualMatch(matches);
    if (!visual) return;
    element.setAttribute('data-notandia-profile-style', visual.profileId);
    element.setAttribute('data-notandia-ncbi-visual', 'true');

    const visible = matches.filter(match => match.action !== 'none');
    if (visible.length) {
      const container = document.createElement('span');
      container.className = 'notandia-publisher-badges';
      container.setAttribute('data-notandia-ncbi-badges', 'true');
      container.setAttribute('aria-label', 'Notandia publisher watchlist matches');
      for (const match of visible) {
        const badge = document.createElement('span');
        badge.className = 'notandia-publisher-badge';
        badge.textContent = match.profileName;
        badge.style.setProperty('--notandia-profile-color', match.color);
        badge.title = `${match.profileName}: confirmed match (${match.reasons.join(', ')})`;
        container.appendChild(badge);
      }
      element.prepend(container);
    }

    if (visual.action === 'hide') element.style.setProperty('display', 'none', 'important');
    else if (visual.action === 'dim') element.style.setProperty('opacity', '0.45', 'important');
    else if (visual.action === 'highlight') {
      element.style.setProperty('border-left', `4px solid ${visual.color}`, 'important');
      element.style.setProperty('padding-left', '8px', 'important');
      element.style.setProperty('background-color', rgba(visual.color, 0.08), 'important');
    }
  }

  async function scan() {
    const generation = ++runGeneration;
    const stored = await loadSettings();
    if (!stored || generation !== runGeneration) return;
    const settings = api.migrateLegacySettings(stored);
    await sendMessage({ type: 'publisherScanStarted' });

    try {
      clearBridgeVisuals();
      const pageIds = pageIdentifiers();
      const entries = referenceNodes().map((element, index) => ({
        element,
        id: referenceId(element, index),
        number: referenceNumber(element, index),
        text: cleanText(element),
        directDoi: directDoiFromElement(element),
        identifiers: identifiersFromElement(element)
      }));

      const pmids = new Set(pageIds.pmids);
      const pmcids = new Set(pageIds.pmcids);
      for (const entry of entries) {
        for (const id of entry.identifiers.pmids) pmids.add(id);
        for (const id of entry.identifiers.pmcids) pmcids.add(id);
      }

      const records = stored.ncbiApiEnabled === false
        ? []
        : [
            ...(await resolveIds(pmids, 'pmid')),
            ...(await resolveIds(pmcids, 'pmcid'))
          ];
      if (generation !== runGeneration) return;
      const maps = resolutionMaps(records);
      const pageDoi = resolvedDoi(pageIds, maps) || directPageDoi();

      const referenceRecords = entries.map(entry => {
        const doi = entry.directDoi || resolvedDoi(entry.identifiers, maps);
        const matches = api.matchProfiles(settings, evidenceFromElement(entry.element, doi));
        if (doi && !entry.directDoi) entry.element.setAttribute('data-doi', doi);
        if (matches.length) applyResolvedVisual(entry.element, matches);
        return {
          id: entry.id,
          kind: 'reference',
          number: entry.number,
          doi,
          text: entry.text,
          matches
        };
      });

      const currentEvidence = {
        dois: pageDoi ? [pageDoi] : [],
        hostnames: [hostname]
      };
      const currentArticle = {
        doi: pageDoi,
        matches: api.matchProfiles(settings, currentEvidence)
      };
      const publisherReferences = referenceRecords.filter(record => record.matches.length);
      const integrityReferences = referenceRecords
        .filter(record => record.doi)
        .map(({ matches, kind, ...record }) => record);
      const fingerprint = JSON.stringify([
        settings,
        pageDoi,
        publisherReferences.map(record => [record.id, record.number, record.doi, record.matches.map(match => match.profileId)]),
        integrityReferences.map(record => [record.id, record.number, record.doi])
      ]);
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        await sendMessage({
          type: 'publisherContextUpdate',
          data: { currentArticle, references: publisherReferences, searchResults: [] }
        });
        if (stored.integrityLookupsEnabled === true) {
          await sendMessage({ type: 'integrityScan', data: { pageDoi, references: integrityReferences } });
        }
      }
    } finally {
      await sendMessage({ type: 'publisherScanFinished' });
    }
  }

  function schedule(delay = 500) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => void scan(), delay);
  }

  chrome.runtime.onMessage.addListener(message => {
    if (['forcePublisherRescan', 'forceIntegrityRescan'].includes(message?.type)) {
      lastFingerprint = '';
      schedule(0);
    }
    return false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (
      changes.publisherWatchlist || changes.mode || changes.highlightPotentialMdpiSites ||
      changes.potentialMdpiHighlightColor || changes.integrityLookupsEnabled || changes.ncbiApiEnabled
    )) {
      lastFingerprint = '';
      schedule(0);
    }
  });

  observer = new MutationObserver(mutations => {
    if (mutations.some(mutation =>
      Array.from(mutation.addedNodes).some(node => node instanceof Element && !node.closest?.('.notandia-publisher-badges,.notandia-integrity-chip')) ||
      Array.from(mutation.removedNodes).some(node => node instanceof Element && !node.closest?.('.notandia-publisher-badges,.notandia-integrity-chip'))
    )) schedule(900);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  schedule(150);
  setTimeout(() => schedule(0), 1800);
})();
