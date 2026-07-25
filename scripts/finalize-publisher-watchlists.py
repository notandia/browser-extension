from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_exact(source: str, old: str, new: str, label: str, expected: int = 1) -> str:
    count = source.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected} occurrence(s), found {count}")
    return source.replace(old, new)


def replace_regex(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, source, flags=re.MULTILINE | re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, found {count}")
    return updated


# --- Background: reverse Crossref updates and badge precedence ---
background = read("background.js")
background = replace_exact(
    background,
    "  normalizeCrossrefEvents,\n  normalizeDOI,",
    "  normalizeCrossrefEvents,\n  normalizeCrossrefUpdateRecords,\n  normalizeDOI,",
    "integrity destructuring",
)
background = replace_exact(
    background,
    "function setBadge(tabId, count, color = '#E2211C', title = 'MDPI Filter') {",
    "function setBadge(tabId, count, color = '#E2211C', title = 'Notandia') {",
    "badge default title",
)
background = replace_exact(
    background,
    "chrome.action.setTitle({ tabId, title: String(title || 'MDPI Filter').slice(0, 200) });",
    "chrome.action.setTitle({ tabId, title: String(title || 'Notandia').slice(0, 200) });",
    "badge fallback title",
)
background = replace_regex(
    background,
    r"function refreshBadge\(tabId\) \{.*?\n\}\n\nfunction cancelIntegrityScan",
    """function refreshBadge(tabId) {
  if (!Number.isInteger(tabId)) return;
  const integrity = integrityTabData.get(tabId);
  if (integrity?.summary?.affected > 0) {
    const badge = badgeForSummary(integrity.summary);
    setBadge(tabId, badge.count, badge.color, badge.title);
    return;
  }
  const publisherBadge = globalThis.NotandiaPublisherBackground?.badgeForTab(tabId);
  if (publisherBadge) {
    setBadge(tabId, publisherBadge.count, publisherBadge.color, publisherBadge.title);
    return;
  }
  const legacy = legacyBadgeData.get(tabId);
  setBadge(tabId, legacy?.count || 0, legacy?.color || '#E2211C', 'Notandia');
}

globalThis.NotandiaRefreshBadge = refreshBadge;

function cancelIntegrityScan""",
    "refresh badge function",
)
background = replace_regex(
    background,
    r"async function fetchCrossrefRecord\(doi, scan\) \{.*?\n\}\n\nasync function mapWithConcurrency",
    """async function fetchCrossrefJson(url, controller) {
  await waitForCrossrefStart();
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' },
    signal: controller.signal
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Crossref returned HTTP ${response.status}`);
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
    const singletonUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const singletonPayload = await fetchCrossrefJson(singletonUrl, controller);
    if (scan.cancelled) return { lookupStatus: 'cancelled', events: [] };

    let events = normalizeCrossrefEvents(singletonPayload?.message);
    if (!events.length) {
      const updatesUrl = `https://api.crossref.org/works?filter=updates:${encodeURIComponent(doi)}&rows=100`;
      const updatesPayload = await fetchCrossrefJson(updatesUrl, controller);
      events = normalizeCrossrefUpdateRecords(updatesPayload?.message?.items, doi);
    }

    const value = {
      lookupStatus: singletonPayload || events.length ? 'checked' : 'not-found',
      events
    };
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

async function mapWithConcurrency""",
    "Crossref lookup function",
)
write("background.js", background)

# --- Publisher background: let the integrated badge controller decide priority ---
publisher_background = read("publisher_background.js")
publisher_background = replace_exact(
    publisher_background,
    "      reportsByTab.set(tabId, report);\n      applyBadge(tabId);",
    "      reportsByTab.set(tabId, report);\n      if (typeof globalThis.NotandiaRefreshBadge === 'function') globalThis.NotandiaRefreshBadge(tabId);\n      else applyBadge(tabId);",
    "publisher badge delegation",
)
write("publisher_background.js", publisher_background)

# --- Legacy detector: preserve evidence collection but suppress legacy styling ---
content = read("content/content_script.js")
content = replace_exact(
    content,
    "          mdpiDoiPrefix: MDPI_DOI_CONST,\n          highlightPotentialMdpiSites: true // ADD THIS - Enable potential highlighting by default",
    "          mdpiDoiPrefix: MDPI_DOI_CONST,\n          highlightPotentialMdpiSites: true, // ADD THIS - Enable potential highlighting by default\n          publisherProfilesEnabled: false",
    "legacy settings object",
)
content = replace_exact(
    content,
    "        item.style.display = ''; // Ensure main item is visible if it was hidden\n      \n        if (settings.mode === 'hide' && isMdpi) {",
    "        item.style.display = ''; // Ensure main item is visible if it was hidden\n        if (settings.publisherProfilesEnabled) return;\n      \n        if (settings.mode === 'hide' && isMdpi) {",
    "search styling adapter",
)
content = replace_exact(
    content,
    "        if (window.MDPIFilterUtils && window.MDPIFilterUtils.styleInlineFootnotes) {",
    "        if (!currentRunSettings.publisherProfilesEnabled && window.MDPIFilterUtils && window.MDPIFilterUtils.styleInlineFootnotes) {",
    "first inline footnote adapter",
)
content = replace_exact(
    content,
    "          mode: 'highlight',\n          highlightPotentialMdpiSites: true\n        }, (retrievedStorageSettings) => {",
    "          mode: 'highlight',\n          highlightPotentialMdpiSites: true,\n          publisherProfiles: null\n        }, (retrievedStorageSettings) => {",
    "first storage defaults",
)
content = replace_exact(
    content,
    "            currentRunSettings.mode = retrievedStorageSettings.mode;\n            currentRunSettings.highlightPotentialMdpiSites = retrievedStorageSettings.highlightPotentialMdpiSites; // ADD THIS",
    "            currentRunSettings.mode = retrievedStorageSettings.mode;\n            currentRunSettings.highlightPotentialMdpiSites = retrievedStorageSettings.highlightPotentialMdpiSites; // ADD THIS\n            currentRunSettings.publisherProfilesEnabled = Boolean(retrievedStorageSettings.publisherProfiles);",
    "first storage assignment",
)
content = replace_exact(
    content,
    "        chrome.storage.sync.get({ mode: 'highlight' }, (retrievedStorageSettings) => {",
    "        chrome.storage.sync.get({ mode: 'highlight', publisherProfiles: null }, (retrievedStorageSettings) => {",
    "second storage defaults",
)
content = replace_exact(
    content,
    "            currentRunSettings.mode = retrievedStorageSettings.mode;\n          }\n\n          if (!(chrome.runtime && chrome.runtime.id)) {",
    "            currentRunSettings.mode = retrievedStorageSettings.mode;\n            currentRunSettings.publisherProfilesEnabled = Boolean(retrievedStorageSettings.publisherProfiles);\n          }\n\n          if (!(chrome.runtime && chrome.runtime.id)) {",
    "second storage assignment",
)
content = replace_exact(
    content,
    "            highlightTarget.setAttribute('data-mdpi-filter-ref-id', refId);\n\n            if (currentRunSettings.mode === 'hide') {",
    "            highlightTarget.setAttribute('data-mdpi-filter-ref-id', refId);\n            if (currentRunSettings.publisherProfilesEnabled) return;\n\n            if (currentRunSettings.mode === 'hide') {",
    "reference styling adapter",
)
content = replace_exact(
    content,
    "            if (typeof window.MDPIFilterUtils !== 'undefined' && typeof window.MDPIFilterUtils.styleInlineFootnotes === 'function') {",
    "            if (!currentRunSettings.publisherProfilesEnabled && typeof window.MDPIFilterUtils !== 'undefined' && typeof window.MDPIFilterUtils.styleInlineFootnotes === 'function') {",
    "second inline footnote adapter",
)
write("content/content_script.js", content)

# --- Integrity regression coverage and updated runtime contract ---
integrity_test = read("tests/integrity.test.js")
integrity_test = replace_exact(
    integrity_test,
    "  normalizeCrossrefEvents,\n  normalizeDOI,",
    "  normalizeCrossrefEvents,\n  normalizeCrossrefUpdateRecords,\n  normalizeDOI,",
    "integrity test import",
)
integrity_test = replace_exact(
    integrity_test,
    """  assert.equal(events[0].noticeDoi, '10.1000/notice');
});

test('reinstatement supersedes an older retraction without deleting history', () => {""",
    """  assert.equal(events[0].noticeDoi, '10.1000/notice');
});

test('Crossref reverse update records detect the retracted Nature reference', () => {
  const events = normalizeCrossrefUpdateRecords([{
    DOI: '10.1038/s41586-024-07653-0',
    'update-to': [{
      DOI: '10.1038/nature00870',
      type: 'retraction',
      source: 'crossref',
      updated: { 'date-time': '2024-06-18T00:00:00Z' }
    }]
  }], '10.1038/nature00870');
  assert.equal(events.length, 1);
  assert.equal(events[0].status, 'retracted');
  assert.equal(events[0].noticeDoi, '10.1038/s41586-024-07653-0');
});

test('reinstatement supersedes an older retraction without deleting history', () => {""",
    "reverse update regression insertion",
)
integrity_test = replace_regex(
    integrity_test,
    r"test\('integrity network behavior is explicit opt-in and cancellable'.*?\n\}\);\n\ntest\('all browser targets load the integrity runtime safely'",
    """test('integrity defaults distinguish new Chromium installs from existing users and Firefox', () => {
  const scanner = fs.readFileSync(path.join(root, 'content', 'integrity_scanner.js'), 'utf8');
  const popup = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
  const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  const publisherBackground = fs.readFileSync(path.join(root, 'publisher_background.js'), 'utf8');
  assert.match(scanner, /integrityLookupsEnabled:\s*false/);
  assert.match(scanner, /integrityLookupsEnabled !== true/);
  assert.match(publisherBackground, /reason === 'install'/);
  assert.match(publisherBackground, /updates\.integrityLookupsEnabled = !usesFirefoxDataConsent\(\)/);
  assert.match(publisherBackground, /reason === 'update'/);
  assert.match(publisherBackground, /updates\.integrityLookupsEnabled = false/);
  assert.match(background, /function cancelIntegrityScan/);
  assert.match(background, /controller\.abort\(\)/);
  assert.match(background, /hasIntegrityTransmissionConsent/);
  assert.match(background, /filter=updates:/);
  assert.match(popup, /permissions\.request\(\{ data_collection: \['websiteContent'\] \}\)/);
});

test('all browser targets load the integrity runtime safely'""",
    "integrity default policy test",
)
integrity_test = replace_exact(
    integrity_test,
    """  assert.equal(manifest.background.service_worker, 'background.js');
  assert.equal(Object.hasOwn(manifest.background, 'type'), false);
  assert.ok(manifest.content_scripts[0].js.includes('content/integrity_scanner.js'));
  assert.deepEqual(firefox.background.scripts.slice(0, 2), ['shared/integrity.js', 'background.js']);""",
    """  assert.equal(manifest.background.service_worker, 'service_worker.js');
  assert.equal(Object.hasOwn(manifest.background, 'type'), false);
  assert.ok(manifest.content_scripts[0].js.includes('content/integrity_scanner.js'));
  assert.ok(manifest.content_scripts[0].js.includes('content/publisher_scanner.js'));
  assert.deepEqual(firefox.background.scripts.slice(0, 4), [
    'shared/integrity.js',
    'shared/publisher_profiles.js',
    'publisher_background.js',
    'background.js'
  ]);""",
    "integrity runtime manifest expectations",
)
write("tests/integrity.test.js", integrity_test)

# --- Multi-browser package expectations ---
multi = read("tests/multi-browser.test.js")
multi = replace_exact(
    multi,
    "      assert.ok(manifest.content_scripts[0].js.includes('content/integrity_scanner.js'));",
    "      assert.ok(manifest.content_scripts[0].js.includes('content/integrity_scanner.js'));\n      assert.ok(manifest.content_scripts[0].js.includes('content/publisher_scanner.js'));",
    "multi-browser publisher scanner expectation",
)
multi = replace_exact(
    multi,
    """    assert.equal(chrome.background.service_worker, 'background.js');
    assert.equal(edge.background.service_worker, 'background.js');
    assert.deepEqual(firefox.background.scripts, ['shared/integrity.js', 'background.js']);""",
    """    assert.equal(chrome.background.service_worker, 'service_worker.js');
    assert.equal(edge.background.service_worker, 'service_worker.js');
    assert.deepEqual(firefox.background.scripts, [
      'shared/integrity.js',
      'shared/publisher_profiles.js',
      'publisher_background.js',
      'background.js'
    ]);""",
    "multi-browser background expectations",
)
multi = replace_exact(
    multi,
    """      assert.equal(fs.existsSync(path.join(DIST, target, 'background.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'shared', 'integrity.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'integrity_scanner.js')), true);""",
    """      assert.equal(fs.existsSync(path.join(DIST, target, 'background.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'publisher_background.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'shared', 'integrity.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'shared', 'publisher_profiles.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'integrity_scanner.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'publisher_scanner.js')), true);""",
    "multi-browser package files",
)
write("tests/multi-browser.test.js", multi)

# Remove this one-time migration mechanism before committing the product change.
(ROOT / ".github/workflows/finalize-publisher-watchlists.yml").unlink()
Path(__file__).unlink()
