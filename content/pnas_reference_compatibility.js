'use strict';

;(function initializePnasReferenceCompatibility() {
  if (window.notandiaPnasReferenceCompatibilityInjected) return;
  window.notandiaPnasReferenceCompatibilityInjected = true;

  const hostname = location.hostname.toLowerCase().replace(/^www\./, '');
  const isPnasArticle = (hostname === 'pnas.org' || hostname.endsWith('.pnas.org')) && /^\/doi\//.test(location.pathname);
  if (!isPnasArticle) return;

  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
  const SYNTHETIC_REFERENCE_ID = /^(?:notandia-reference|notandia-ncbi-reference|integrity-ref|mdpi-ref)-\d+$/i;

  function normalizeReferenceId(value) {
    const normalized = String(value || '').trim();
    return SAFE_REFERENCE_ID.test(normalized) ? normalized : null;
  }

  function referenceElementForId(referenceId) {
    const normalized = normalizeReferenceId(referenceId);
    if (!normalized) return null;
    for (const element of document.querySelectorAll('[data-mdpi-filter-ref-id]')) {
      if (element.getAttribute('data-mdpi-filter-ref-id') === normalized) return element;
    }
    const byId = document.getElementById(normalized);
    return byId?.querySelector?.('.citation') || byId || null;
  }

  function pnasTargetId(referenceId) {
    const normalized = normalizeReferenceId(referenceId);
    if (!normalized) return null;
    const reference = referenceElementForId(normalized);
    const citations = reference?.closest?.('.citations[id]') ||
      reference?.querySelector?.('.citations[id]') ||
      reference?.closest?.('[role="listitem"]')?.querySelector?.('.citations[id]');
    const target = normalizeReferenceId(citations?.id);
    if (target) return target;
    return SYNTHETIC_REFERENCE_ID.test(normalized) ? null : normalized;
  }

  function patchInlineSelectors() {
    const utils = window.MDPIFilterUtils;
    const baseGenerator = utils?.generateInlineFootnoteSelectors;
    if (!utils || typeof baseGenerator !== 'function' || utils.notandiaPnasSelectorsPatched) return;
    const baseResolver = utils.resolveInlineReferenceTarget;
    utils.notandiaPnasSelectorsPatched = true;

    utils.resolveInlineReferenceTarget = function resolvePnasInlineReferenceTarget(referenceId) {
      return pnasTargetId(referenceId) ||
        (typeof baseResolver === 'function' ? baseResolver(referenceId) : null) ||
        normalizeReferenceId(referenceId);
    };

    utils.generateInlineFootnoteSelectors = function generatePnasAwareSelectors(referenceId) {
      const targetId = pnasTargetId(referenceId) || normalizeReferenceId(referenceId);
      const selectors = [baseGenerator(referenceId)];
      if (targetId && targetId !== referenceId) selectors.push(baseGenerator(targetId));
      if (targetId) {
        selectors.push(
          `a[data-xml-rid="${targetId}"]`,
          `a[role="doc-biblioref"][data-xml-rid="${targetId}"]`,
          `a[role="doc-biblioref"][href="#core-collateral-${targetId}"]`,
          `a[href="#core-collateral-${targetId}"]`,
          `a[id^="core-${targetId}-"]`
        );
      }
      return Array.from(new Set(selectors.filter(Boolean))).join(', ');
    };
  }

  patchInlineSelectors();

  window.NotandiaPnasReferenceCompatibility = Object.freeze({
    pnasTargetId
  });
})();
