'use strict';

// Local synthetic fixtures exercise the real matcher and content renderers.
// No provider requests, extension storage, or real DOI records are involved.
;(function initializeSyntheticDemo() {
  const api = window.NotandiaPublisherProfiles;
  const integrity = window.MDPIIntegrity;
  const settings = api.defaultSettings();
  const listeners = [];
  const storageListeners = [];
  const update = (type, callback) => {
    for (const listener of listeners) listener({ type }, { id: 'synthetic-demo' }, callback);
  };
  const collectRecords = () => {
    const references = Array.from(document.querySelectorAll('li[data-publisher]'), (element, index) => {
      const profile = [...api.BUILTIN_PROFILES, ...api.PRESET_CATALOGUE].find(item => item.id === element.dataset.publisher);
      return {
        id: element.id, element, kind: 'reference', number: index + 1,
        doi: element.dataset.doi, text: element.textContent,
        evidence: { dois: [element.dataset.doi], hostnames: [profile.domains[0]] }
      };
    });
    return { references, searchResults: [], all: references };
  };
  const report = {
    state: 'ready', updatedAt: 'synthetic-demo',
    records: [['demo-elsevier', 'retraction'], ['demo-wiley', 'correction']].map(([id, type]) => {
      const events = integrity.normalizeCrossrefEvents({
        'updated-by': [{ DOI: `10.5555/notandia-demo-${type}-notice`, type, date: '2026-01-01' }]
      });
      return { id, kind: 'reference', doi: document.getElementById(id).dataset.doi,
        lookupStatus: 'checked', events, primaryStatus: integrity.derivePrimaryStatus(events) };
    })
  };
  window.chrome = {
    runtime: { id: 'synthetic-demo', onMessage: { addListener: listener => listeners.push(listener) }, sendMessage: (_message, callback) => callback?.({}) },
    storage: { sync: { get: (defaults, callback) => callback({ ...defaults, publisherWatchlist: settings }), set: () => {} }, onChanged: { addListener: listener => storageListeners.push(listener) } }
  };
  window.NotandiaSourceContext = {
    collectRecords, resolveRecordsWithNcbi: async () => {},
    currentArticleEvidence: () => ({ dois: [], hostnames: [] }), nodeTouchesSourceContext: () => false
  };
  window.MDPIFilterUtils = { generateInlineFootnoteSelectors: id => `a[href="#${id}"]` };
  window.NotandiaRuntime = {
    isAvailable: () => true, isInvalidationError: () => false,
    sendMessage: (_message, callback) => { callback?.({ report, statuses: integrity.STATUS_DEFINITIONS }); return true; }
  };
  document.getElementById('optionalPublishers').addEventListener('click', event => {
    const enabled = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    event.currentTarget.setAttribute('aria-pressed', String(enabled));
    settings.profiles = settings.profiles.filter(item => !['elsevier', 'wiley'].includes(item.id));
    if (enabled) settings.profiles.push(...api.PRESET_CATALOGUE.filter(item => ['elsevier', 'wiley'].includes(item.id)).map(item => ({ ...item, action: 'badge' })));
    for (const listener of storageListeners) listener({ publisherWatchlist: { newValue: settings } }, 'sync');
    update('forcePublisherRescan');
    document.getElementById('demoStatus').textContent = enabled
      ? 'Elsevier and Wiley identification enabled. Their synthetic formal notices remain separate.'
      : 'Optional identification disabled. The synthetic Elsevier and Wiley formal notices remain visible.';
  });
  document.getElementById('darkTheme').addEventListener('click', event => {
    const dark = document.body.classList.toggle('dark');
    event.currentTarget.setAttribute('aria-pressed', String(dark));
  });
})();
