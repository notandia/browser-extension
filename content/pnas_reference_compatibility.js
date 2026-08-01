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

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest('[hidden]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }

  function collapseControlFor(reference) {
    const hiddenAncestor = reference.closest('[hidden]');
    const controlledContainer = hiddenAncestor?.closest('[id]') ||
      reference.closest('#bibliography-collapsible-text,[id][data-method="height"]');
    const containerId = normalizeReferenceId(controlledContainer?.id);
    if (!containerId) return null;

    for (const control of document.querySelectorAll('button[aria-controls],[role="button"][aria-controls]')) {
      const controls = String(control.getAttribute('aria-controls') || '').trim().split(/\s+/);
      if (controls.includes(containerId)) return control;
    }
    return null;
  }

  function animateReference(reference, color) {
    const safeColor = /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : '#48627A';
    reference.style.setProperty('--notandia-scroll-color', safeColor);
    reference.classList.remove('notandia-scroll-target');
    void reference.offsetWidth;
    reference.classList.add('notandia-scroll-target');
    setTimeout(() => reference.classList.remove('notandia-scroll-target'), 1800);
  }

  function scrollAndAnimate(reference, color) {
    reference.scrollIntoView({ behavior: 'smooth', block: 'center' });
    requestAnimationFrame(() => animateReference(reference, color));
  }

  function waitForVisibleReference(referenceId, timeout = 1800) {
    return new Promise(resolve => {
      const startedAt = Date.now();
      const check = () => {
        const reference = referenceElementForId(referenceId);
        if (reference && isVisible(reference)) {
          resolve(reference);
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          resolve(reference || null);
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  async function revealAndAnimate(message) {
    const reference = referenceElementForId(message.refId);
    if (!reference || isVisible(reference)) return;

    const details = reference.closest('details:not([open])');
    if (details instanceof HTMLDetailsElement) details.open = true;

    const control = collapseControlFor(reference);
    if (control instanceof HTMLElement) control.click();

    const revealed = await waitForVisibleReference(message.refId);
    if (revealed) scrollAndAnimate(revealed, message.color);
  }

  patchInlineSelectors();

  try {
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (sender.id !== chrome.runtime.id || message?.type !== 'scrollToRefOnPage') return false;
      if (!normalizeReferenceId(message.refId)) return false;
      void revealAndAnimate(message);
      return false;
    });
  } catch (error) {
    if (window.NotandiaRuntime?.isInvalidationError?.(error)) return;
    throw error;
  }

  window.NotandiaPnasReferenceCompatibility = Object.freeze({
    pnasTargetId
  });
})();
