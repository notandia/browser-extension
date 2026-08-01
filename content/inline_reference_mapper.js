'use strict';

;(function initializeInlineReferenceMapper() {
  if (window.notandiaInlineReferenceMapperInjected) return;
  window.notandiaInlineReferenceMapperInjected = true;

  const utils = window.MDPIFilterUtils;
  const baseGenerator = utils?.generateInlineFootnoteSelectors;
  if (!utils || typeof baseGenerator !== 'function') return;

  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const SYNTHETIC_REFERENCE_ID = /^(?:notandia-reference|notandia-ncbi-reference|integrity-ref|mdpi-ref)-\d+$/i;

  function normalizeReferenceId(value) {
    const normalized = String(value || '').trim();
    return SAFE_REFERENCE_ID.test(normalized) ? normalized : null;
  }

  function positiveNumber(value) {
    const number = Number(String(value || '').match(/0*(\d{1,5})/)?.[1]);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function referenceElementForId(referenceId) {
    for (const element of document.querySelectorAll('[data-mdpi-filter-ref-id]')) {
      if (element.getAttribute('data-mdpi-filter-ref-id') === referenceId) return element;
    }
    const byId = document.getElementById(referenceId);
    return byId?.closest?.('li,[role="listitem"],div.reference,div.ref-cit-blk') || byId || null;
  }

  function structuredAncestorIds(element) {
    return [
      element.closest?.('.citations[id]')?.id,
      element.closest?.('[role="listitem"]')?.querySelector?.('.citations[id]')?.id,
      element.closest?.('[role="listitem"][id]')?.id,
      element.closest?.('li[id]')?.id
    ];
  }

  function actualTargetId(referenceId) {
    const normalizedFallback = normalizeReferenceId(referenceId);
    if (!normalizedFallback) return null;
    const element = referenceElementForId(normalizedFallback);
    if (!element) return normalizedFallback;

    const candidates = [
      element.querySelector?.('p.c-article-references__text[id]')?.id,
      element.querySelector?.('a[name][id]')?.id,
      element.querySelector?.('span.label a.anchor[id^="ref-id-b"]')?.id,
      element.querySelector?.('span.reference[id^="rf"]')?.id,
      element.querySelector?.('a.rev-xref-ref[id^="ref-"]')?.id,
      ...structuredAncestorIds(element),
      element.id,
      element.getAttribute?.('content-id'),
      element.getAttribute?.('data-legacy-id'),
      element.getAttribute?.('data-bib-id'),
      element.getAttribute?.('data-reference-id')
    ];
    for (const candidate of candidates) {
      const normalized = normalizeReferenceId(candidate);
      if (normalized && !SYNTHETIC_REFERENCE_ID.test(normalized)) return normalized;
    }

    for (const value of [
      element.getAttribute?.('data-counter'),
      element.getAttribute?.('data-content'),
      element.getAttribute?.('data-number'),
      element.getAttribute?.('data-reference-number'),
      String(element.getAttribute?.('aria-label') || '').match(/(?:reference|citation)\s*(\d+)/i)?.[1]
    ]) {
      const number = positiveNumber(value);
      if (number) return String(number);
    }

    return SYNTHETIC_REFERENCE_ID.test(normalizedFallback) ? null : normalizedFallback;
  }

  utils.resolveInlineReferenceTarget = actualTargetId;
  utils.generateInlineFootnoteSelectors = function generateMappedInlineFootnoteSelectors(referenceId) {
    const targetId = actualTargetId(referenceId) || normalizeReferenceId(referenceId);
    return targetId ? baseGenerator(targetId) : '';
  };
})();