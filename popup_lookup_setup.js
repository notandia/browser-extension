'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const prompt = $('lookupSetup');
  if (!prompt || !chrome.storage?.local || !chrome.storage?.sync) return;
  const enable = $('enableRecommendedChecks');
  const keep = $('keepLookupSettings');
  const status = $('lookupSetupStatus');
  const dismissedKey = 'notandiaLookupSetupDismissed';
  let revision = 0;

  async function refresh() {
    const current = ++revision;
    try {
      const [local, settings] = await Promise.all([
        chrome.storage.local.get(dismissedKey),
        chrome.storage.sync.get({ integrityLookupsEnabled: false, ncbiApiEnabled: false })
      ]);
      if (current !== revision) return;
      $('lookupCurrentSettings').textContent = `Current settings: Crossref ${settings.integrityLookupsEnabled === true ? 'on' : 'off'}; NCBI ${settings.ncbiApiEnabled === true ? 'on' : 'off'}.`;
      prompt.hidden = local[dismissedKey] === true ||
        (settings.integrityLookupsEnabled === true && settings.ncbiApiEnabled === true);
    } catch {
      prompt.hidden = true;
    }
  }

  function finish() {
    prompt.hidden = true;
    $('rescan').focus();
  }

  enable.addEventListener('click', async () => {
    enable.disabled = keep.disabled = true;
    prompt.setAttribute('aria-busy', 'true');
    status.textContent = '';
    try {
      const optional = chrome.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional;
      if (Array.isArray(optional) && optional.includes('websiteContent')) {
        const permitted = await globalThis.browser?.permissions?.request({ data_collection: ['websiteContent'] });
        if (!permitted) {
          status.textContent = 'Firefox data permission was not granted. Your settings are unchanged.';
          return;
        }
      }
      await chrome.storage.sync.set({ integrityLookupsEnabled: true, ncbiApiEnabled: true });
      $('integrityLookupsEnabled').checked = true;
      $('ncbiApiEnabledPopup').checked = true;
      // Enabling is also a completed setup choice: later disablement must not
      // trigger another recommendation on this device.
      await chrome.storage.local.set({ [dismissedKey]: true });
      finish();
      $('status').textContent = 'Crossref and NCBI checks enabled.';
      $('rescan').click();
    } catch {
      status.textContent = 'Could not complete setup. Check your lookup settings and try again.';
    } finally {
      enable.disabled = keep.disabled = false;
      prompt.removeAttribute('aria-busy');
    }
  });

  keep.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({ [dismissedKey]: true });
      finish();
    } catch {
      status.textContent = 'Could not remember your choice. Please try again.';
    }
  });

  $('chooseLookupChecks').addEventListener('click', () => {
    if (!$('settingsPanel').classList.contains('open')) $('settingsIcon').click();
    $('integrityLookupsEnabled').focus();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === 'local' && changes[dismissedKey]) ||
        (area === 'sync' && (changes.integrityLookupsEnabled || changes.ncbiApiEnabled))) void refresh();
  });
  await refresh();
});
