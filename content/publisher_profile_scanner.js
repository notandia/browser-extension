'use strict';

;(function initializePublisherProfileScanner() {
  if (window.notandiaPublisherScannerInjected) return;
  window.notandiaPublisherScannerInjected = true;

  const api = window.NotandiaPublisherProfiles;
  const sourceContext = window.NotandiaSourceContext;
  if (!api || !sourceContext) return;

  const STYLE_ATTRIBUTE = 'data-notandia-profile-style';
  const SIGNATURE_ATTRIBUTE = 'data-notandia-profile-signature';
  const INLINE_ACTION_ATTRIBUTE = 'data-notandia-publisher-action';
  const INLINE_PROFILE_ATTRIBUTE = 'data-notandia-publisher-profile';
  const STYLE_PROPERTIES = Object.freeze(['display', 'opacity', 'border-left', 'padding-left', 'background-color']);
  const originalStyles = new WeakMap();
  const managedElements = new Set();
  const managedInlineAnchors = new Set();

  let settings = api.defaultSettings();
  let ncbiEnabled = false;
  let scanTimer = null;
  let scanGeneration = 0;
  let lastFingerprint = '';

  function profileEvidence(record) {
    return {
      dois: Array.from(record?.evidence?.dois || []),
      hostnames: Array.from(record?.evidence?.hostnames || [])
    };
  }

  function rgba(hex, alpha) {
    const match = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(hex || '');
    if (!match) return `rgba(72,98,122,${alpha})`;
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})`;
  }

  function rememberOriginalStyles(element) {
    if (originalStyles.has(element)) return;
    const snapshot = {};
    for (const property of STYLE_PROPERTIES) {
      snapshot[property] = {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      };
    }
    originalStyles.set(element, snapshot);
  }

  function restoreOriginalStyles(element) {
    const snapshot = originalStyles.get(element);
    if (!snapshot) return;
    for (const [property, state] of Object.entries(snapshot)) {
      if (state.value) element.style.setProperty(property, state.value, state.priority);
      else element.style.removeProperty(property);
    }
    originalStyles.delete(element);
  }

  function clearProfileStyle(element) {
    if (!element) return;
    const hasManagedState = managedElements.has(element) ||
      element.hasAttribute?.(STYLE_ATTRIBUTE) ||
      element.hasAttribute?.(SIGNATURE_ATTRIBUTE) ||
      Boolean(element.querySelector?.(':scope > .notandia-publisher-badges'));
    if (!hasManagedState) return;
    restoreOriginalStyles(element);
    element.querySelectorAll?.(':scope > .notandia-publisher-badges').forEach(node => node.remove());
    element.removeAttribute(STYLE_ATTRIBUTE);
    element.removeAttribute(SIGNATURE_ATTRIBUTE);
    managedElements.delete(element);
  }

  function addBadges(element, matches) {
    const visible = matches.filter(match => match.action !== 'none');
    if (!visible.length) return;
    const container = document.createElement('span');
    container.className = 'notandia-publisher-badges';
    container.setAttribute('aria-label', 'Notandia publisher watchlist matches');
    for (const match of visible) {
      const badge = document.createElement('span');
      badge.className = 'notandia-publisher-badge';
      badge.textContent = match.profileName;
      badge.style.setProperty('--notandia-profile-color', match.color);
      badge.title = `${match.profileName}: ${match.confidence} match (${match.reasons.join(', ')})`;
      container.appendChild(badge);
    }
    element.prepend(container);
  }

  function styleSignature(matches) {
    return matches
      .map(match => [match.profileId, match.confidence, match.action, match.color, ...(match.reasons || [])].join(':'))
      .sort()
      .join('|');
  }

  function applyVisualProperties(element, visual) {
    for (const property of STYLE_PROPERTIES) element.style.removeProperty(property);
    const snapshot = originalStyles.get(element);
    if (snapshot) {
      for (const [property, state] of Object.entries(snapshot)) {
        if (state.value) element.style.setProperty(property, state.value, state.priority);
      }
    }
    if (visual.action === 'hide') element.style.setProperty('display', 'none', 'important');
    else if (visual.action === 'dim') element.style.setProperty('opacity', '0.45', 'important');
    else if (visual.action === 'highlight') {
      element.style.setProperty('border-left', `4px solid ${visual.color}`, 'important');
      element.style.setProperty('padding-left', '8px', 'important');
      element.style.setProperty('background-color', rgba(visual.color, 0.08), 'important');
    }
  }

  function applyStyle(element, matches) {
    const signature = styleSignature(matches);
    const currentSignature = element.getAttribute(SIGNATURE_ATTRIBUTE) || '';
    const visual = api.resolveVisualMatch(matches);
    const badges = element.querySelectorAll?.(':scope > .notandia-publisher-badges') || [];
    const expectedBadges = matches.some(match => match.action !== 'none');
    if (currentSignature === signature && Boolean(badges.length) === expectedBadges) return;

    clearProfileStyle(element);
    if (!matches.length || !visual) return;
    rememberOriginalStyles(element);
    element.setAttribute(STYLE_ATTRIBUTE, visual.profileId);
    element.setAttribute(SIGNATURE_ATTRIBUTE, signature);
    addBadges(element, matches);
    applyVisualProperties(element, visual);
    managedElements.add(element);
  }

  function clearInlineAnchor(anchor) {
    anchor.classList.remove('notandia-publisher-citation');
    anchor.removeAttribute(INLINE_ACTION_ATTRIBUTE);
    anchor.removeAttribute(INLINE_PROFILE_ATTRIBUTE);
    anchor.style.removeProperty('--notandia-profile-color');
    managedInlineAnchors.delete(anchor);
  }

  function styleInlineCitations(record) {
    const visual = api.resolveVisualMatch(record.matches || []);
    if (!visual || !['highlight', 'dim', 'hide'].includes(visual.action)) return [];
    const utils = window.NotandiaUtils || window.MDPIFilterUtils;
    const generator = utils?.generateInlineFootnoteSelectors;
    if (typeof generator !== 'function') return [];
    const selectors = generator(record.id);
    if (!selectors) return [];
    const styled = [];
    try {
      for (const matched of document.querySelectorAll(selectors)) {
        const anchor = matched.tagName?.toLowerCase() === 'a' ? matched : matched.querySelector?.('a');
        if (!(anchor instanceof HTMLAnchorElement)) continue;
        anchor.classList.add('notandia-publisher-citation');
        anchor.setAttribute(INLINE_ACTION_ATTRIBUTE, visual.action);
        anchor.setAttribute(INLINE_PROFILE_ATTRIBUTE, visual.profileId);
        anchor.style.setProperty('--notandia-profile-color', visual.color);
        managedInlineAnchors.add(anchor);
        styled.push(anchor);
      }
    } catch {
      return [];
    }
    return styled;
  }

  function ensureStyleSheet() {
    if (document.getElementById('notandia-publisher-profile-styles')) return;
    const style = document.createElement('style');
    style.id = 'notandia-publisher-profile-styles';
    style.textContent = `
      .notandia-publisher-badges{display:flex!important;flex-wrap:wrap!important;gap:4px!important;margin:3px 0 5px!important;font:600 11px/1.2 system-ui,-apple-system,sans-serif!important}
      .notandia-publisher-badge{display:inline-flex!important;align-items:center!important;border:1px solid var(--notandia-profile-color)!important;border-radius:999px!important;padding:2px 6px!important;color:var(--notandia-profile-color)!important;background:#fff!important;letter-spacing:.01em!important}
      .notandia-publisher-citation[data-notandia-publisher-action="highlight"]:not(.notandia-integrity-citation),
      .notandia-publisher-citation[data-notandia-publisher-action="highlight"]:not(.notandia-integrity-citation) *{color:var(--notandia-profile-color)!important;font-weight:800!important;text-decoration-line:underline!important;text-decoration-style:dotted!important;text-decoration-color:var(--notandia-profile-color)!important;text-decoration-thickness:2px!important;text-underline-offset:2px!important}
      .notandia-publisher-citation[data-notandia-publisher-action="dim"]:not(.notandia-integrity-citation){opacity:.45!important}
      .notandia-publisher-citation[data-notandia-publisher-action="hide"]:not(.notandia-integrity-citation){display:none!important}
    `;
    document.documentElement.appendChild(style);
  }

  function serializeRecord(record) {
    return {
      id: record.id,
      kind: record.kind,
      number: record.number,
      doi: record.doi,
      text: record.text,
      matches: record.matches
    };
  }

  async function scan(generation) {
    ensureStyleSheet();
    const { references: referenceRecords, searchResults: searchRecords, all } = sourceContext.collectRecords({
      maxReferences: 300,
      maxSearchResults: 150,
      maxTextLength: 500
    });

    await sourceContext.resolveRecordsWithNcbi(all, ncbiEnabled);
    if (generation !== scanGeneration) return;

    for (const record of all) record.matches = api.matchProfiles(settings, profileEvidence(record));
    const allElements = new Set(all.map(record => record.element));
    for (const element of Array.from(managedElements)) {
      if (!allElements.has(element)) clearProfileStyle(element);
    }

    const currentInline = new Set();
    for (const record of all) {
      applyStyle(record.element, record.matches);
      if (record.kind === 'reference' && record.matches.length) {
        for (const anchor of styleInlineCitations(record)) currentInline.add(anchor);
      }
    }
    for (const anchor of Array.from(managedInlineAnchors)) {
      if (!currentInline.has(anchor)) clearInlineAnchor(anchor);
    }

    const currentEvidence = sourceContext.currentArticleEvidence();
    const currentArticle = {
      doi: currentEvidence.dois[0] || null,
      matches: api.matchProfiles(settings, {
        dois: currentEvidence.dois,
        hostnames: currentEvidence.hostnames
      })
    };
    const references = referenceRecords.filter(record => record.matches.length).map(serializeRecord);
    const searchResults = searchRecords.filter(record => record.matches.length).map(serializeRecord);
    const fingerprint = JSON.stringify([
      settings,
      ncbiEnabled,
      currentArticle,
      references.map(record => [record.id, record.number, record.doi, record.matches.map(match => [match.profileId, match.action, match.confidence])]),
      searchResults.map(record => [record.id, record.number, record.doi, record.matches.map(match => [match.profileId, match.action, match.confidence])])
    ]);
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;
    chrome.runtime.sendMessage(
      { type: 'publisherContextUpdate', data: { currentArticle, references, searchResults } },
      () => void chrome.runtime.lastError
    );
  }

  function scheduleScan(delay = 250) {
    clearTimeout(scanTimer);
    const generation = ++scanGeneration;
    scanTimer = setTimeout(() => void scan(generation), delay);
  }

  function exposeRuntimeSettings() {
    const runtimeSettings = window.NotandiaSettings || window.MDPIFilterSettings || {};
    runtimeSettings.ncbiApiEnabled = ncbiEnabled;
    window.NotandiaSettings = runtimeSettings;
    window.MDPIFilterSettings = runtimeSettings;
  }

  function loadSettings() {
    chrome.storage.sync.get({
      publisherWatchlist: null,
      mode: 'highlight',
      highlightPotentialMdpiSites: true,
      potentialMdpiHighlightColor: '#E2211C',
      ncbiApiEnabled: false
    }, stored => {
      if (chrome.runtime.lastError) return;
      settings = api.migrateLegacySettings(stored);
      ncbiEnabled = stored.ncbiApiEnabled === true;
      exposeRuntimeSettings();
      if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== api.SCHEMA_VERSION) {
        chrome.storage.sync.set({ publisherWatchlist: settings });
      }
      lastFingerprint = '';
      scheduleScan(0);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (
      changes.publisherWatchlist ||
      changes.mode ||
      changes.highlightPotentialMdpiSites ||
      changes.potentialMdpiHighlightColor ||
      changes.ncbiApiEnabled
    )) loadSettings();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'forcePublisherRescan') return false;
    lastFingerprint = '';
    scheduleScan(0);
    sendResponse?.({ scheduled: true });
    return false;
  });

  loadSettings();
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation =>
      Array.from(mutation.addedNodes).some(sourceContext.nodeTouchesSourceContext) ||
      Array.from(mutation.removedNodes).some(sourceContext.nodeTouchesSourceContext)
    )) scheduleScan(500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => scheduleScan(0), 1800);
})();
