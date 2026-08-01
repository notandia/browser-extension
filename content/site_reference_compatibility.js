'use strict';

;(function initializeSiteReferenceCompatibility() {
  if (window.notandiaSiteReferenceCompatibilityInjected) return;
  window.notandiaSiteReferenceCompatibilityInjected = true;

  const runtime = window.NotandiaRuntime;
  if (!runtime?.isAvailable()) return;

  const MAX_REFERENCES = 250;
  const MAX_TEXT_LENGTH = 500;
  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const DOI_PATTERN = /\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi;
  const ownNodeSelector = '.notandia-integrity-chip,.notandia-publisher-badges,.notandia-publisher-badge';
  const hostname = location.hostname.toLowerCase().replace(/^www\./, '');
  const isWikipediaArticle = /(?:^|\.)wikipedia\.org$/.test(hostname) && /^\/wiki\//.test(location.pathname);
  const isPubmedArticle = hostname === 'pubmed.ncbi.nlm.nih.gov' && /^\/\d{1,12}\/?$/.test(location.pathname);

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
      // Preserve malformed input so a later regex can reject it safely.
    }
    const direct = normalized
      .replace(/^doi\s*:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
    if (/^10\.\d{4,9}\/[\w.()/:;+-]+$/i.test(direct)) return direct;

    const found = normalized.match(DOI_PATTERN)?.[0] || '';
    const extracted = found
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
    return /^10\.\d{4,9}\/[\w.()/:;+-]+$/i.test(extracted) ? extracted : null;
  }

  function firstDoi(element) {
    const candidates = [];
    for (const attribute of ['data-doi', 'data-article-doi', 'data-reference-doi']) {
      const value = element.getAttribute?.(attribute);
      if (value) candidates.push(value);
    }
    for (const link of element.querySelectorAll?.('a[href]') || []) {
      candidates.push(link.getAttribute('href') || '');
      candidates.push(link.textContent || '');
    }
    for (const metadata of element.querySelectorAll?.('.Z3988[title]') || []) {
      candidates.push(metadata.getAttribute('title') || '');
    }
    candidates.push(element.textContent || '');

    for (const candidate of candidates) {
      const doi = normalizeDoi(candidate);
      if (doi) return doi;
    }
    return null;
  }

  function wikipediaReferenceNumber(element, index) {
    const explicit = Number(element.getAttribute?.('data-mw-footnote-number'));
    if (Number.isFinite(explicit) && explicit > 0) return Math.trunc(explicit);

    const fromId = Number(String(element.id || '').match(/(?:-|_)(\d+)(?:-\d+)?$/)?.[1]);
    return Number.isFinite(fromId) && fromId > 0 ? fromId : index + 1;
  }

  function wikipediaReferences() {
    if (!isWikipediaArticle) return [];
    const references = [];
    const seen = new Set();
    const nodes = Array.from(document.querySelectorAll('li[id^="cite_note-"]')).slice(0, MAX_REFERENCES);
    for (let index = 0; index < nodes.length; index += 1) {
      const element = nodes[index];
      const doi = firstDoi(element);
      if (!doi || seen.has(doi)) continue;
      const id = SAFE_REFERENCE_ID.test(String(element.id || ''))
        ? element.id
        : `notandia-wikipedia-reference-${index + 1}`;
      element.setAttribute('data-mdpi-filter-ref-id', id);
      seen.add(doi);
      references.push({
        id,
        number: wikipediaReferenceNumber(element, index),
        doi,
        text: String(element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH)
      });
    }
    return references;
  }

  function scanWikipedia() {
    if (!isWikipediaArticle || !runtime.isAvailable()) return;
    runtime.storageGet('sync', { integrityLookupsEnabled: false }, (settings, error) => {
      if (error || !runtime.isAvailable()) return stop();
      if (settings.integrityLookupsEnabled !== true) return;
      const references = wikipediaReferences();
      const fingerprint = JSON.stringify(references.map(reference => [reference.id, reference.doi]));
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      runtime.sendMessage({
        type: 'integrityScan',
        data: {
          pageDoi: null,
          references,
          source: 'wikipedia-structured-references'
        }
      });
    });
  }

  function scheduleWikipediaScan(delay = 450) {
    if (!isWikipediaArticle || !runtime.isAvailable()) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanWikipedia, delay);
  }

  function patchWikipediaInlineSelectors() {
    if (!isWikipediaArticle) return;
    const utils = window.MDPIFilterUtils;
    const baseGenerator = utils?.generateInlineFootnoteSelectors;
    if (!utils || typeof baseGenerator !== 'function' || utils.notandiaWikipediaSelectorsPatched) return;
    utils.notandiaWikipediaSelectorsPatched = true;

    utils.generateInlineFootnoteSelectors = function generateWikipediaAwareSelectors(referenceId) {
      const selectors = [baseGenerator(referenceId)].filter(Boolean);
      const reference = document.getElementById(String(referenceId || ''));
      if (!reference?.matches?.('li[id^="cite_note-"]')) return selectors.join(', ');

      for (const backlink of reference.querySelectorAll('.mw-cite-backlink a[href^="#cite_ref-"]')) {
        const targetId = String(backlink.getAttribute('href') || '').replace(/^#/, '');
        if (!SAFE_REFERENCE_ID.test(targetId)) continue;
        const escaped = typeof CSS?.escape === 'function' ? CSS.escape(targetId) : targetId;
        selectors.push(`#${escaped} a`, `sup#${escaped} a`);
      }
      return Array.from(new Set(selectors.filter(Boolean))).join(', ');
    };
  }

  function repairPubmedPresentation(root = document) {
    if (!isPubmedArticle) return;
    for (const outer of root.querySelectorAll?.(
      '#top-references-list .references-list > li.notandia-integrity-reference'
    ) || []) {
      const content = outer.querySelector(':scope > ol.references-and-notes-list > li');
      if (!content) continue;
      content.classList.add('notandia-pubmed-integrity-content');
      const status = outer.getAttribute('data-notandia-integrity-status');
      if (status) content.setAttribute('data-notandia-integrity-status', status);
      const chip = outer.querySelector(':scope > .notandia-integrity-chip');
      if (chip && chip.parentElement !== content) content.appendChild(chip);
    }

    for (const content of root.querySelectorAll?.('.notandia-pubmed-integrity-content') || []) {
      const outer = content.closest('#top-references-list .references-list > li');
      if (!outer?.classList.contains('notandia-integrity-reference')) {
        content.classList.remove('notandia-pubmed-integrity-content');
        content.removeAttribute('data-notandia-integrity-status');
      }
    }
  }

  function nodeTouchesRelevantContext(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches(ownNodeSelector) || node.closest(ownNodeSelector)) return false;
    if (isWikipediaArticle) {
      return node.matches('li[id^="cite_note-"],a[href*="doi.org"]') ||
        Boolean(node.querySelector('li[id^="cite_note-"],a[href*="doi.org"]'));
    }
    if (isPubmedArticle) {
      return node.matches('.notandia-integrity-reference,.notandia-integrity-chip') ||
        Boolean(node.querySelector('.notandia-integrity-reference,.notandia-integrity-chip'));
    }
    return false;
  }

  patchWikipediaInlineSelectors();
  repairPubmedPresentation();

  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return false;
      if (message?.type === 'forceIntegrityRescan' && isWikipediaArticle) {
        lastFingerprint = '';
        scheduleWikipediaScan(120);
        sendResponse({ scheduled: true });
        return false;
      }
      if (message?.type === 'integrityReportUpdated' && isPubmedArticle) {
        setTimeout(() => repairPubmedPresentation(), 25);
      }
      return false;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.integrityLookupsEnabled && isWikipediaArticle) {
        lastFingerprint = '';
        scheduleWikipediaScan(0);
      }
    });
  } catch (error) {
    if (runtime.isInvalidationError(error)) return stop();
    throw error;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleWikipediaScan();
      repairPubmedPresentation();
    }, { once: true });
  } else {
    scheduleWikipediaScan();
    repairPubmedPresentation();
  }

  observer = new MutationObserver(mutations => {
    if (!runtime.isAvailable()) return stop();
    let shouldScanWikipedia = false;
    let shouldRepairPubmed = false;
    for (const mutation of mutations) {
      for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
        if (!nodeTouchesRelevantContext(node)) continue;
        if (isWikipediaArticle) shouldScanWikipedia = true;
        if (isPubmedArticle) shouldRepairPubmed = true;
      }
    }
    if (shouldScanWikipedia) scheduleWikipediaScan(350);
    if (shouldRepairPubmed) setTimeout(() => repairPubmedPresentation(), 25);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.NotandiaSiteReferenceCompatibility = Object.freeze({
    normalizeDoi,
    wikipediaReferenceNumber
  });
})();
