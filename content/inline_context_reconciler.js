'use strict';

;(function initializeInlineContextReconciler() {
  if (window.notandiaInlineContextReconcilerInjected) return;
  window.notandiaInlineContextReconcilerInjected = true;

  const api = window.NotandiaPublisherProfiles;
  const generator = window.MDPIFilterUtils?.generateInlineFootnoteSelectors;
  if (!api || typeof generator !== 'function') return;

  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const STATUS_COLORS = Object.freeze({
    retracted: '#B42318',
    'expression-of-concern': '#B54708',
    withdrawn: '#475467',
    'duplicate-publication': '#6941C6',
    corrected: '#175CD3',
    reinstated: '#067647'
  });
  let settings = api.defaultSettings();
  let timer = null;
  let observer = null;

  function normalizeReferenceId(value) {
    const normalized = String(value || '').trim();
    return SAFE_REFERENCE_ID.test(normalized) ? normalized : null;
  }

  function positiveNumber(value) {
    const number = Number(String(value || '').match(/0*(\d{1,5})/)?.[1]);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function referenceTargetId(reference) {
    const candidates = [
      reference.querySelector?.('p.c-article-references__text[id]')?.id,
      reference.querySelector?.('a[name][id]')?.id,
      reference.querySelector?.('span.label a.anchor[id^="ref-id-b"]')?.id,
      reference.querySelector?.('span.reference[id^="rf"]')?.id,
      reference.querySelector?.('a.rev-xref-ref[id^="ref-"]')?.id,
      reference.id,
      reference.getAttribute?.('content-id'),
      reference.getAttribute?.('data-legacy-id'),
      reference.getAttribute?.('data-bib-id'),
      reference.getAttribute?.('data-reference-id')
    ];
    for (const candidate of candidates) {
      const normalized = normalizeReferenceId(candidate);
      if (normalized) return normalized;
    }

    const number = positiveNumber(
      reference.getAttribute?.('data-counter') ||
      reference.getAttribute?.('data-content') ||
      reference.getAttribute?.('data-number')
    );
    if (number) return String(number);

    const fallback = normalizeReferenceId(reference.getAttribute?.('data-mdpi-filter-ref-id'));
    if (fallback && !/^(?:notandia-reference|integrity-ref|mdpi-ref)-\d+$/i.test(fallback)) return fallback;
    return null;
  }

  function anchorsForReference(reference) {
    const targetId = referenceTargetId(reference);
    if (!targetId) return [];
    const selectors = generator(targetId);
    if (!selectors) return [];
    try {
      return Array.from(document.querySelectorAll(selectors))
        .map(matched => matched.tagName?.toLowerCase() === 'a' ? matched : matched.querySelector?.('a'))
        .filter(anchor => anchor instanceof HTMLAnchorElement);
    } catch {
      return [];
    }
  }

  function clearInlinePresentation() {
    for (const anchor of document.querySelectorAll('.notandia-publisher-citation')) {
      anchor.classList.remove('notandia-publisher-citation');
      anchor.removeAttribute('data-notandia-publisher-action');
      anchor.removeAttribute('data-notandia-publisher-profile');
      anchor.style.removeProperty('--notandia-profile-color');
    }
    for (const anchor of document.querySelectorAll('.notandia-integrity-citation')) {
      anchor.classList.remove('notandia-integrity-citation');
      anchor.removeAttribute('data-notandia-integrity-status');
      anchor.style.removeProperty('--notandia-integrity-color');
    }
  }

  function applyPublisherCitation(reference, profiles) {
    const profileId = String(reference.getAttribute('data-notandia-profile-style') || '').trim();
    const profile = profiles.get(profileId);
    if (!profile || !['highlight', 'dim', 'hide'].includes(profile.action)) return;
    for (const anchor of anchorsForReference(reference)) {
      anchor.classList.add('notandia-publisher-citation');
      anchor.setAttribute('data-notandia-publisher-action', profile.action);
      anchor.setAttribute('data-notandia-publisher-profile', profile.id);
      anchor.style.setProperty('--notandia-profile-color', profile.color);
    }
  }

  function applyIntegrityCitation(reference) {
    const status = String(reference.getAttribute('data-notandia-integrity-status') || '').trim();
    if (!status) return;
    const inlineColor = reference.style.getPropertyValue('--notandia-integrity-color').trim();
    const color = /^#[0-9a-f]{6}$/i.test(inlineColor) ? inlineColor : (STATUS_COLORS[status] || '#B42318');
    for (const anchor of anchorsForReference(reference)) {
      anchor.classList.add('notandia-integrity-citation');
      anchor.setAttribute('data-notandia-integrity-status', status);
      anchor.style.setProperty('--notandia-integrity-color', color);
    }
  }

  function reconcile() {
    clearInlinePresentation();
    const profiles = api.profileMap(settings);
    for (const reference of document.querySelectorAll('[data-notandia-profile-style]')) {
      applyPublisherCitation(reference, profiles);
    }
    for (const reference of document.querySelectorAll('.notandia-integrity-reference[data-notandia-integrity-status]')) {
      applyIntegrityCitation(reference);
    }
  }

  function schedule(delay = 650) {
    clearTimeout(timer);
    timer = setTimeout(reconcile, delay);
  }

  function loadSettings() {
    chrome.storage.sync.get({
      publisherWatchlist: null,
      mode: 'highlight',
      highlightPotentialMdpiSites: true,
      potentialMdpiHighlightColor: '#E2211C'
    }, stored => {
      if (chrome.runtime.lastError) return;
      settings = api.migrateLegacySettings(stored);
      schedule(0);
    });
  }

  chrome.runtime.onMessage.addListener(message => {
    if (['publisherContextUpdated', 'integrityProgressUpdated', 'integrityReportUpdated'].includes(message?.type)) schedule(80);
    return false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.publisherWatchlist || changes.mode || changes.highlightPotentialMdpiSites || changes.potentialMdpiHighlightColor)) {
      loadSettings();
    }
  });

  observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) schedule(750);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  loadSettings();
  setTimeout(() => schedule(0), 1600);
})();