'use strict';

(() => {
  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;

  function normalizeDoi(value) {
    return String(value || '')
      .trim()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[),.;:\]}>'"`]+$/g, '')
      .toLowerCase();
  }

  function normalizedText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.notandia-publisher-badges,.notandia-integrity-chip').forEach(node => node.remove());
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest('[hidden],[aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }

  function candidateScore(element, referenceId) {
    let score = 0;
    if (isVisible(element)) score += 500;
    else score -= 500;
    if (element.matches('li.c-article-references__item')) score += 450;
    if (element.closest('#references,[role="doc-bibliography"],.c-article-references')) score += 250;
    if (element.matches('[data-counter]')) score += 80;
    if (element.id === referenceId) score += 100;
    if (element.getAttribute('data-mdpi-filter-ref-id') === referenceId) score += 100;
    if (element.closest('.c-reading-companion,.c-reading-companion__reference-item')) score -= 600;
    if (/^(?:mdpi|notandia)-ref-/i.test(element.getAttribute('data-mdpi-filter-ref-id') || '')) score -= 40;
    return score;
  }

  function referenceCandidates(message) {
    const candidates = new Set();
    for (const element of document.querySelectorAll('[data-mdpi-filter-ref-id]')) {
      if (element.getAttribute('data-mdpi-filter-ref-id') === message.refId) candidates.add(element);
    }
    const byId = document.getElementById(message.refId);
    if (byId) candidates.add(byId.closest('li,[role="listitem"]') || byId);

    let referenceNodes = [];
    try {
      if (typeof window.MDPIFilterReferenceSelectors === 'string') {
        referenceNodes = Array.from(document.querySelectorAll(window.MDPIFilterReferenceSelectors));
      }
    } catch {
      referenceNodes = [];
    }

    const requestedDoi = normalizeDoi(message.doi);
    const requestedText = String(message.text || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 140);
    for (const element of referenceNodes) {
      if (requestedDoi) {
        const doiFound = Array.from(element.querySelectorAll('a[href]')).some(anchor =>
          normalizeDoi(anchor.getAttribute('href')).includes(requestedDoi)
        ) || normalizedText(element).includes(requestedDoi);
        if (doiFound) candidates.add(element);
      }
      if (requestedText.length >= 24) {
        const text = normalizedText(element);
        if (text.includes(requestedText) || requestedText.includes(text.slice(0, 100))) candidates.add(element);
      }
    }
    return Array.from(candidates);
  }

  function findReferenceElement(message) {
    return referenceCandidates(message)
      .sort((left, right) => candidateScore(right, message.refId) - candidateScore(left, message.refId))[0] || null;
  }

  function animateReference(reference, color) {
    reference.style.setProperty('--notandia-scroll-color', /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : '#48627A');
    reference.classList.remove('notandia-scroll-target');
    void reference.offsetWidth;
    reference.classList.add('notandia-scroll-target');
    setTimeout(() => reference.classList.remove('notandia-scroll-target'), 1800);
  }

  function scrollAndAnimate(reference, color) {
    reference.scrollIntoView({ behavior: 'smooth', block: 'center' });
    requestAnimationFrame(() => animateReference(reference, color));
  }

  function controlTargetsId(control, id) {
    return String(control.getAttribute?.('aria-controls') || '')
      .trim()
      .split(/\s+/)
      .includes(id);
  }

  function collapsedControl(reference) {
    const articleAccordionControl = reference.closest('div.article-accordion')
      ?.querySelector('.accordion__control[aria-expanded="false"]');
    if (articleAccordionControl instanceof HTMLElement) return articleAccordionControl;

    const concealed = reference.closest('[hidden],[aria-hidden="true"]');
    const controlledContainer = concealed?.closest('[id]') ||
      reference.closest('[id][data-method="height"],[id][data-collapsible]');
    const controlledId = String(controlledContainer?.id || '').trim();
    if (!SAFE_REFERENCE_ID.test(controlledId)) return null;

    for (const control of document.querySelectorAll('button[aria-controls],[role="button"][aria-controls]')) {
      if (controlTargetsId(control, controlledId) && control instanceof HTMLElement) return control;
    }
    return null;
  }

  function waitForVisibleReference(message, timeout = 1800) {
    return new Promise(resolve => {
      const startedAt = Date.now();
      const check = () => {
        const reference = findReferenceElement(message);
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

  async function revealScrollAndAnimate(reference, message) {
    if (isVisible(reference)) {
      scrollAndAnimate(reference, message.color);
      return 'scrolled';
    }

    const details = reference.closest('details:not([open])');
    if (details instanceof HTMLDetailsElement) details.open = true;

    const control = collapsedControl(reference);
    if (control) control.click();

    const revealed = await waitForVisibleReference(message);
    if (revealed) {
      scrollAndAnimate(revealed, message.color);
      return isVisible(revealed) ? 'expanded-and-scrolled' : 'scrolled-hidden';
    }
    return 'not-found-after-expand';
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
    if (message.type !== 'scrollToRefOnPage') return false;

    if (typeof message.refId !== 'string' || !SAFE_REFERENCE_ID.test(message.refId)) {
      sendResponse({ status: 'invalid-reference-id' });
      return false;
    }

    const reference = findReferenceElement(message);
    if (!reference) {
      sendResponse({ status: 'not-found' });
      return false;
    }

    void revealScrollAndAnimate(reference, message)
      .then(status => sendResponse({ status }))
      .catch(() => sendResponse({ status: 'scroll-failed' }));
    return true;
  });
})();
