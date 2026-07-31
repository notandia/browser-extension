'use strict';

;(function initializeIntegrityScanner() {
  if (window.mdpiIntegrityScannerInjected) return;
  window.mdpiIntegrityScannerInjected = true;

  const runtime = window.NotandiaRuntime;
  if (!runtime?.isAvailable()) return;

  const MAX_REFERENCES = 250;
  const MAX_TEXT_LENGTH = 500;
  const DOI_PATTERN = /\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi;
  const OWN_NODE_SELECTOR = '.notandia-publisher-badges,.notandia-integrity-chip,#notandia-publisher-profile-styles';
  let scanTimer = null;
  let observer = null;
  let lastFingerprint = '';

  function stop() {
    clearTimeout(scanTimer);
    scanTimer = null;
    observer?.disconnect();
    observer = null;
  }

  function normalizeDoi(value) {
    if (typeof value !== 'string') return null;
    let normalized = value.trim();
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Keep malformed percent-encoded input unchanged.
    }
    normalized = normalized
      .replace(/^doi\s*:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
    return /^10\.\d{4,9}\/[\w.()/:;+-]+$/i.test(normalized) ? normalized : null;
  }

  function doisFromValue(value) {
    const dois = [];
    const seen = new Set();
    for (const found of String(value || '').matchAll(DOI_PATTERN)) {
      const doi = normalizeDoi(found[0]);
      if (doi && !seen.has(doi)) {
        seen.add(doi);
        dois.push(doi);
      }
    }
    return dois;
  }

  function extractDoiFromElement(element) {
    const candidates = [];
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi']) {
      const value = element.getAttribute?.(attribute);
      if (value) candidates.push(value);
    }
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      const href = link.getAttribute('href') || '';
      if (/doi\.org\//i.test(href) || /10\.\d{4,9}\//i.test(href)) candidates.push(href);
    }
    candidates.push(element.textContent || '');
    for (const candidate of candidates) {
      const doi = doisFromValue(candidate)[0];
      if (doi) return doi;
    }
    return null;
  }

  function extractCurrentArticleDoi() {
    const selectors = [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="DC.Identifier"]',
      'meta[name="doi"]',
      'meta[property="citation_doi"]'
    ];
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content') || '';
      const doi = normalizeDoi(value) || doisFromValue(value)[0];
      if (doi) return doi;
    }
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    return doisFromValue(`${canonical} ${document.location.href}`)[0] || null;
  }

  function configuredReferenceSelector() {
    const configured = window.MDPIFilterReferenceSelectors;
    return typeof configured === 'string' && configured.trim() ? configured : '';
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

  function referenceIdentifier(element, index) {
    const existing =
      element.dataset?.mdpiFilterRefId ||
      element.id ||
      element.getAttribute?.('data-bib-id') ||
      element.getAttribute?.('data-reference-id');
    const normalized = String(existing || '').trim();
    if (/^[A-Za-z0-9_.:-]{1,256}$/.test(normalized)) return normalized;
    const generated = `integrity-ref-${index + 1}`;
    element.setAttribute('data-mdpi-filter-ref-id', generated);
    return generated;
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

    const identifier = String(element.dataset?.mdpiFilterRefId || element.id || '');
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

  function scanDocument() {
    if (!runtime.isAvailable()) return stop();
    runtime.storageGet('sync', { integrityLookupsEnabled: false }, (settings, error) => {
      if (error || !runtime.isAvailable()) return stop();
      if (settings.integrityLookupsEnabled !== true) {
        runtime.sendMessage({ type: 'integrityScanDisabled' });
        return;
      }

      const references = [];
      const seenDois = new Set();
      const nodes = referenceNodes();
      for (let index = 0; index < nodes.length; index += 1) {
        const element = nodes[index];
        const doi = extractDoiFromElement(element);
        if (!doi || seenDois.has(doi)) continue;
        seenDois.add(doi);
        references.push({
          id: referenceIdentifier(element, index),
          number: referenceNumber(element, index),
          doi,
          text: String(element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH)
        });
      }

      const pageDoi = extractCurrentArticleDoi();
      const fingerprint = JSON.stringify([
        pageDoi,
        references.map(reference => [reference.id, reference.doi]),
        references.map(reference => reference.number)
      ]);
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      runtime.sendMessage({ type: 'integrityScan', data: { pageDoi, references } });
    });
  }

  function scheduleScan(delay = 300) {
    if (!runtime.isAvailable()) return stop();
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanDocument, delay);
  }

  function nodeTouchesIntegrityContext(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches(OWN_NODE_SELECTOR) || node.closest(OWN_NODE_SELECTOR)) return false;
    const selector = configuredReferenceSelector();
    try {
      if (selector && (node.matches(selector) || node.querySelector(selector))) return true;
      if (node.matches('a[href*="doi.org"],a[href*="10."],[data-doi],[data-reference-doi]')) return true;
      return Boolean(node.querySelector('a[href*="doi.org"],a[href*="10."],[data-doi],[data-reference-doi]'));
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
      if (area === 'sync' && changes.integrityLookupsEnabled) {
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