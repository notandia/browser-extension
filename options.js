'use strict';

const api = globalThis.NotandiaPublisherProfiles;
if (!api) throw new Error('Publisher profile runtime failed to load');

const $ = id => document.getElementById(id);
const profileList = $('profileList');
const status = $('status');
let watchlist = api.defaultSettings();

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
  if (message) setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 5000);
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

async function setFirefoxDataConsent(enabled) {
  if (!usesFirefoxDataConsent()) return true;
  if (enabled) return browser.permissions.request({ data_collection: ['websiteContent'] });
  await browser.permissions.remove({ data_collection: ['websiteContent'] });
  return true;
}

function appendOptions(select, choices, selected) {
  for (const [value, label] of choices) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = value === selected;
    select.appendChild(option);
  }
}

function renderProfiles() {
  profileList.replaceChildren();
  watchlist = api.sanitizeSettings(watchlist);
  for (const profile of watchlist.profiles) {
    const row = document.createElement('div');
    row.className = 'profile-row';
    row.dataset.profileId = profile.id;
    const details = document.createElement('div');
    details.className = 'profile-main';
    const name = document.createElement('strong');
    name.textContent = profile.name;
    if (profile.source === 'builtin') {
      const chip = document.createElement('span');
      chip.className = 'profile-chip';
      chip.textContent = 'Built in';
      name.appendChild(chip);
    }
    const evidence = document.createElement('small');
    evidence.textContent = [profile.domains.join(', '), profile.doiPrefixes.join(', ')].filter(Boolean).join(' · ');
    details.append(name, evidence);

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'switch-wrap';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.className = 'profile-enabled';
    enabled.checked = profile.enabled;
    enabledLabel.append(enabled, document.createTextNode('Enabled'));

    const actionLabel = document.createElement('label');
    actionLabel.textContent = 'Action';
    const action = document.createElement('select');
    action.className = 'profile-action';
    appendOptions(action, [
      ['none', 'Context only'],
      ['badge', 'Badge only'],
      ['highlight', 'Highlight'],
      ['dim', 'Dim'],
      ['hide', 'Hide']
    ], profile.action);
    actionLabel.appendChild(action);

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'profile-color';
    color.value = profile.color;
    colorLabel.appendChild(color);

    const confidenceLabel = document.createElement('label');
    confidenceLabel.textContent = 'Match policy';
    const confidence = document.createElement('select');
    confidence.className = 'profile-confidence';
    appendOptions(confidence, [
      ['confirmed-only', 'Confirmed only'],
      ['confirmed-and-potential', 'Include potential']
    ], profile.confidencePolicy);
    confidenceLabel.appendChild(confidence);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-profile';
    remove.title = profile.source === 'builtin' ? 'Built-in profiles cannot be removed, but they can be disabled.' : `Remove ${profile.name}`;
    remove.setAttribute('aria-label', remove.title);
    remove.textContent = '×';
    remove.disabled = profile.source === 'builtin';

    row.append(details, enabledLabel, actionLabel, colorLabel, confidenceLabel, remove);
    profileList.appendChild(row);
  }
}

