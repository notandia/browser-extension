'use strict';

;(function initializeReferenceCounterNormalizer() {
  if (window.notandiaReferenceCounterNormalizerInjected) return;
  window.notandiaReferenceCounterNormalizerInjected = true;

  function configuredSelector() {
    const selector = window.MDPIFilterReferenceSelectors;
    return typeof selector === 'string' && selector.trim() ? selector : '';
  }

  function positiveNumber(value) {
    const match = String(value || '').match(/^\s*0*(\d{1,5})\s*[.)]?\s*$/);
    const number = Number(match?.[1]);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function numberFromIdentifier(element) {
    const identifier = String(
      element.dataset?.mdpiFilterRefId ||
      element.id ||
      element.getAttribute?.('data-bib-id') ||
      element.getAttribute?.('data-reference-id') ||
      ''
    );
    const patterns = [
      /^B0*(\d+)(?:[-_:]|$)/i,
      /^(?:ref-CR|ref|reference|bib|cit|r)[-_:]?0*(\d+)(?:[-_:]|$)/i,
      /(?:^|[-_:])(?:ref-CR|ref|reference|bib|cit|r)[-_:]?0*(\d+)(?:$|[-_:])/i
    ];
    for (const pattern of patterns) {
      const number = Number(identifier.match(pattern)?.[1]);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return null;
  }

  function numberFromPseudoElement(element) {
    try {
      const content = getComputedStyle(element, '::before').content;
      if (!content || content === 'none' || content === 'normal') return null;
      return positiveNumber(content.replace(/^['"]|['"]$/g, ''));
    } catch {
      return null;
    }
  }

  function visibleNumber(element) {
    const counter = positiveNumber(element.getAttribute('data-counter'));
    if (counter) return counter;
    const dataContent = positiveNumber(element.getAttribute('data-content'));
    if (dataContent) return dataContent;
    for (const attribute of ['data-number', 'data-reference-number']) {
      const number = positiveNumber(element.getAttribute?.(attribute));
      if (number) return number;
    }

    const aria = String(element.getAttribute?.('aria-label') || '').match(/(?:reference|citation)\s*0*(\d+)/i)?.[1];
    const ariaNumber = Number(aria);
    if (Number.isFinite(ariaNumber) && ariaNumber > 0) return ariaNumber;

    const identifierNumber = numberFromIdentifier(element);
    if (identifierNumber) return identifierNumber;

    const textNumber = positiveNumber(String(element.textContent || '').match(/^\s*(\d{1,5})\s*[.)]/)?.[0]);
    if (textNumber) return textNumber;

    return numberFromPseudoElement(element);
  }

  function normalizeElement(element) {
    if (!(element instanceof Element)) return;
    const number = visibleNumber(element);
    if (number) element.setAttribute('data-counter', `${number}.`);
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