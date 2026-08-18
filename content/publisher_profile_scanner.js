'use strict';

;(function initializePublisherProfileScanner() {
  if (window.notandiaPublisherScannerInjected) return;
  window.notandiaPublisherScannerInjected = true;

  const api = window.NotandiaPublisherProfiles;
  const workIds = window.NotandiaWorkIdentifiers;
  const sourceContext = window.NotandiaSourceContext;
  if (!api || !workIds || !sourceContext) return;

  const MAX_REFERENCES = 300;
  const MAX_SEARCH_RESULTS = 150;
  const MAX_TEXT = 500;
  const STYLE_ATTRIBUTE = 'data-notandia-profile-style';
  const SIGNATURE_ATTRIBUTE = 'data-notandia-profile-signature';
  const INLINE_ACTION_ATTRIBUTE = 'data-notandia-publisher-action';
  const INLINE_PROFILE_ATTRIBUTE = 'data-notandia-publisher-profile';
  const STYLE_PROPERTIES = Object.freeze(['display', 'opacity', 'border-left', 'padding-left', 'background-color']);
  const OWN_NODE_SELECTOR = '.notandia-publisher-badges,.notandia-publisher-badge,.notandia-integrity-chip,#notandia-publisher-profile-styles';
  const MDPI_DOMAINS = Object.freeze(['mdpi.com', 'mdpi.org']);
  const MDPI_DOI_PREFIX = '10.3390';
  const originalStyles = new WeakMap();
  const managedElements = new Set();
  const managedInlineAnchors = new Set();
  let settings = api.defaultSettings();
  let ncbiEnabled = false;
  let scanTimer = null;
  let scanGeneration = 0;
  let lastFingerprint = '';

  function currentArticleEvidence() {
    const values = [];
    for (const selector of [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="DC.Identifier"]',
      'meta[name="doi"]',
      'meta[property="citation_doi"]'
    ]) values.push(document.querySelector(selector)?.getAttribute('content') || '');
    values.push(document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '', location.href);
    const identity = workIds.extract(values, {
      source: 'notandia-source-context',
      method: 'current-article',
      confidence: 'exact'
    });
    return {
      dois: Array.from(identity.identifiers.doi || []),
      pmids: Array.from(identity.identifiers.pmid || []),
      pmcids: Array.from(identity.identifiers.pmcid || []),
      arxiv: Array.from(identity.identifiers.arxiv || []),
      hostnames: [location.hostname.toLowerCase().replace(/^www\./, '')],
      profileSignals: []
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
    if (!snapshot) return false;
    for (const [property, state] of Object.entries(snapshot)) {
      if (state.value) element.style.setProperty(property, state.value, state.priority);
      else element.style.removeProperty(property);
    }
    originalStyles.delete(element);
    return true;
  }

  function clearProfileStyle(element) {
    if (!(element instanceof Element)) return;
    const hadNotandiaState = element.hasAttribute(STYLE_ATTRIBUTE) ||
      element.hasAttribute(SIGNATURE_ATTRIBUTE) ||
      Boolean(element.querySelector?.(':scope > .notandia-publisher-badges'));
    const hasManagedState = managedElements.has(element) || hadNotandiaState;
    if (!hasManagedState) return;

    const restored = restoreOriginalStyles(element);
    // Extension reloads replace the JS WeakMap but not the already-mutated page DOM.
    // If a previous injection left our marker attributes behind, remove only the
    // properties Notandia itself manages so obsolete parent highlights disappear.
    if (!restored && hadNotandiaState) {
      for (const property of STYLE_PROPERTIES) element.style.removeProperty(property);
    }
    element.querySelectorAll?.(':scope > .notandia-publisher-badges').forEach(node => node.remove());
    element.removeAttribute(STYLE_ATTRIBUTE);
    element.removeAttribute(SIGNATURE_ATTRIBUTE);
    managedElements.delete(element);
  }

  function clearOrphanedProfileStyles(currentElements) {
    let marked = [];
    try {
      marked = Array.from(document.querySelectorAll(`[${STYLE_ATTRIBUTE}], [${SIGNATURE_ATTRIBUTE}]`));
    } catch {}
    for (const element of marked) {
      if (!currentElements.has(element)) clearProfileStyle(element);
    }
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

  function buildRecord(element, index, kind) {
    const record = sourceContext.buildRecord(element, index, kind, MAX_TEXT);
    record.matches = [];
    return record;
  }

  async function enrichRecordsWithNcbi(records) {
    if (!ncbiEnabled || !records.length) return;
    const resolver = (window.NotandiaNcbiApiHandler || window.MDPIFilterNcbiApiHandler)?.resolveNcbiIdsToDois;
    if (typeof resolver !== 'function') return;

    const pmids = new Set();
    const pmcids = new Set();
    for (const record of records) {
      if (record.doi) continue;
      for (const pmid of record.evidence.pmids || []) pmids.add(pmid);
      for (const pmcid of record.evidence.pmcids || []) pmcids.add(pmcid);
    }

    const pmidResolution = pmids.size
      ? await resolver(Array.from(pmids), 'pmid')
      : { doiById: new Map() };
    const pmcidResolution = pmcids.size
      ? await resolver(Array.from(pmcids), 'pmcid')
      : { doiById: new Map() };

    for (const record of records) {
      if (record.doi) continue;
      let resolved = null;
      for (const pmid of record.evidence.pmids || []) {
        resolved = pmidResolution.doiById?.get(pmid) || null;
        if (resolved) break;
      }
      if (!resolved) {
        for (const pmcid of record.evidence.pmcids || []) {
          resolved = pmcidResolution.doiById?.get(pmcid) || null;
          if (resolved) break;
        }
      }
      if (resolved) sourceContext.setResolvedDoi(record, resolved);
    }
  }

  function addProfileSignal(record, confidence, reason) {
    record.evidence.profileSignals ||= [];
    const signature = `mdpi|${confidence}|${reason}`;
    if (record.evidence.profileSignals.some(signal => `${signal.profileId}|${signal.confidence}|${signal.reason}` === signature)) return;
    record.evidence.profileSignals.push({ profileId: 'mdpi', confidence, reason });
  }

  function matureMdpiSignals(records) {
    const itemChecker = window.MDPIFilterItemContentChecker?.checkItemContent;
    const googleChecker = typeof window.GoogleContentChecker === 'function'
      ? new window.GoogleContentChecker()
      : null;
    if (typeof itemChecker !== 'function' && !googleChecker) return;

    const runCache = new Map();
    for (const record of records) {
      const isMdpi = Boolean(record.doi && record.doi.startsWith(`${MDPI_DOI_PREFIX}/`));
      if (!record.doi) continue;
      for (const id of [
        ...(record.evidence.pmids || []),
        ...(record.evidence.pmcids || []),
        ...(record.evidence.dois || [])
      ]) runCache.set(id, isMdpi);
    }

    const googleWeb = sourceContext.activeSearchConfig()?.isGoogleWeb === true;
    for (const record of records) {
      let confirmed = false;
      if (typeof itemChecker === 'function') {
        try {
          const primaryUrl = record.element.querySelector?.('a[href]')?.getAttribute('href') || null;
          confirmed = itemChecker(
            record.element,
            runCache,
            MDPI_DOI_PREFIX,
            MDPI_DOMAINS,
            record.doi,
            primaryUrl,
            googleChecker
          ) === true;
        } catch {
          confirmed = false;
        }
      }
      if (confirmed) {
        addProfileSignal(record, 'confirmed', 'mature-mdpi-detector');
        continue;
      }

      // Preserve the older Google-web potential signal without applying it to
      // Scholar or bibliography records, where generic words such as PMID/PMC
      // would otherwise create noisy publisher matches.
      if (googleWeb && googleChecker?.checkForPotentialMdpiKeywordsInText?.(record.element)) {
        addProfileSignal(record, 'potential', 'mature-google-context');
      }
    }
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

  async function scan(generation) {
    ensureStyleSheet();
    const referenceRecords = sourceContext.referenceNodes(MAX_REFERENCES)
      .map((element, index) => buildRecord(element, index, 'reference'));
    const searchRecords = sourceContext.searchNodes(MAX_SEARCH_RESULTS)
      .map((element, index) => buildRecord(element, index, 'search-result'));
    const allRecords = [...referenceRecords, ...searchRecords];

    await enrichRecordsWithNcbi(allRecords);
    if (generation !== scanGeneration) return;
    matureMdpiSignals(allRecords);
    for (const record of allRecords) record.matches = api.matchProfiles(settings, record.evidence);

    const allElements = new Set(allRecords.map(record => record.element));
    clearOrphanedProfileStyles(allElements);
    for (const element of Array.from(managedElements)) {
      if (!allElements.has(element)) clearProfileStyle(element);
    }

    const currentInline = new Set();
    for (const record of allRecords) {
      applyStyle(record.element, record.matches);
      if (record.kind === 'reference' && record.matches.length) {
        for (const anchor of styleInlineCitations(record)) currentInline.add(anchor);
      }
    }
    for (const anchor of Array.from(managedInlineAnchors)) {
      if (!currentInline.has(anchor)) clearInlineAnchor(anchor);
    }

    const currentEvidence = currentArticleEvidence();
    const currentArticle = {
      doi: currentEvidence.dois[0] || null,
      matches: api.matchProfiles(settings, currentEvidence)
    };
    const references = referenceRecords
      .filter(record => record.matches.length)
      .map(({ element, evidence, identity, title, ...record }) => record);
    const searchResults = searchRecords
      .filter(record => record.matches.length)
      .map(({ element, evidence, identity, title, ...record }) => record);
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

      const runtimeSettings = window.NotandiaSettings || window.MDPIFilterSettings || {};
      runtimeSettings.ncbiApiEnabled = ncbiEnabled;
      window.NotandiaSettings = runtimeSettings;
      // Compatibility alias retained for the mature MDPI evidence module.
      window.MDPIFilterSettings = runtimeSettings;

      if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== api.SCHEMA_VERSION) {
        chrome.storage.sync.set({ publisherWatchlist: settings });
      }
      lastFingerprint = '';
      scheduleScan(0);
    });
  }

  function nodeTouchesRelevantContent(node) {
    if (!(node instanceof Element)) return false;
    if (node.matches(OWN_NODE_SELECTOR) || node.closest(OWN_NODE_SELECTOR)) return false;

    const selectors = [
      sourceContext.configuredReferenceSelector(),
      sourceContext.configuredSearchSelector()
    ].filter(Boolean);
    try {
      for (const selector of selectors) {
        if (node.matches(selector) || node.querySelector(selector)) return true;
      }
      const evidenceSelector = 'a[href*="#"],a[href*="doi.org"],a[href*="10."],a[href*="pubmed.ncbi.nlm.nih.gov"],a[href*="pmc.ncbi.nlm.nih.gov"],a[href*="europepmc.org/article/"]';
      if (node.matches(evidenceSelector)) return true;
      return Boolean(node.querySelector(evidenceSelector));
    } catch {
      return false;
    }
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
      Array.from(mutation.addedNodes).some(nodeTouchesRelevantContent) ||
      Array.from(mutation.removedNodes).some(nodeTouchesRelevantContent)
    )) scheduleScan(500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => scheduleScan(0), 1800);
})();
