'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function write(file, content) { fs.writeFileSync(path.join(root, file), content.endsWith('\n') ? content : `${content}\n`); }
function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`Ambiguous patch target: ${label}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function patchBackground() {
  let source = read('background.js');
  source = replaceOnce(source,
`if (!globalThis.MDPIIntegrity && typeof importScripts === 'function') importScripts('shared/integrity.js');
const integrityApi = globalThis.MDPIIntegrity;
if (!integrityApi) throw new Error('Integrity runtime failed to load');`,
`if (typeof importScripts === 'function') {
  if (!globalThis.NotandiaPublisherProfiles) importScripts('shared/publisher_profiles.js');
  if (!globalThis.MDPIIntegrity) importScripts('shared/integrity.js');
}
const publisherApi = globalThis.NotandiaPublisherProfiles;
const integrityApi = globalThis.MDPIIntegrity;
if (!publisherApi) throw new Error('Publisher profile runtime failed to load');
if (!integrityApi) throw new Error('Integrity runtime failed to load');`, 'background imports');

  source = replaceOnce(source,
`  normalizeCrossrefEvents,
  normalizeDOI,`,
`  normalizeCrossrefEvents,
  normalizeCrossrefUpdateRecords,
  normalizeDOI,`, 'Crossref update import');

  source = replaceOnce(source,
`const activeIntegrityScans = new Map();`,
`const activeIntegrityScans = new Map();
const publisherTabData = new Map();
let publisherSettings = publisherApi.defaultSettings();`, 'publisher maps');

  source = replaceOnce(source,
`const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
const SAFE_COLOR`,
`const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
const SAFE_PROFILE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_COLOR`, 'profile id constant');

  source = replaceOnce(source,
`  return Array.from(unique.values());
}

function setBadge`,
`  return Array.from(unique.values());
}

function normalizePublisherMatch(match) {
  if (!match || typeof match !== 'object') return null;
  const profileId = String(match.profileId || '').toLowerCase();
  if (!SAFE_PROFILE_ID.test(profileId)) return null;
  const profile = publisherApi.profileMap(publisherSettings).get(profileId);
  if (!profile?.enabled) return null;
  const reasons = Array.isArray(match.reasons)
    ? match.reasons.map(value => String(value).slice(0, 40)).filter(value => /^[a-z0-9-]+$/i.test(value)).slice(0, 6)
    : [];
  return {
    profileId,
    profileName: String(profile.name || match.profileName || profileId).slice(0, 80),
    confidence: match.confidence === 'potential' ? 'potential' : 'confirmed',
    reasons,
    action: profile.action,
    color: profile.color
  };
}