function readRows() {
  const byId = new Map(watchlist.profiles.map(profile => [profile.id, profile]));
  for (const row of profileList.querySelectorAll('.profile-row')) {
    const profile = byId.get(row.dataset.profileId);
    if (!profile) continue;
    profile.enabled = row.querySelector('.profile-enabled').checked;
    profile.action = row.querySelector('.profile-action').value;
    profile.color = row.querySelector('.profile-color').value;
    profile.confidencePolicy = row.querySelector('.profile-confidence').value;
  }
  watchlist = api.sanitizeSettings({ ...watchlist, profiles: Array.from(byId.values()) });
  return watchlist;
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

function commaValues(value) {
  return String(value || '').split(',').map(part => part.trim()).filter(Boolean);
}

$('addProfile').addEventListener('click', () => {
  readRows();
  const name = $('customName').value.trim();
  let id = slugify(name);
  if (!id) return setStatus('Enter a publisher name.', true);
  const existingIds = new Set(watchlist.profiles.map(profile => profile.id));
  let suffix = 2;
  while (existingIds.has(id)) id = `${slugify(name).slice(0, 42)}-${suffix++}`;
  const profile = api.normalizeProfile({
    id,
    name,
    domains: commaValues($('customDomains').value),
    doiPrefixes: commaValues($('customDoiPrefixes').value),
    enabled: true,
    action: $('customAction').value,
    color: $('customColor').value,
    confidencePolicy: 'confirmed-only',
    source: 'custom'
  });
  if (!profile) return setStatus('Add at least one valid publisher domain or DOI prefix.', true);
  watchlist.profiles.push(profile);
  for (const idToClear of ['customName', 'customDomains', 'customDoiPrefixes']) $(idToClear).value = '';
  renderProfiles();
  setStatus(`${profile.name} added. Save settings to apply it.`);
});

profileList.addEventListener('click', event => {
  const button = event.target.closest('.remove-profile');
  if (!button || button.disabled) return;
  readRows();
  const id = button.closest('.profile-row').dataset.profileId;
  watchlist.profiles = watchlist.profiles.filter(profile => profile.id !== id || profile.source === 'builtin');
  renderProfiles();
});

$('exportProfiles').addEventListener('click', () => {
  readRows();
  $('profileJson').value = JSON.stringify(watchlist, null, 2);
  $('profileJson').focus();
  $('profileJson').select();
  setStatus('Publisher profile JSON prepared for copying.');
});

$('importProfiles').addEventListener('click', () => {
  try {
    const parsed = JSON.parse($('profileJson').value);
    const sanitized = api.sanitizeSettings(parsed);
    if (!Array.isArray(parsed?.profiles) || !sanitized.profiles.length) throw new Error('No valid profiles');
    watchlist = sanitized;
    renderProfiles();
    setStatus('Profiles imported. Save settings to apply them.');
  } catch {
    setStatus('The profile JSON is invalid or contains no valid publisher profiles.', true);
  }
});

$('resetProfiles').addEventListener('click', () => {
  watchlist = api.defaultSettings();
  renderProfiles();
  setStatus('Default MDPI and Frontiers profiles restored. Save settings to apply them.');
});

$('save').addEventListener('click', () => {
  void (async () => {
    readRows();
    const integrityEnabled = $('integrityLookupsEnabledOptions').checked;
    const consent = await setFirefoxDataConsent(integrityEnabled).catch(() => false);
    if (integrityEnabled && !consent) {
      $('integrityLookupsEnabledOptions').checked = false;
      return setStatus('Firefox data permission was not granted.', true);
    }
    const mdpi = watchlist.profiles.find(profile => profile.id === 'mdpi');
    chrome.storage.sync.set({
      publisherWatchlist: watchlist,
      integrityLookupsEnabled: integrityEnabled,
      ncbiApiEnabled: $('ncbiApiEnabledOptions').checked,
      loggingEnabled: $('loggingEnabledOptions').checked,
      mode: mdpi?.action === 'hide' ? 'hide' : 'highlight',
      highlightPotentialMdpiSites: mdpi?.confidencePolicy === 'confirmed-and-potential',
      potentialMdpiHighlightColor: mdpi?.color || '#E2211C'
    }, () => {
      if (chrome.runtime.lastError) return setStatus('Could not save settings.', true);
      chrome.tabs?.query?.({}, tabs => {
        for (const tab of tabs || []) {
          if (!Number.isInteger(tab.id)) continue;
          chrome.tabs.sendMessage(tab.id, { type: 'forcePublisherRescan' }, () => void chrome.runtime.lastError);
          chrome.tabs.sendMessage(tab.id, { type: 'forceIntegrityRescan' }, () => void chrome.runtime.lastError);
        }
      });
      setStatus('Settings saved.');
    });
  })();
});

function load() {
  chrome.storage.sync.get({
    publisherWatchlist: null,
    mode: 'highlight',
    highlightPotentialMdpiSites: true,
    potentialMdpiHighlightColor: '#E2211C',
    integrityLookupsEnabled: false,
    ncbiApiEnabled: true,
    loggingEnabled: false
  }, stored => {
    if (chrome.runtime.lastError) return setStatus('Could not load settings.', true);
    watchlist = api.migrateLegacySettings(stored);
    renderProfiles();
    $('ncbiApiEnabledOptions').checked = stored.ncbiApiEnabled !== false;
    $('loggingEnabledOptions').checked = stored.loggingEnabled === true;
    void hasFirefoxDataConsent().then(permitted => {
      $('integrityLookupsEnabledOptions').checked = stored.integrityLookupsEnabled === true && permitted;
    }).catch(() => {
      $('integrityLookupsEnabledOptions').checked = false;
    });
    if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== api.SCHEMA_VERSION) {
      chrome.storage.sync.set({ publisherWatchlist: watchlist });
    }
  });
}

document.addEventListener('DOMContentLoaded', load);
