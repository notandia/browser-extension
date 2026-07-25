'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const api = globalThis.NotandiaPublisherProfiles;
  if (!api) return;
  const $ = id => document.getElementById(id);
  const rows = $('profileRows');
  let settings = api.createDefaultSettings();

  const actionLabels = {
    none: 'No page styling', badge: 'Badge only', highlight: 'Highlight', dim: 'Dim', hide: 'Hide'
  };
  const confidenceLabels = {
    'verified-only': 'Verified matches only', 'include-potential': 'Include potential name matches'
  };

  function status(id, message, timeout = 4000) {
    const node = $(id);
    node.textContent = message;
    if (timeout) setTimeout(() => { node.textContent = ''; }, timeout);
  }

  function usesFirefoxDataConsent() {
    const optional = chrome.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions?.optional;
    return Array.isArray(optional) && optional.includes('websiteContent') && Boolean(globalThis.browser?.permissions);
  }

  async function hasFirefoxDataConsent() {
    if (!usesFirefoxDataConsent()) return true;
    const permissions = await browser.permissions.getAll();
    return Array.isArray(permissions.data_collection) && permissions.data_collection.includes('websiteContent');
  }

  async function requestFirefoxDataConsent() {
    if (!usesFirefoxDataConsent()) return true;
    return browser.permissions.request({ data_collection: ['websiteContent'] });
  }

  async function removeFirefoxDataConsent() {
    if (!usesFirefoxDataConsent()) return true;
    return browser.permissions.remove({ data_collection: ['websiteContent'] });
  }

  function selectFor(values, selected, labels) {
    const select = document.createElement('select');
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = labels[value] || value;
      option.selected = value === selected;
      select.appendChild(option);
    }
    return select;
  }

  function renderProfiles() {
    rows.replaceChildren();
    settings = api.normalizeSettings(settings);
    for (const profile of settings.profiles) {
      const row = document.createElement('div');
      row.className = 'profile-row';
      row.dataset.profileId = profile.id;

      const name = document.createElement('div');
      name.className = 'profile-name';
      const strong = document.createElement('strong');
      strong.textContent = profile.name;
      const source = document.createElement('span');
      source.className = 'profile-source';
      source.textContent = profile.source;
      const details = document.createElement('small');
      const parts = [];
      if (profile.domains.length) parts.push(`Domains: ${profile.domains.join(', ')}`);
      if (profile.doiPrefixes.length) parts.push(`DOI: ${profile.doiPrefixes.join(', ')}`);
      details.textContent = parts.join(' · ');
      name.append(strong, source, details);

      const enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.checked = profile.enabled;
      enabled.setAttribute('aria-label', `Enable ${profile.name}`);
      enabled.addEventListener('change', () => { profile.enabled = enabled.checked; });

      const action = selectFor(api.ACTIONS, profile.action, actionLabels);
      action.setAttribute('aria-label', `${profile.name} action`);
      action.addEventListener('change', () => { profile.action = action.value; });

      const color = document.createElement('input');
      color.type = 'color';
      color.value = profile.color;
      color.setAttribute('aria-label', `${profile.name} color`);
      color.addEventListener('input', () => { profile.color = color.value.toUpperCase(); });

      const confidence = selectFor(api.CONFIDENCE_POLICIES, profile.confidencePolicy, confidenceLabels);
      confidence.setAttribute('aria-label', `${profile.name} confidence policy`);
      confidence.addEventListener('change', () => { profile.confidencePolicy = confidence.value; });

      const remove = document.createElement('span');
      if (profile.source === 'custom') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'danger';
        button.textContent = '×';
        button.title = `Remove ${profile.name}`;
        button.addEventListener('click', () => {
          settings.profiles = settings.profiles.filter(candidate => candidate.id !== profile.id);
          renderProfiles();
        });
        remove.appendChild(button);
      }

      row.append(name, enabled, action, color, confidence, remove);
      rows.appendChild(row);
    }
  }

  function splitValues(value) {
    return String(value || '').split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);
  }

  $('addCustom').addEventListener('click', () => {
    const result = api.customProfileFromInput({
      name: $('customName').value,
      domains: splitValues($('customDomains').value),
      doiPrefixes: splitValues($('customDoiPrefixes').value),
      action: $('customAction').value,
      color: $('customColor').value,
      confidencePolicy: $('customConfidence').value
    }, settings.profiles.map(profile => profile.id));
    if (!result.profile) return status('customStatus', result.error || 'Could not add publisher.');
    settings.profiles.push(result.profile);
    for (const id of ['customName', 'customDomains', 'customDoiPrefixes']) $(id).value = '';
    renderProfiles();
    status('customStatus', `${result.profile.name} added. Save preferences to apply it.`);
  });

  $('exportProfiles').addEventListener('click', () => {
    $('profileJson').value = api.exportSettings(settings);
    status('transferStatus', 'Profile JSON exported to the text area.');
  });

  $('importProfiles').addEventListener('click', () => {
    try {
      const parsed = JSON.parse($('profileJson').value);
      settings = api.normalizeSettings(parsed);
      renderProfiles();
      status('transferStatus', 'Profile JSON imported and validated. Save to apply it.');
    } catch {
      status('transferStatus', 'Invalid JSON. Nothing was imported.');
    }
  });

  function broadcastRescan() {
    chrome.runtime.sendMessage({ type: 'publisherSettingsChanged' }, () => void chrome.runtime.lastError);
  }

  $('save').addEventListener('click', () => {
    void (async () => {
      const integrity = $('integrityLookupsEnabledOptions').checked;
      if (integrity) {
        const granted = await requestFirefoxDataConsent().catch(() => false);
        if (!granted) {
          $('integrityLookupsEnabledOptions').checked = false;
          status('status', 'Firefox data permission was not granted.');
          return;
        }
      } else await removeFirefoxDataConsent().catch(() => false);

      settings = api.normalizeSettings(settings);
      chrome.storage.sync.set({
        publisherProfiles: settings,
        publisherProfilesEnabled: true,
        mode: 'none',
        integrityLookupsEnabled: integrity,
        ncbiApiEnabled: $('ncbiApiEnabledOptions').checked,
        loggingEnabled: $('loggingEnabledOptions').checked
      }, () => {
        if (chrome.runtime.lastError) return status('status', 'Could not save preferences.');
        broadcastRescan();
        status('status', 'All preferences saved.');
      });
    })();
  });

  chrome.storage.sync.get(null, async storage => {
    if (chrome.runtime.lastError) return status('status', 'Could not load preferences.');
    settings = api.migratePublisherSettings(storage || {});
    renderProfiles();
    $('ncbiApiEnabledOptions').checked = storage.ncbiApiEnabled !== false;
    $('loggingEnabledOptions').checked = storage.loggingEnabled === true;
    const permitted = await hasFirefoxDataConsent().catch(() => false);
    $('integrityLookupsEnabledOptions').checked = storage.integrityLookupsEnabled === true && permitted;
  });
});
