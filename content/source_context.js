'use strict';

;(function initializeNotandiaSourceContext() {
  if (window.NotandiaSourceContext) return;

  const workIds = window.NotandiaWorkIdentifiers;
  if (!workIds) return;

  const SAFE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const REFERENCE_ID_ATTRIBUTE = 'data-notandia-ref-id';
  const LEGACY_REFERENCE_ID_ATTRIBUTE = 'data-mdpi-filter-ref-id';
  const DOI_ATTRIBUTE = 'data-notandia-doi';
  const OWN_NODE_SELECTOR = '.notandia-publisher-badges,.notandia-publisher-badge,.notandia-integrity-chip,#notandia-publisher-profile-styles';

  function activeSearchConfig() {
    const domainUtils = window.NotandiaDomainUtils || window.MDPIFilterDomainUtils;
    const domains = window.NotandiaDomains || window.MDPIFilterDomains;
    return domainUtils?.getActiveSearchConfig?.(
      location.hostname,
      location.pathname,
      domains
    ) || null;
  }

  function configuredReferenceSelector() {
    const selector = window.NotandiaReferenceSelectors || window.MDPIFilterReferenceSelectors;
    return typeof selector === 'string' && selector.trim() ? selector : '';
  }

  function configuredSearchSelector() {
    const config = activeSearchConfig();
    const selector = config?.itemSelector || config?.container || '';
    return typeof selector === 'string' && selector.trim() ? selector : '';
  }

  function dedupeNodes(nodes) {
    const seen = new Set();
    return nodes.filter(node => {
      if (!(node instanceof Element) || seen.has(node)) return false;
      seen.add(node);
      return true;
    });
  }

  function referenceNodes(limit = 300) {
    // Search cards can match legacy bibliography fallbacks (li IDs containing
    // "r", for example). A search result must never become a second reference.
    if (activeSearchConfig()) return [];
    const selector = configuredReferenceSelector();
    let nodes = [];
    if (selector) {
      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch {
        nodes = [];
      }
    }
    if (!nodes.length) {
      nodes = Array.from(document.querySelectorAll(
        'ol.references > li, ul.references > li, .reference-list li, #references li, [role="doc-bibliography"] li'
      ));
    }
    nodes = dedupeNodes(nodes);
    nodes = nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
    const hasNatureMainBibliography = nodes.some(node => node.matches?.('li.c-article-references__item'));
    if (hasNatureMainBibliography) {
      nodes = nodes.filter(node => !node.closest?.('.c-reading-companion,.c-reading-companion__reference-item'));
    }
    return nodes.slice(0, Math.max(0, limit));
  }

  function searchNodes(limit = 150) {
    const config = activeSearchConfig();
    const selector = configuredSearchSelector();
    if (!selector) return [];
    try {
      const nodes = dedupeNodes(Array.from(document.querySelectorAll(selector)))
        // Scholar also uses gs_r for its "See all results" / related-search UI.
        .filter(node => location.hostname !== 'scholar.google.com' || node.querySelector('.gs_rt'))
        .filter(node => !config?.titleLinkSelector || searchLinks(node, config).length)
        // Google AI answers and question modules contain citations to multiple
        // sources. Their container is not itself a publisher's search result.
        .filter(node => !config?.isGoogleWeb || !node.querySelector('[data-aim]'));
      return nodes.filter(node => !nodes.some(other => other !== node && node.contains(other)))
        .slice(0, Math.max(0, limit));
    } catch {
      return [];
    }
  }

  function searchDestination(href, config) {
    try {
      let url = new URL(href, document.baseURI);
      if (!/^https?:$/.test(url.protocol)) return null;
      if (url.hostname === location.hostname) {
        if (config?.isGoogleWeb && url.pathname === '/url') {
          url = new URL(url.searchParams.get('url') || url.searchParams.get('q'));
        } else if (config?.isDuckDuckGo && url.searchParams.has('uddg')) {
          url = new URL(url.searchParams.get('uddg'));
        } else if (config?.isBingWeb && url.pathname === '/ck/a') {
          const encoded = url.searchParams.get('u') || '';
          if (!encoded.startsWith('a1')) return null;
          url = new URL(atob(encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/')));
        } else if (config?.host !== 'pubmed.ncbi.nlm.nih.gov' && config !== window.MDPIFilterDomains?.europepmc) {
          return null;
        }
      }
      if (!/^https?:$/.test(url.protocol) || url.hostname === 'scholar.googleusercontent.com') return null;
      // Search tracking/query parameters may mention a different paper.
      url.search = '';
      url.hash = '';
      return url.href;
    } catch { return null; }
  }

  function searchLinks(element, config = activeSearchConfig()) {
    const primarySelector = config?.titleLinkSelector || (location.hostname === 'scholar.google.com' ? '.gs_rt a[href]' : 'h2 a[href], h3 a[href], a[href]:has(h3)');
    const primary = Array.from(element.querySelectorAll?.(primarySelector) || []).slice(0, 1);
    const alternate = config?.alternateLinkSelector
      ? Array.from(element.querySelectorAll(config.alternateLinkSelector)) : [];
    return [...new Set([...primary, ...alternate])].filter(link => searchDestination(link.getAttribute('href'), config));
  }

  function cleanText(element, maxLength = 500) {
    if (!(element instanceof Element)) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll(OWN_NODE_SELECTOR).forEach(node => node.remove());
    return String(clone.textContent || '')
      .replace(/[\s\u00a0]+/g, ' ')
      .trim()
      .slice(0, Math.max(0, maxLength));
  }

  function addHostname(set, value) {
    // In-page footnote backlinks describe navigation, not the cited publisher.
    if (!String(value || '').trim() || String(value).trim().startsWith('#')) return;
    try {
      const url = new URL(String(value || ''), document.baseURI);
      if (!/^https?:$/.test(url.protocol)) return;
      set.add(url.hostname.toLowerCase().replace(/^www\./, ''));
    } catch {}
  }

  function evidenceFromValues(values, hostnames, options) {
    const identity = workIds.extract(values, options);
    return {
      identity,
      hostnames: Array.from(hostnames || []).sort(),
      dois: Array.from(identity.identifiers.doi || []),
      pmids: Array.from(identity.identifiers.pmid || []),
      pmcids: Array.from(identity.identifiers.pmcid || []),
      arxiv: Array.from(identity.identifiers.arxiv || [])
    };
  }

  function addEuropePmcIdentifierValue(values, href) {
    try {
      const url = new URL(String(href || ''), document.baseURI);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'europepmc.org' && !host.endsWith('.europepmc.org')) return;
      const match = url.pathname.match(/^\/article\/(med|pmc)\/([^/?#]+)/i);
      if (!match) return;
      if (match[1].toLowerCase() === 'med' && /^\d{1,12}$/.test(match[2])) {
        values.push(`PMID: ${match[2]}`);
        return;
      }
      const numeric = String(match[2] || '').match(/^(?:PMC)?(\d{1,12})$/i)?.[1];
      if (match[1].toLowerCase() === 'pmc' && numeric) values.push(`PMCID: PMC${numeric}`);
    } catch {}
  }

  function evidenceFromElement(element, text = cleanText(element), kind = 'reference') {
    const hostnames = new Set();
    // The 500-character popup excerpt is not an identity-extraction limit: a
    // long author list can put the DOI at the end of a perfectly valid citation.
    const evidenceText = cleanText(element, 20000) || text;
    // A search snippet may quote another paper's DOI/PMCID. It is context, not
    // identity evidence for the result; use destination links and metadata.
    const values = kind === 'search-result' ? [] : [evidenceText];
    const linkExtractor = window.MDPIFilterLinkExtractor;
    if (kind === 'reference') {
      const configuredValues = linkExtractor?.extractReferenceValues?.(
        element, window.MDPIFilterLinkExtractionSelectors
      ) || [];
      values.push(...configuredValues);
      for (const value of configuredValues) {
        if (/^(?:https?:)?\/\//i.test(value)) addHostname(hostnames, value);
      }
    }
    // Scholar's canonical title destination precedes PDF mirrors, whose paths
    // may append .pdf to a DOI (e.g. Springer's /content/pdf/ endpoint).
    const searchConfig = activeSearchConfig();
    const links = kind === 'search-result' ? searchLinks(element, searchConfig)
      : Array.from(element.querySelectorAll?.('a[href]') || []);
    if (kind === 'search-result' && searchConfig?.identityMetadataSelector) {
      for (const metadata of element.querySelectorAll(searchConfig.identityMetadataSelector)) values.push(cleanText(metadata, 2000));
    }
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi', DOI_ATTRIBUTE]) {
      // Search engines reuse cards as queries change; our previous resolution
      // cannot be evidence for the new destination in that same DOM element.
      if (kind === 'search-result' && attribute === DOI_ATTRIBUTE) continue;
      const value = element.getAttribute?.(attribute);
      if (value) values.push(value);
    }
    for (const link of links) {
      const href = kind === 'search-result' ? searchDestination(link.getAttribute('href'), searchConfig) : link.getAttribute('href') || '';
      if (!href) continue;
      if (kind === 'search-result' && location.hostname === 'scholar.google.com') {
        try {
          // Scholar's navigation URLs repeat the user's query (scioq/q), which
          // may identify an entirely different work from this result.
          const hostname = new URL(href, document.baseURI).hostname;
          if (hostname === location.hostname || hostname === 'scholar.googleusercontent.com') continue;
        } catch { continue; }
      }
      const linkValue = linkExtractor?.referenceLinkValue?.(href) ?? href;
      values.push(linkValue, link.getAttribute('data-doi') || '');
      addEuropePmcIdentifierValue(values, href);
      if (linkValue === href) addHostname(hostnames, href);
    }
    const evidence = evidenceFromValues(values, hostnames, {
      source: 'notandia-source-context',
      method: 'page-evidence',
      confidence: 'exact'
    });
    evidence.profileSignals = kind === 'search-result' ? [] : window.MDPIFilterItemContentChecker?.publisherHints?.(
      evidenceText, element.querySelector?.('[itemprop="isPartOf"] [itemprop="name"],.journal-title')?.textContent
    ) || [];
    return evidence;
  }

  function currentArticleEvidence() {
    // A search URL describes a query, not a current scholarly article.
    if (activeSearchConfig()) return evidenceFromValues([], new Set(), { source: 'notandia-source-context', method: 'search-page' });
    const hostnames = new Set([location.hostname.toLowerCase().replace(/^www\./, '')]);
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
    values.push(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      location.href
    );
    return evidenceFromValues(values, hostnames, {
      source: 'notandia-source-context',
      method: 'current-article',
      confidence: 'exact'
    });
  }

  function safeRecordId(element, index, kind) {
    // Reuse the original site-aware ID mapping (Nature, Frontiers, Wiley,
    // ScienceDirect, BMJ, OUP) for popup navigation and inline footnotes alike.
    if (kind === 'reference' && window.MDPIFilterReferenceIdExtractor?.extractInternalScrollId) {
      const result = window.MDPIFilterReferenceIdExtractor.extractInternalScrollId(element, index);
      if (SAFE_ID.test(result.extractedId)) {
        element.setAttribute(REFERENCE_ID_ATTRIBUTE, result.extractedId);
        element.setAttribute(LEGACY_REFERENCE_ID_ATTRIBUTE, result.extractedId);
        return result.extractedId;
      }
    }
    const existing = element.dataset?.notandiaRefId ||
      element.dataset?.mdpiFilterRefId ||
      element.id ||
      element.getAttribute?.('data-bib-id') ||
      element.getAttribute?.('data-reference-id');
    const normalized = String(existing || '').trim();
    const id = SAFE_ID.test(normalized) ? normalized : `notandia-${kind}-${index + 1}`;
    element.setAttribute(REFERENCE_ID_ATTRIBUTE, id);
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
    const position = element.getAttribute?.('data-rp');
    const zeroBased = Number(position);
    if (position != null && /^\d+$/.test(position) && Number.isSafeInteger(zeroBased)) return zeroBased + 1;
    return index + 1;
  }

  function titleFromElement(element, text) {
    const candidate = element.querySelector?.(
      'h2, h3, .docsum-title, [role="heading"], [data-crb-snippet-text], .gs_rt, .gpZmoc, .otQkpb'
    )?.textContent || text;
    return String(candidate || '').replace(/[\s\u00a0]+/g, ' ').trim().slice(0, 300);
  }

  function buildRecord(element, index, kind, maxTextLength = 500) {
    const text = cleanText(element, maxTextLength);
    const evidence = evidenceFromElement(element, text, kind);
    return {
      element,
      evidence,
      identity: evidence.identity,
      id: safeRecordId(element, index, kind),
      kind,
      number: kind === 'reference' ? referenceNumber(element, index) : searchResultNumber(element, index),
      title: titleFromElement(element, text),
      doi: evidence.dois[0] || null,
      text
    };
  }

  function collectRecords({ maxReferences = 300, maxSearchResults = 150, maxTextLength = 500 } = {}) {
    const references = referenceNodes(maxReferences)
      .map((element, index) => buildRecord(element, index, 'reference', maxTextLength));
    const searchResults = searchNodes(maxSearchResults)
      .map((element, index) => buildRecord(element, index, 'search-result', maxTextLength));
    return { references, searchResults, all: [...references, ...searchResults] };
  }

  function setResolvedDoi(record, doi, source = 'ncbi-id-converter') {
    const normalized = workIds.normalizeDOI(doi || '');
    record.doi = normalized || null;
    if (normalized) {
      const resolvedIdentity = workIds.extract({ doi: normalized }, {
        source,
        method: 'resolved-doi',
        confidence: 'resolved'
      });
      record.identity = workIds.merge(record.identity, resolvedIdentity);
      record.evidence.identity = record.identity;
      record.evidence.dois = Array.from(record.identity.identifiers.doi || []);
      record.element.setAttribute(DOI_ATTRIBUTE, normalized);
    } else {
      record.element.removeAttribute(DOI_ATTRIBUTE);
    }
    return record.doi;
  }

  async function resolveRecordsWithNcbi(records, enabled) {
    const pending = (records || []).filter(record => !record.doi);
    if (!enabled || !pending.length) return { status: enabled ? 'not-needed' : 'disabled' };

    const resolver = (window.NotandiaNcbiApiHandler || window.MDPIFilterNcbiApiHandler)?.resolveNcbiIdsToDois;
    if (typeof resolver !== 'function') return { status: 'unavailable' };

    const pmids = new Set();
    const pmcids = new Set();
    for (const record of pending) {
      for (const pmid of record.evidence.pmids || []) pmids.add(pmid);
      for (const pmcid of record.evidence.pmcids || []) pmcids.add(pmcid);
    }

    const pmidResolution = pmids.size
      ? await resolver(Array.from(pmids), 'pmid')
      : { status: 'not-needed', doiById: new Map() };
    const pmcidResolution = pmcids.size
      ? await resolver(Array.from(pmcids), 'pmcid')
      : { status: 'not-needed', doiById: new Map() };

    for (const record of pending) {
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
      if (resolved) setResolvedDoi(record, resolved);
    }

    const statuses = [pmidResolution.status, pmcidResolution.status].filter(status => status && status !== 'not-needed');
    return { status: statuses[0] || 'not-needed' };
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

  function propagateExactTitleDois(records) {
    const resolvedByTitle = new Map();
    for (const record of records || []) {
      if (!record.doi) continue;
      const title = normalizedWorkTitle(record.title);
      if (title.length < 32) continue;
      if (!resolvedByTitle.has(title)) resolvedByTitle.set(title, new Set());
      resolvedByTitle.get(title).add(record.doi);
    }
    for (const record of records || []) {
      if (record.doi) continue;
      const title = normalizedWorkTitle(record.title);
      const candidates = resolvedByTitle.get(title);
      if (title.length < 32 || candidates?.size !== 1) continue;
      setResolvedDoi(record, Array.from(candidates)[0], 'same-page-exact-title');
    }
  }

  function nodeTouchesSourceContext(node) {
    if (!(node instanceof Element)) node = node?.parentElement;
    if (!(node instanceof Element)) return false;
    if (node.matches(OWN_NODE_SELECTOR) || node.closest(OWN_NODE_SELECTOR)) return false;
    const selectors = [configuredReferenceSelector(), configuredSearchSelector()].filter(Boolean);
    try {
      for (const selector of selectors) {
        if (node.matches(selector) || node.closest(selector) || node.querySelector(selector)) return true;
      }
      const evidenceSelector = [
        'a[href*="doi.org"]',
        'a[href*="10."]',
        'a[href*="pubmed.ncbi.nlm.nih.gov"]',
        'a[href*="pmc.ncbi.nlm.nih.gov"]',
        'a[href*="europepmc.org/article/"]',
        '[data-doi]',
        '[data-reference-doi]',
        '[data-article-doi]',
        'div.extra-links > span.data-doi', // Wiley hidden DOI metadata
        '.Z3988[title]' // Wikipedia/COinS metadata
      ].join(',');
      if (node.matches(evidenceSelector)) return true;
      return Boolean(node.querySelector(evidenceSelector));
    } catch {
      return false;
    }
  }

  window.NotandiaSourceContext = Object.freeze({
    DOI_ATTRIBUTE,
    REFERENCE_ID_ATTRIBUTE,
    LEGACY_REFERENCE_ID_ATTRIBUTE,
    activeSearchConfig,
    buildRecord,
    cleanText,
    collectRecords,
    configuredReferenceSelector,
    configuredSearchSelector,
    currentArticleEvidence,
    evidenceFromElement,
    nodeTouchesSourceContext,
    propagateExactTitleDois,
    referenceNodes,
    resolveRecordsWithNcbi,
    searchNodes,
    setResolvedDoi
  });
})();