function normalizePublisherRecord(record, index, kind) {
  if (!record || typeof record !== 'object') return null;
  const id = typeof record.id === 'string' && SAFE_REFERENCE_ID.test(record.id) ? record.id : \`notandia-\${kind}-\${index + 1}\`;
  const matches = Array.isArray(record.matches) ? record.matches.map(normalizePublisherMatch).filter(Boolean) : [];
  if (!matches.length) return null;
  return {
    id,
    kind,
    number: Number.isFinite(record.number) ? Math.max(1, Math.trunc(record.number)) : index + 1,
    doi: normalizeDOI(record.doi || ''),
    text: String(record.text || '').replace(/\\s+/g, ' ').trim().slice(0, MAX_REFERENCE_TEXT_LENGTH),
    matches
  };
}

function summarizePublisherContext(report) {
  const records = [report.currentArticle, ...(report.references || []), ...(report.searchResults || [])].filter(Boolean);
  const actionable = records.filter(record => (record.matches || []).some(match => match.action !== 'none'));
  const allMatches = records.flatMap(record => record.matches || []);
  const visual = publisherApi.resolveVisualMatch(allMatches);
  const profileCounts = {};
  for (const match of allMatches) profileCounts[match.profileId] = (profileCounts[match.profileId] || 0) + 1;
  return {
    matchedItems: records.filter(record => (record.matches || []).length).length,
    actionableItems: actionable.length,
    primaryColor: visual?.color || '#48627A',
    profileCounts
  };
}

function normalizePublisherContext(data) {
  const currentMatches = Array.isArray(data?.currentArticle?.matches)
    ? data.currentArticle.matches.map(normalizePublisherMatch).filter(Boolean)
    : [];
  const report = {
    currentArticle: currentMatches.length ? {
      kind: 'current-article',
      id: 'current-article',
      number: null,
      doi: normalizeDOI(data?.currentArticle?.doi || ''),
      text: 'Current article',
      matches: currentMatches
    } : null,
    references: (Array.isArray(data?.references) ? data.references : []).slice(0, MAX_INTEGRITY_REFERENCES)
      .map((record, index) => normalizePublisherRecord(record, index, 'reference')).filter(Boolean),
    searchResults: (Array.isArray(data?.searchResults) ? data.searchResults : []).slice(0, MAX_INTEGRITY_REFERENCES)
      .map((record, index) => normalizePublisherRecord(record, index, 'search-result')).filter(Boolean),
    updatedAt: new Date().toISOString()
  };
  report.summary = summarizePublisherContext(report);
  return report;
}

function mergeLegacyMdpiContext(tabId, references) {
  if (!Number.isInteger(tabId)) return;
  const mdpi = publisherApi.profileMap(publisherSettings).get('mdpi');
  if (!mdpi?.enabled) return;
  const report = publisherTabData.get(tabId) || { currentArticle: null, references: [], searchResults: [], updatedAt: new Date().toISOString() };
  const byKey = new Map((report.references || []).map(record => [record.doi ? \`doi:\${record.doi}\` : \`id:\${record.id}\`, record]));
  for (const [index, reference] of (Array.isArray(references) ? references : []).entries()) {
    const key = reference.doi ? \`doi:\${reference.doi}\` : \`id:\${reference.id}\`;
    const existing = byKey.get(key) || {
      id: reference.id,
      kind: 'reference',
      number: Number.isFinite(reference.number) ? reference.number : index + 1,
      doi: reference.doi || null,
      text: reference.text,
      matches: []
    };
    if (!existing.matches.some(match => match.profileId === 'mdpi')) {
      existing.matches.push({
        profileId: 'mdpi', profileName: mdpi.name, confidence: 'confirmed',
        reasons: ['legacy-mdpi-detector'], action: mdpi.action, color: mdpi.color
      });
    }
    byKey.set(key, existing);
  }
  report.references = Array.from(byKey.values());
  report.updatedAt = new Date().toISOString();
  report.summary = summarizePublisherContext(report);
  publisherTabData.set(tabId, report);
}

function setBadge`, 'publisher normalization');

  source = source.replace(/function setBadge\(tabId, count, color = '#E2211C', title = 'MDPI Filter'\)/, "function setBadge(tabId, count, color = '#E2211C', title = 'Notandia')");
  source = source.replace(/title: String\(title \|\| 'MDPI Filter'\)/, "title: String(title || 'Notandia')");

  const refreshStart = source.indexOf('function refreshBadge(tabId) {');
  const refreshEnd = source.indexOf('\nfunction cancelIntegrityScan', refreshStart);
  if (refreshStart < 0 || refreshEnd < 0) throw new Error('Missing refreshBadge block');
  source = source.slice(0, refreshStart) + `function refreshBadge(tabId) {
  if (!Number.isInteger(tabId)) return;
  const integrity = integrityTabData.get(tabId);
  if (integrity?.summary?.affected > 0) {
    const badge = badgeForSummary(integrity.summary);
    setBadge(tabId, badge.count, badge.color, badge.title);
    return;
  }
  const publisher = publisherTabData.get(tabId);
  if (publisher?.summary?.actionableItems > 0) {
    setBadge(tabId, publisher.summary.actionableItems, publisher.summary.primaryColor, \`\${publisher.summary.actionableItems} publisher watchlist match\${publisher.summary.actionableItems === 1 ? '' : 'es'}\`);
    return;
  }
  const legacy = legacyBadgeData.get(tabId);
  setBadge(tabId, legacy?.count || 0, legacy?.color || '#E2211C', 'Notandia');
}
` + source.slice(refreshEnd);

  source = replaceOnce(source,
`  integrityTabData.delete(tabId);
  setBadge(tabId, 0);`,
`  integrityTabData.delete(tabId);
  publisherTabData.delete(tabId);
  setBadge(tabId, 0);`, 'clear publisher tab');

  const fetchStart = source.indexOf('async function fetchCrossrefRecord(doi, scan) {');
  const fetchEnd = source.indexOf('\nasync function mapWithConcurrency', fetchStart);
  if (fetchStart < 0 || fetchEnd < 0) throw new Error('Missing fetchCrossrefRecord block');
  source = source.slice(0, fetchStart) + `async function fetchCrossrefJson(url, controller) {
  await waitForCrossrefStart();
  const response = await fetch(url, {
    method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' }, signal: controller.signal
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(\`Crossref returned HTTP \${response.status}\`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('json')) throw new Error('Crossref returned a non-JSON response');
  return response.json();
}

async function fetchCrossrefRecord(doi, scan) {
  const cached = integrityCache.get(doi);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (scan.cancelled) return { lookupStatus: 'cancelled', events: [] };
  const controller = new AbortController();
  scan.controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), CROSSREF_TIMEOUT_MS);
  try {
    const singletonPayload = await fetchCrossrefJson(\`https://api.crossref.org/works/\${encodeURIComponent(doi)}\`, controller);
    if (scan.cancelled) return { lookupStatus: 'cancelled', events: [] };
    let events = normalizeCrossrefEvents(singletonPayload?.message);
    if (!events.length) {
      const updatesPayload = await fetchCrossrefJson(\`https://api.crossref.org/works?filter=updates:\${encodeURIComponent(doi)}&rows=100\`, controller);
      events = normalizeCrossrefUpdateRecords(updatesPayload?.message?.items, doi);
    }
    const value = { lookupStatus: singletonPayload || events.length ? 'checked' : 'not-found', events };
    integrityCache.set(doi, { expiresAt: Date.now() + CROSSREF_CACHE_MS, value });
    return value;
  } catch (error) {
    if (scan.cancelled || error?.name === 'AbortError') return { lookupStatus: 'cancelled', events: [] };
    return { lookupStatus: 'failed', events: [], error: error instanceof Error ? error.message.slice(0, 160) : 'Crossref lookup failed' };
  } finally {
    clearTimeout(timeout);
    scan.controllers.delete(controller);
  }
}
` + source.slice(fetchEnd);

  source = replaceOnce(source,
`    storeTabReferences(tabId, references, count, data.color);
    sendResponse`,
`    const normalized = storeTabReferences(tabId, references, count, data.color);
    mergeLegacyMdpiContext(tabId, normalized);
    refreshBadge(tabId);
    sendResponse`, 'mdpi update merge');

  source = replaceOnce(source,
`      const normalized = storeTabReferences(tabId, message.references, message.references?.length, message.color);
      sendResponse`,
`      const normalized = storeTabReferences(tabId, message.references, message.references?.length, message.color);
      mergeLegacyMdpiContext(tabId, normalized);
      refreshBadge(tabId);
      sendResponse`, 'reference update merge');

  source = replaceOnce(source,
`  if (message.type === 'getMdpiReferences') {`,
`  if (message.type === 'publisherContextUpdate') {
    const tabId = sender.tab?.id;
    if (Number.isInteger(tabId)) {
      publisherTabData.set(tabId, normalizePublisherContext(message.data || {}));
      mergeLegacyMdpiContext(tabId, tabData.get(tabId) || []);
      refreshBadge(tabId);
      chrome.runtime.sendMessage({ type: 'publisherContextUpdated', tabId }, () => void chrome.runtime.lastError);
    }
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.type === 'getPublisherContext') {
    getActiveTab().then(tab => {
      const report = Number.isInteger(tab?.id) ? publisherTabData.get(tab.id) : null;
      sendResponse({ report: report || null, settings: publisherSettings });
    }).catch(() => sendResponse({ report: null, settings: publisherSettings }));
    return true;
  }

  if (message.type === 'getMdpiReferences') {`, 'publisher handlers');

  source = replaceOnce(source,
`chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {`,
`function refreshPublisherSettings() {
  chrome.storage.sync.get({
    publisherWatchlist: null,
    mode: 'highlight',
    highlightPotentialMdpiSites: true,
    potentialMdpiHighlightColor: '#E2211C'
  }, stored => {
    if (chrome.runtime.lastError) return;
    publisherSettings = publisherApi.migrateLegacySettings(stored);
    if (!stored.publisherWatchlist || stored.publisherWatchlist.schemaVersion !== publisherApi.SCHEMA_VERSION) {
      chrome.storage.sync.set({ publisherWatchlist: publisherSettings });
    }
    for (const tabId of publisherTabData.keys()) {
      const report = publisherTabData.get(tabId);
      publisherTabData.set(tabId, normalizePublisherContext(report || {}));
      mergeLegacyMdpiContext(tabId, tabData.get(tabId) || []);
      refreshBadge(tabId);
    }
  });
}

refreshPublisherSettings();
chrome.runtime.onInstalled.addListener(refreshPublisherSettings);
chrome.runtime.onStartup.addListener(refreshPublisherSettings);
chrome.storage.onChanged.addListener(changes => {
  if (changes.publisherWatchlist || changes.mode || changes.highlightPotentialMdpiSites || changes.potentialMdpiHighlightColor) refreshPublisherSettings();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {`, 'publisher settings initialization');

  write('background.js', source);
}

