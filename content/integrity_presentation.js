'use strict';

;(function initializeIntegrityPresentation() {
  if (window.notandiaIntegrityPresentationInjected) return;
  window.notandiaIntegrityPresentationInjected = true;

  const runtime = window.NotandiaRuntime;
  if (!runtime?.isAvailable()) return;

  const FALLBACK_STATUSES = {
    retracted: { label: 'Retracted', icon: '×', color: '#B42318' },
    'expression-of-concern': { label: 'Expression of concern', icon: '!', color: '#B54708' },
    withdrawn: { label: 'Withdrawn or removed', icon: '–', color: '#475467' },
    'duplicate-publication': { label: 'Duplicate publication', icon: '≡', color: '#6941C6' },
    corrected: { label: 'Corrected', icon: '✎', color: '#175CD3' },
    reinstated: { label: 'Reinstated', icon: '↩', color: '#067647' }
  };
  const SAFE_STATUS = /^[a-z0-9-]{1,64}$/;
  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  let pollTimer = null;
  let observer = null;
  let lastFingerprint = '';
  let firstMissingReportAt = 0;
  let lastRecoveryRequestAt = 0;
  let applyingPresentation = false;

  function stop() {
    clearTimeout(pollTimer);
    pollTimer = null;
    observer?.disconnect();
    observer = null;
  }

  function normalizeDoi(value) {
    if (typeof value !== 'string') return null;
    let normalized = value.trim();
    try { normalized = decodeURIComponent(normalized); } catch { /* Keep malformed input unchanged. */ }
    normalized = normalized
      .replace(/^doi\s*:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
    return /^10\.\d{4,9}\/[\w.()/:;+-]+$/i.test(normalized) ? normalized : null;
  }

  function currentArticleDoi() {
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
    const source = `${document.querySelector('link[rel="canonical"]')?.href || ''} ${document.location.href}`;
    return normalizeDoi(source.match(/10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/i)?.[0] || '');
  }

  function rgba(hex, alpha) {
    const value = /^#[0-9a-f]{6}$/i.test(String(hex || '')) ? String(hex).slice(1) : 'B42318';
    const number = Number.parseInt(value, 16);
    return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
  }

  function schedule(delay = 1000) {
    if (!runtime.isAvailable()) return stop();
    clearTimeout(pollTimer);
    pollTimer = setTimeout(requestReport, delay);
  }

  function contextElements(record) {
    const found = new Set();
    const referenceId = String(record?.id || '');
    const doi = normalizeDoi(record?.doi || '');

    if (SAFE_REFERENCE_ID.test(referenceId)) {
      for (const attribute of ['data-notandia-ref-id', 'data-mdpi-filter-ref-id']) {
        for (const element of document.querySelectorAll(`[${attribute}]`)) {
          if (element.getAttribute(attribute) === referenceId) found.add(element);
        }
      }
      const byId = document.getElementById(referenceId);
      if (byId) found.add(byId.closest('li') || byId);
    }

    // Multiple search results may represent the same scholarly work through different
    // URLs (publisher, PubMed, Europe PMC, etc.). The shared scanner writes the
    // resolved DOI to every equivalent result so one formal lookup can style them all.
    if (doi) {
      for (const element of document.querySelectorAll('[data-notandia-doi]')) {
        if (normalizeDoi(element.getAttribute('data-notandia-doi') || '') === doi) found.add(element);
      }
    }
    return Array.from(found);
  }

  function clearPresentation() {
    for (const element of document.querySelectorAll('.notandia-integrity-reference[data-notandia-integrity-status]')) {
      element.classList.remove('notandia-integrity-reference');
      element.removeAttribute('data-notandia-integrity-status');
      element.style.removeProperty('--notandia-integrity-color');
      element.style.removeProperty('--notandia-integrity-tint');
    }
    document.querySelectorAll('.notandia-integrity-chip').forEach(element => element.remove());
    for (const anchor of document.querySelectorAll('.notandia-integrity-citation')) {
      anchor.classList.remove('notandia-integrity-citation');
      anchor.removeAttribute('data-notandia-integrity-status');
      anchor.style.removeProperty('--notandia-integrity-color');
    }
  }

  function presentationIsCurrent(records) {
    for (const record of records) {
      const elements = contextElements(record);
      if (!elements.length) continue;
      for (const element of elements) {
        if (!element.classList.contains('notandia-integrity-reference')) return false;
        if (element.getAttribute('data-notandia-integrity-status') !== record.primaryStatus) return false;
      }
    }
    return true;
  }

  function styleInlineCitations(record, definition) {
    const utils = window.NotandiaUtils || window.MDPIFilterUtils;
    const generator = utils?.generateInlineFootnoteSelectors;
    if (typeof generator !== 'function') return;
    const selectors = generator(record.id);
    if (!selectors) return;
    try {
      for (const matched of document.querySelectorAll(selectors)) {
        const anchor = matched.tagName?.toLowerCase() === 'a' ? matched : matched.querySelector?.('a');
        if (!(anchor instanceof HTMLAnchorElement)) continue;
        anchor.classList.add('notandia-integrity-citation');
        anchor.setAttribute('data-notandia-integrity-status', record.primaryStatus);
        anchor.style.setProperty('--notandia-integrity-color', definition.color);
      }
    } catch {
      // A site-specific selector must not break the rest of the page presentation.
    }
  }

  function ensureChip(element, record, definition) {
    const selector = `.notandia-integrity-chip[data-notandia-integrity-chip="${record.id}"]`;
    if (element.querySelector(selector)) return;
    const chip = document.createElement('span');
    chip.className = 'notandia-integrity-chip';
    chip.setAttribute('data-notandia-integrity-chip', record.id);
    chip.style.setProperty('--notandia-integrity-color', definition.color);
    chip.textContent = `${definition.icon || '•'} ${definition.label || record.primaryStatus}`;
    chip.title = `Formal post-publication signal for ${record.doi || 'this work'}`;
    element.appendChild(chip);
  }

  function applyReport(report, statuses) {
    const affected = (report?.records || []).filter(record =>
      record?.kind !== 'current-article' &&
      SAFE_REFERENCE_ID.test(String(record.id || '')) &&
      SAFE_STATUS.test(String(record.primaryStatus || ''))
    );
    const fingerprint = JSON.stringify([
      report?.updatedAt || '',
      affected.map(record => [record.id, record.primaryStatus, record.doi])
    ]);
    if (fingerprint === lastFingerprint && presentationIsCurrent(affected)) {
      for (const record of affected) {
        const definition = statuses?.[record.primaryStatus] || FALLBACK_STATUSES[record.primaryStatus];
        if (definition) styleInlineCitations(record, definition);
      }
      return;
    }
    lastFingerprint = fingerprint;
    applyingPresentation = true;
    clearPresentation();

    for (const record of affected) {
      const definition = statuses?.[record.primaryStatus] || FALLBACK_STATUSES[record.primaryStatus];
      if (!definition) continue;
      for (const element of contextElements(record)) {
        element.classList.add('notandia-integrity-reference');
        element.setAttribute('data-notandia-integrity-status', record.primaryStatus);
        element.style.setProperty('--notandia-integrity-color', definition.color);
        element.style.setProperty('--notandia-integrity-tint', rgba(definition.color, 0.08));
        ensureChip(element, record, definition);
      }
      styleInlineCitations(record, definition);
    }
    setTimeout(() => { applyingPresentation = false; }, 0);
  }

  function requestRecovery() {
    const now = Date.now();
    if (!firstMissingReportAt) firstMissingReportAt = now;
    if (now - firstMissingReportAt < 1200 || now - lastRecoveryRequestAt < 5000) return;
    lastRecoveryRequestAt = now;
    if (!runtime.sendMessage({ type: 'integrityPresentationNeedsRescan' })) stop();
  }

  function requestReport() {
    if (!runtime.isAvailable()) return stop();
    if (document.hidden) return schedule(1500);
    const sent = runtime.sendMessage({ type: 'getIntegrityReport' }, (response, error) => {
      if (error) {
        if (!runtime.isAvailable()) return stop();
        return schedule(1500);
      }
      const report = response?.report || null;
      if (!report) {
        requestRecovery();
        return schedule(800);
      }
      firstMissingReportAt = 0;

      const pageDoi = currentArticleDoi();
      const reportPageDoi = (report.records || []).find(record => record.kind === 'current-article')?.doi || null;
      if (pageDoi && reportPageDoi && pageDoi !== reportPageDoi) return schedule(1200);

      if (report.state === 'ready') applyReport(report, response?.statuses || FALLBACK_STATUSES);
      schedule(report.state === 'loading' ? 750 : 5000);
    });
    if (!sent) stop();
  }

  try {
    chrome.runtime.onMessage.addListener(message => {
      if (message?.type === 'integrityReportUpdated') schedule(50);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes.integrityLookupsEnabled) return;
      if (changes.integrityLookupsEnabled.newValue !== true) {
        lastFingerprint = '';
        firstMissingReportAt = 0;
        clearPresentation();
      } else schedule(0);
    });
  } catch (error) {
    if (runtime.isInvalidationError(error)) return stop();
    throw error;
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule(0);
  });
  observer = new MutationObserver(() => {
    if (!runtime.isAvailable()) return stop();
    if (!applyingPresentation) schedule(300);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule(0), { once: true });
  else schedule(0);
})();