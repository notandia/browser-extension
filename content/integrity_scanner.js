'use strict';

;(function initializeIntegrityScanner() {
  if (window.mdpiIntegrityScannerInjected) return;
  window.mdpiIntegrityScannerInjected = true;

  const MAX_REFERENCES = 250;
  const MAX_TEXT_LENGTH = 500;
  const DOI_PATTERN = /\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi;
  const OWN_NODE_SELECTOR = '.notandia-publisher-badges,.notandia-integrity-chip,#notandia-publisher-profile-styles';
  let scanTimer = null;
  let lastFingerprint = '';

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

  function referenceNumber(element, index) {
    const counter = String(element.getAttribute?.('data-counter') || '').match(/\d+/)?.[0];
    const numericCounter = Number(counter);
    if (Number.isFinite(numericCounter) && numericCounter > 0) return numericCounter;
    const identifier = String(element.dataset?.mdpiFilterRefId || element.id || '');
    const numericIdentifier = Number(identifier.match(/\d+(?!.*\d)/)?.[0]);
    return Number.isFinite(numericIdentifier) && numericIdentifier > 0 ? numericIdentifier : index + 1;
  }

  function scanDocument() {
    chrome.storage.sync.get({ integrityLookupsEnabled: false }, settings => {
      if (chrome.runtime.lastError) return;
      if (settings.integrityLookupsEnabled !== true) {
        chrome.runtime.sendMessage({ type: 'integrityScanDisabled' }, () => void chrome.runtime.lastError);
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
      const fingerprint = JSON.stringify([pageDoi, references.map(reference => [reference.id, reference.doi])]);
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      chrome.runtime.sendMessage({ type: 'integrityScan', data: { pageDoi, references } }, () => void chrome.runtime.lastError);
    });
  }

  function scheduleScan(delay = 300) {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleScan(0), { once: true });
  } else scheduleScan(0);

  const observer = new MutationObserver(mutations => {
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