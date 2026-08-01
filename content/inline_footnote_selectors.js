'use strict';

(() => {
  window.MDPIFilterUtils ||= {};

  const FALLBACK_SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;

  function normalizeReferenceId(value) {
    const sharedNormalizer = window.MDPIFilterReferenceIdExtractor?.normalizeReferenceId;
    if (typeof sharedNormalizer === 'function') return sharedNormalizer(value);
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return FALLBACK_SAFE_REFERENCE_ID.test(normalized) ? normalized : null;
  }

  function generateInlineFootnoteSelectors(listItemDomId) {
    const refId = normalizeReferenceId(listItemDomId);
    if (!refId) return '';

    const withoutCiteNote = refId.replace(/^cite_note-/i, '');
    const withoutRef = refId.replace(/^ref-/i, '');
    const withoutReference = refId.replace(/^reference-/i, '');
    const withoutB = refId.replace(/^B/i, '');
    const withoutCR = refId.replace(/^CR/i, '');
    const withoutEn = refId.replace(/^en/i, '');
    const withoutScienceDirectPrefix = refId.replace(/^ref-id-/i, '');

    const commonSelectors = [
      `a[href="#${refId}"]`,
      `a[href$="#${refId}"]`,
      `a[href="#cite_note-${withoutCiteNote}"]`,
      `a[href="#ref-${withoutRef}"]`,
      `a[href="#reference-${withoutReference}"]`,
      `a[href="#B${withoutB}"]`,
      `a[href="#CR${withoutCR}"]`,
      `a[href="#en${withoutEn}"]`,
      `a[data-rid="${refId}"]`,
      `a[data-bris-rid="${refId}"]`,
      `a[data-xml-rid="${refId}"]`,
      `a[rid="${refId}"]`,
      `a[data-test="citation-ref"][href$="#ref-${refId}"]`,
      `a[id="body-ref-${refId}"]`,
      `a[id^="core-${refId}-"]`,
      `a[aria-controls="${refId}"]`,
      `a[data-db-target-for="${refId}"]`,
      `a.link-ref.xref-bibr[reveal-id="${refId}"]`,
      `a.link-ref.xref-bibr[data-open="${refId}"]`,
      `a[href="#${withoutScienceDirectPrefix}"]`,
      `a[href="#core-collateral-${refId}"]`,
      `a[role="doc-biblioref"][href="#${refId}"]`,
      `a[role="doc-biblioref"][data-xml-rid="${refId}"]`,
      `a[role="doc-biblioref"][href="#core-collateral-${refId}"]`,
      `a.ejp-citation-link[data-reference-links="${refId}"]`
    ];

    const supSelectors = [
      `sup a[href="#${refId}"]`,
      `sup a[href$="#${refId}"]`,
      `sup a[href="#cite_note-${withoutCiteNote}"]`,
      `sup a[href="#ref-${withoutRef}"]`,
      `sup a[href="#reference-${withoutReference}"]`,
      `sup a[href="#B${withoutB}"]`,
      `sup a[href="#CR${withoutCR}"]`,
      `sup a[href="#en${withoutEn}"]`,
      `sup[id="ref${refId}"]`,
      `sup a[data-rid="${refId}"]`,
      `sup a[data-bris-rid="${refId}"]`,
      `sup a[data-xml-rid="${refId}"]`,
      `sup a[rid="${refId}"]`,
      `sup a[data-test="citation-ref"][href$="#ref-${refId}"]`,
      `sup a[id="body-ref-${refId}"]`,
      `sup a[id^="core-${refId}-"]`,
      `sup a[aria-controls="${refId}"]`,
      `sup a[data-db-target-for="${refId}"]`,
      `sup a.link-ref.xref-bibr[reveal-id="${refId}"]`,
      `sup a.link-ref.xref-bibr[data-open="${refId}"]`,
      `sup a[href="#${withoutScienceDirectPrefix}"]`,
      `sup a[href="#core-collateral-${refId}"]`,
      `sup a[role="doc-biblioref"][href="#${refId}"]`,
      `sup a[role="doc-biblioref"][data-xml-rid="${refId}"]`,
      `sup a[role="doc-biblioref"][href="#core-collateral-${refId}"]`,
      `sup a.ejp-citation-link[data-reference-links="${refId}"]`
    ];

    if (refId.startsWith('ref-id-b')) {
      const base = refId.slice('ref-id-'.length);
      commonSelectors.push(
        `a[href="#${base}"]`,
        `a.anchor[href="#${base}"]`,
        `a.anchor-primary[href="#${base}"]`
      );
      supSelectors.push(
        `sup a[href="#${base}"]`,
        `sup a.anchor[href="#${base}"]`,
        `sup a.anchor-primary[href="#${base}"]`
      );
      if (base.startsWith('b') && base.length > 1) {
        const shorter = base.slice(1);
        commonSelectors.push(
          `a[href="#${shorter}"]`,
          `a.anchor[href="#${shorter}"]`,
          `a.anchor-primary[href="#${shorter}"]`
        );
        supSelectors.push(
          `sup a[href="#${shorter}"]`,
          `sup a.anchor[href="#${shorter}"]`,
          `sup a.anchor-primary[href="#${shorter}"]`
        );
      }
    }

    const numeric = refId.replace(/\D/g, '');
    if (numeric) {
      commonSelectors.push(
        `a[href="#${numeric}"]`,
        `a[href$="#${numeric}"]`,
        `a[href="#cite_note-${numeric}"]`,
        `a[href="#ref-${numeric}"]`,
        `a[href="#reference-${numeric}"]`,
        `a[href="#B${numeric}"]`,
        `a[href="#CR${numeric}"]`,
        `a[href="#en${numeric}"]`,
        `a[data-test="citation-ref"][href$="#ref-CR${numeric}"]`
      );
      supSelectors.push(
        `sup a[href="#${numeric}"]`,
        `sup a[href$="#${numeric}"]`,
        `sup a[href="#cite_note-${numeric}"]`,
        `sup a[href="#ref-${numeric}"]`,
        `sup a[href="#reference-${numeric}"]`,
        `sup a[href="#B${numeric}"]`,
        `sup a[href="#CR${numeric}"]`,
        `sup a[href="#en${numeric}"]`,
        `sup[id="ref-${numeric}"]`,
        `sup a[data-test="citation-ref"][href$="#ref-CR${numeric}"]`
      );
    }

    const listItem = document.getElementById(refId);
    const wileyBibId = normalizeReferenceId(listItem?.getAttribute('data-bib-id'));
    if (wileyBibId && wileyBibId !== refId) {
      commonSelectors.push(`a[href="#${wileyBibId}"]`);
      supSelectors.push(`sup a[href="#${wileyBibId}"]`);
    } else if (!listItem) {
      for (const candidate of document.querySelectorAll('[data-bib-id]')) {
        if (candidate.getAttribute('data-bib-id') === refId) {
          commonSelectors.push(`a[href="#${refId}"]`);
          supSelectors.push(`sup a[href="#${refId}"]`);
          break;
        }
      }
    }

    return [...new Set([...commonSelectors, ...supSelectors])].join(', ');
  }

  window.MDPIFilterUtils.generateInlineFootnoteSelectors = generateInlineFootnoteSelectors;
})();