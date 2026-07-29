'use strict';

;(function initializeReferenceCounterNormalizer() {
  if (window.notandiaReferenceCounterNormalizerInjected) return;
  window.notandiaReferenceCounterNormalizerInjected = true;

  function configuredSelector() {
    const selector = window.MDPIFilterReferenceSelectors;
    return typeof selector === 'string' && selector.trim() ? selector : '';
  }

  function normalizeElement(element) {
    if (!(element instanceof Element) || element.hasAttribute('data-counter')) return;
    const visible = String(element.getAttribute('data-content') || '').match(/^\s*(\d{1,5})\s*[.)]?\s*$/)?.[1];
    if (visible) element.setAttribute('data-counter', `${visible}.`);
  }

  function normalizeReferences(root = document) {
    const selector = configuredSelector();
    if (!selector) return;
    try {
      if (root instanceof Element && root.matches(selector)) normalizeElement(root);
      for (const element of root.querySelectorAll?.(selector) || []) normalizeElement(element);
    } catch {
      // A site-specific selector must not block the remaining content scripts.
    }
  }

  normalizeReferences();
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) normalizeReferences(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
