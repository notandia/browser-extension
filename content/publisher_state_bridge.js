'use strict';

;(function bridgePublisherSettingsToPageStyles() {
  const api = window.NotandiaPublisherProfiles;
  if (!api) return;

  function apply(storage) {
    const settings = api.migratePublisherSettings(storage || {});
    for (const profile of settings.profiles) {
      if (profile.source !== 'builtin') continue;
      const value = profile.enabled ? profile.action : 'disabled';
      document.documentElement.setAttribute(`data-notandia-${profile.id}-action`, value);
    }
  }

  chrome.storage.sync.get(null, storage => {
    if (!chrome.runtime.lastError) apply(storage);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || (!changes.publisherProfiles && !changes.mode && !changes.highlightPotentialMdpiSites)) return;
    chrome.storage.sync.get(null, storage => {
      if (!chrome.runtime.lastError) apply(storage);
    });
  });
})();