function patchIntegrity() {
  let source = read('shared/integrity.js');
  source = replaceOnce(source,
`  function derivePrimaryStatus(events) {`,
`  function normalizeCrossrefUpdateRecords(items, queriedDoi) {
    const targetDoi = normalizeDOI(queriedDoi || '');
    if (!targetDoi || !Array.isArray(items)) return [];
    const updatedBy = [];
    for (const item of items.slice(0, 100)) {
      if (!item || typeof item !== 'object') continue;
      const noticeDoi = normalizeDOI(item.DOI || item.doi || '');
      const relations = Array.isArray(item['update-to']) ? item['update-to'] : [];
      for (const relation of relations) {
        if (!relation || normalizeDOI(relation.DOI || relation.doi || '') !== targetDoi) continue;
        updatedBy.push({
          DOI: noticeDoi,
          type: relation.type,
          label: relation.label,
          source: relation.source || item.source || 'crossref',
          'record-id': relation['record-id'] ?? relation.recordId ?? null,
          updated: relation.updated || item.updated || item.created || item.published || null,
          date: relation.date || item?.published?.['date-time'] || item?.created?.['date-time'] || null
        });
      }
    }
    return normalizeCrossrefEvents({ 'updated-by': updatedBy });
  }

  function derivePrimaryStatus(events) {`, 'reverse update normalizer');
  source = replaceOnce(source,
`    normalizeCrossrefEvents,
    normalizeDOI,`,
`    normalizeCrossrefEvents,
    normalizeCrossrefUpdateRecords,
    normalizeDOI,`, 'integrity export');
  write('shared/integrity.js', source);

  let test = read('tests/integrity.test.js');
  test = replaceOnce(test,
`  normalizeCrossrefEvents,
  normalizeDOI,`,
`  normalizeCrossrefEvents,
  normalizeCrossrefUpdateRecords,
  normalizeDOI,`, 'test import');
  test = replaceOnce(test,
`test('reinstatement supersedes an older retraction without deleting history', () => {`,
`test('Crossref reverse update records classify the original work', () => {
  const events = normalizeCrossrefUpdateRecords([{
    DOI: '10.1038/s41586-024-07653-0',
    'update-to': [{ DOI: '10.1038/nature00870', type: 'retraction', source: 'retraction-watch', 'record-id': 123 }],
    created: { 'date-time': '2024-07-01T00:00:00Z' }
  }], '10.1038/nature00870');
  assert.equal(events.length, 1);
  assert.equal(events[0].status, 'retracted');
  assert.equal(events[0].noticeDoi, '10.1038/s41586-024-07653-0');
});

test('reinstatement supersedes an older retraction without deleting history', () => {`, 'reverse update test');
  test = test.replace("assert.deepEqual(firefox.background.scripts.slice(0, 2), ['shared/integrity.js', 'background.js']);", "assert.deepEqual(firefox.background.scripts.slice(0, 3), ['shared/publisher_profiles.js', 'shared/integrity.js', 'background.js']);");
  write('tests/integrity.test.js', test);
}

