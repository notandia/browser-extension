'use strict';

;(function initializeNotandiaSourceContext() {
  if (window.NotandiaSourceContext) return;

  const workIds = window.NotandiaWorkIdentifiers;
  if (!workIds) return;

  const SAFE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const REFERENCE_ID_ATTRIBUTE = 'data-notandia-ref-id';
  const LEGACY_REFERENCE_ID_ATTRIBUTE = 'data-mdpi-filter-ref-id';
  const DOI_ATTRIBUTE = 'data-notandia-doi';

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
    const selector = configuredReferenceSelector();
    let nodes = [];
    if (selector) {
      try { nodes = Array.from(document.querySelectorAll(selector)); } catch { nodes = []; }
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
    const selector = configuredSearchSelector();
    if (!selector) return [];
    try {
      return dedupeNodes(Array.from(document.querySelectorAll(selector)))
        .slice(0, Math.max(0, limit));
    } catch {
      return [];
    }
  }

  function cleanText(element, maxLength = 500) {
    if (!(element instanceof Element)) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll(
      '.notandia-publisher-badges,.notandia-publisher-badge,.notandia-integrity-chip,#notandia-publisher-profile-styles'
    ).forEach(node => node.remove());
    return String(clone.textContent || '')
      .replace(/[\s\u00a0]+/g, ' ')
      .trim()
      .slice(0, Math.max(0, maxLength));
  }

  function addHostname(set, value) {
    try {
      const url = new URL(String(value || ''), document.baseURI);
      if (!/^https?:$/.test(url.protocol)) return;
      set.add(url.hostname.toLowerCase().replace(/^www\./, ''));
    } catch {}
  }

  function evidenceFromElement(element, text = cleanText(element)) {
    const hostnames = new Set();
    const values = [text];
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi', DOI_ATTRIBUTE]) {
      const value = element.getAttribute?.(attribute);
      if (value) values.push(value);
    }
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      const href = link.getAttribute('href') || '';
      values.push(href, link.getAttribute('data-doi') || '');
      addHostname(hostnames, href);
    }

    const identity = workIds.extract(values, {
      source: 'notandia-source-context',
      method: 'page-evidence',
      confidence: 'exact'
    });

    return {
      identity,
      hostnames: Array.from(hostnames).sort(),
      dois: Array.from(identity.identifiers.doi || []),
      pmids: Array.from(identity.identifiers.pmid || []),
      pmcids: Array.from(identity.identifiers.pmcid || []),
      arxiv: Array.from(identity.identifiers.arxiv || []),
      profileSignals: []
    };
  }

  function safeRecordId(element, index, kind) {
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
    const zeroBased = Number(element.getAttribute?.('data-rp'));
    if (Number.isFinite(zeroBased) && zeroBased >= 0) return zeroBased + 1;
    return index + 1;
  }

  function titleFromElement(element, text) {
    const candidate = element.querySelector?.(
      'h3, [role="heading"], [data-crb-snippet-text], .gpZmoc, .otQkpb'
    )?.textContent || text;
    return String(candidate || '').replace(/[\s\u00a0]+/g, ' ').trim().slice(0, 300);
  }

  function buildRecord(element, index, kind, maxTextLength = 500) {
    const text = cleanText(element, maxTextLength);
    const evidence = evidenceFromElement(element, text);
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

  function setResolvedDoi(record, doi) {
    const normalized = workIds.normalizeDOI(doi || '');
    record.doi = normalized || null;
    if (normalized) {
      record.evidence.dois = [normalized];
      record.element.setAttribute(DOI_ATTRIBUTE, normalized);
    } else {
      record.element.removeAttribute(DOI_ATTRIBUTE);
    }
    return record.doi;
  }

  window.NotandiaSourceContext = Object.freeze({
    DOI_ATTRIBUTE,
    activeSearchConfig,
    buildRecord,
    cleanText,
    configuredReferenceSelector,
    configuredSearchSelector,
    evidenceFromElement,
    referenceNodes,
    searchNodes,
    setResolvedDoi
  });
})();