'use strict';

;(function initializeIntegrityPresentation() {
  if (window.notandiaIntegrityPresentationInjected) return;
  window.notandiaIntegrityPresentationInjected = true;

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
  let lastFingerprint = '';
  let firstMissingReportAt = 0;
  let lastRecoveryRequestAt = 0;
  let applyingPresentation = false;

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
    clearTimeout(pollTimer);
    pollTimer = setTimeout(requestReport, delay);
  }

  function findReferenceElement(referenceId) {
    if (!SAFE_REFERENCE_ID.test(String(referenceId || ''))) return null;
    for (const element of document.querySelectorAll('[data-mdpi-filter-ref-id]')) {
      if (element.getAttribute('data-mdpi-filter-ref-id') === referenceId) return element;
    }
    const byId = document.getElementById(referenceId);
    return byId?.closest('li') || byId || null;
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
      const reference = findReferenceElement(record.id);
      if (!reference) continue;
      if (!reference.classList.contains('notandia-integrity-reference')) return false;
      if (reference.getAttribute('data-notandia-integrity-status') !== record.primaryStatus) return false;
      if (!reference.querySelector(`.notandia-integrity-chip[data-notandia-integrity-chip="${record.id}"]`)) return false;
    }
    return true;
  }

  function styleInlineCitations(record, definition) {
    const generator = window.MDPIFilterUtils?.generateInlineFootnoteSelectors;
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

  function applyReport(report, statuses) {
    const affected = (report?.records || []).filter(record =>
      record?.kind === 'reference' &&
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
      const reference = findReferenceElement(record.id);
      if (reference) {
        reference.classList.add('notandia-integrity-reference');
        reference.setAttribute('data-notandia-integrity-status', record.primaryStatus);
        reference.style.setProperty('--notandia-integrity-color', definition.color);
        reference.style.setProperty('--notandia-integrity-tint', rgba(definition.color, 0.08));
        const chip = document.createElement('span');
        chip.className = 'notandia-integrity-chip';
        chip.setAttribute('data-notandia-integrity-chip', record.id);
        chip.style.setProperty('--notandia-integrity-color', definition.color);
        chip.textContent = `${definition.icon || '•'} ${definition.label || record.primaryStatus}`;
        chip.title = `Formal post-publication signal for ${record.doi || 'this reference'}`;
        reference.appendChild(chip);
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
    chrome.runtime.sendMessage({ type: 'integrityPresentationNeedsRescan' }, () => void chrome.runtime.lastError);
  }

  function requestReport() {
    if (document.hidden) return schedule(1500);
    chrome.runtime.sendMessage({ type: 'getIntegrityReport' }, response => {
      if (chrome.runtime.lastError) return schedule(1500);
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
  }

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

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule(0);
  });
  const observer = new MutationObserver(() => {
    if (!applyingPresentation) schedule(300);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule(0), { once: true });
  else schedule(0);
})();