function patchContentScript() {
  let source = read('content/content_script.js');
  source = replaceOnce(source,
`    if (typeof window.MDPIFilterDomains === 'undefined') {`,
`    if (!window.NotandiaPublisherProfiles) {
      missingDependencies.push("NotandiaPublisherProfiles (from shared/publisher_profiles.js)");
      dependenciesMet = false;
    }
    if (typeof window.MDPIFilterDomains === 'undefined') {`, 'profile dependency');

  source = replaceOnce(source,
`      let currentRunSettings = {
          mode: 'highlight', // Default
          mdpiDomains: MDPI_DOMAINS_CONST,
          mdpiDoiPrefix: MDPI_DOI_CONST,
          highlightPotentialMdpiSites: true // ADD THIS - Enable potential highlighting by default
      };
      // ---`,
`      let currentRunSettings = {
        mode: 'highlight',
        mdpiDomains: MDPI_DOMAINS_CONST,
        mdpiDoiPrefix: MDPI_DOI_CONST,
        highlightPotentialMdpiSites: true,
        publisherWatchlist: window.NotandiaPublisherProfiles.defaultSettings(),
        mdpiProfile: window.NotandiaPublisherProfiles.defaultSettings().profiles.find(profile => profile.id === 'mdpi')
      };

      function applyPublisherSettings(stored) {
        const watchlist = window.NotandiaPublisherProfiles.migrateLegacySettings(stored || {});
        const mdpi = watchlist.profiles.find(profile => profile.id === 'mdpi') || { enabled: false, action: 'none', color: '#E2211C', confidencePolicy: 'confirmed-only' };
        currentRunSettings.publisherWatchlist = watchlist;
        currentRunSettings.mdpiProfile = mdpi;
        currentRunSettings.mode = mdpi.action === 'hide' ? 'hide' : 'highlight';
        currentRunSettings.highlightPotentialMdpiSites = mdpi.confidencePolicy === 'confirmed-and-potential';
        return mdpi;
      }

      function getMdpiProfile() {
        return currentRunSettings.mdpiProfile || { enabled: false, action: 'none', color: '#E2211C', confidencePolicy: 'confirmed-only' };
      }

      function removeMdpiProfileBadge(item) {
        item?.querySelectorAll?.(':scope > .notandia-mdpi-profile-badge').forEach(node => node.remove());
      }

      function ensureMdpiProfileBadge(item, profile) {
        removeMdpiProfileBadge(item);
        if (!item || !profile?.enabled || profile.action === 'none') return;
        const badge = document.createElement('span');
        badge.className = 'notandia-mdpi-profile-badge';
        badge.textContent = 'MDPI';
        badge.style.cssText = \`display:inline-flex;align-items:center;border:1px solid \${profile.color};color:\${profile.color};background:#fff;border-radius:999px;padding:2px 6px;margin:3px 4px 4px 0;font:600 11px/1.2 system-ui,sans-serif;\`;
        item.prepend(badge);
      }
      // ---`, 'current settings');

  const styleStart = source.indexOf('      function styleSearchItem(item, isMdpi, isPotential, settings, activeConfig, source) {');
  const styleEnd = source.indexOf('\n      function unstyleSearchItem', styleStart);
  if (styleStart < 0 || styleEnd < 0) throw new Error('Missing styleSearchItem block');
  source = source.slice(0, styleStart) + `      function styleSearchItem(item, isMdpi, isPotential, settings, activeConfig, source) {
        if (!item) return;
        let highlightTarget = item;
        const profile = getMdpiProfile();
        if (activeConfig?.highlightTargetSelector) highlightTarget = item.querySelector(activeConfig.highlightTargetSelector) || item;
        highlightTarget.classList.remove('mdpi-highlighted-reference', 'mdpi-potential-reference', 'mdpi-hidden-reference', 'mdpi-highlighted-google', 'mdpi-potential-google');
        for (const property of ['border', 'border-left', 'padding-left', 'background-color', 'display', 'outline', 'opacity']) highlightTarget.style.removeProperty(property);
        item.style.removeProperty('display');
        item.style.removeProperty('opacity');
        removeMdpiProfileBadge(item);
        if (!profile.enabled || (!isMdpi && !(isPotential && profile.confidencePolicy === 'confirmed-and-potential'))) return;
        ensureMdpiProfileBadge(item, profile);
        if (profile.action === 'none' || profile.action === 'badge') return;
        if (profile.action === 'hide') {
          item.classList.add('mdpi-hidden-reference');
          item.style.setProperty('display', 'none', 'important');
        } else if (profile.action === 'dim') {
          item.style.setProperty('opacity', '0.45', 'important');
        } else {
          highlightTarget.classList.add(isMdpi ? 'mdpi-highlighted-reference' : 'mdpi-potential-reference');
          highlightTarget.style.setProperty('border-left', \`4px \${isPotential ? 'dashed' : 'solid'} \${profile.color}\`, 'important');
          highlightTarget.style.setProperty('padding-left', '8px', 'important');
          highlightTarget.style.setProperty('background-color', \`color-mix(in srgb, \${profile.color} 8%, transparent)\`, 'important');
        }
      }
` + source.slice(styleEnd);

  source = source.replace("        targetToUnstyle.style.outline = '';", "        targetToUnstyle.style.outline = '';\n        targetToUnstyle.style.opacity = '';\n        removeMdpiProfileBadge(item);");

  source = replaceOnce(source,
`        globalCollectedMdpiReferences = []; // Reset for this processing run`,
`        globalCollectedMdpiReferences = []; // Reset for this processing run
        const activeMdpiProfile = getMdpiProfile();
        if (!activeMdpiProfile.enabled) {
          if (window.MDPIFilterUtils?.styleInlineFootnotes) window.MDPIFilterUtils.styleInlineFootnotes([], activeMdpiProfile.color);
          return;
        }`, 'disable MDPI references');
  source = source.replace("          const mdpiColor = '#E2211C'; // MDPI Red, or pull from settings if configurable", "          const mdpiColor = activeMdpiProfile.color;");

  source = replaceOnce(source,
`        chrome.storage.sync.get({ 
          mode: 'highlight',
          highlightPotentialMdpiSites: true
        }, (retrievedStorageSettings) => {`,
`        chrome.storage.sync.get({
          publisherWatchlist: null,
          mode: 'highlight',
          highlightPotentialMdpiSites: true,
          potentialMdpiHighlightColor: '#E2211C'
        }, (retrievedStorageSettings) => {`, 'first storage defaults');
  source = replaceOnce(source,
`            currentRunSettings.mode = retrievedStorageSettings.mode;
            currentRunSettings.highlightPotentialMdpiSites = retrievedStorageSettings.highlightPotentialMdpiSites; // ADD THIS`,
`            applyPublisherSettings(retrievedStorageSettings);`, 'first settings apply');

  source = replaceOnce(source,
`        chrome.storage.sync.get({ mode: 'highlight' }, (retrievedStorageSettings) => {`,
`        chrome.storage.sync.get({
          publisherWatchlist: null,
          mode: 'highlight',
          highlightPotentialMdpiSites: true,
          potentialMdpiHighlightColor: '#E2211C'
        }, (retrievedStorageSettings) => {`, 'second storage defaults');
  source = replaceOnce(source,
`            currentRunSettings.mode = retrievedStorageSettings.mode;`,
`            applyPublisherSettings(retrievedStorageSettings);`, 'second settings apply');
  source = source.replace("          const mdpiColor = '#E2211C';", "          let mdpiColor = getMdpiProfile().color;");

  const refStart = source.indexOf('          function styleRef(item, refId, config) {');
  const refEnd = source.indexOf('\n          const isMdpiItemByContent', refStart);
  if (refStart < 0 || refEnd < 0) throw new Error('Missing styleRef block');
  source = source.slice(0, refStart) + `          function styleRef(item, refId, config) {
            if (!item || typeof item.setAttribute !== 'function') return;
            let highlightTarget = item;
            if (config?.highlightTargetSelector) highlightTarget = item.querySelector(config.highlightTargetSelector) || item;
            highlightTarget.setAttribute('data-mdpi-filter-ref-id', refId);
            const profile = getMdpiProfile();
            removeMdpiProfileBadge(item);
            item.classList.remove('mdpi-hidden-reference', 'mdpi-highlighted-reference');
            for (const property of ['display', 'opacity', 'border-left', 'padding-left', 'background-color']) item.style.removeProperty(property);
            if (!profile.enabled) return;
            ensureMdpiProfileBadge(item, profile);
            if (profile.action === 'none' || profile.action === 'badge') return;
            if (profile.action === 'hide') {
              item.classList.add('mdpi-hidden-reference');
              item.style.setProperty('display', 'none', 'important');
            } else if (profile.action === 'dim') {
              item.style.setProperty('opacity', '0.45', 'important');
            } else {
              item.classList.add('mdpi-highlighted-reference');
              highlightTarget.style.setProperty('border-left', \`4px solid \${profile.color}\`, 'important');
              highlightTarget.style.setProperty('padding-left', '8px', 'important');
              highlightTarget.style.setProperty('background-color', \`color-mix(in srgb, \${profile.color} 8%, transparent)\`, 'important');
            }
          }
` + source.slice(refEnd);

  source = source.replace('              const isMdpi = isMdpiItemByContent(itemElement, runCache, googleCheckerInstance);', '              const isMdpi = getMdpiProfile().enabled && isMdpiItemByContent(itemElement, runCache, googleCheckerInstance);');
  source = replaceOnce(source,
`              if (isMdpi || isPotentialMdpi) {`,
`              const activeMdpiProfile = getMdpiProfile();
              if (!activeMdpiProfile.enabled) { isMdpi = false; isPotentialMdpi = false; }
              mdpiColor = activeMdpiProfile.color;
              if (isMdpi || isPotentialMdpi) {`, 'search profile gate');
  source = source.replace("              window.MDPIFilterUtils.styleInlineFootnotes(collectedMdpiReferences, mdpiColor);", "              const mdpiProfile = getMdpiProfile();\n              window.MDPIFilterUtils.styleInlineFootnotes(mdpiProfile.enabled && mdpiProfile.action === 'highlight' ? collectedMdpiReferences : [], mdpiProfile.color);");
  source = source.replace("              el.style.outline = ''; ", "              el.style.outline = '';\n              el.style.opacity = '';\n              removeMdpiProfileBadge(el); ");

  source = replaceOnce(source,
`          // --- Initial Execution ---`,
`          chrome.storage.onChanged.addListener(changes => {
            if (!(changes.publisherWatchlist || changes.mode || changes.highlightPotentialMdpiSites || changes.potentialMdpiHighlightColor)) return;
            chrome.storage.sync.get({
              publisherWatchlist: null,
              mode: 'highlight',
              highlightPotentialMdpiSites: true,
              potentialMdpiHighlightColor: '#E2211C'
            }, stored => {
              if (chrome.runtime.lastError) return;
              applyPublisherSettings(stored);
              mdpiColor = getMdpiProfile().color;
              runAll(currentRunSettings);
            });
          });

          // --- Initial Execution ---`, 'settings change listener');
  write('content/content_script.js', source);
}

patchBackground();
patchIntegrity();
patchContentScript();
console.log('Publisher watchlist runtime patches applied.');
