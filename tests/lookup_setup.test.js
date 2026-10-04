'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const source = fs.readFileSync(require.resolve('../popup_lookup_setup.js'), 'utf8');

async function setup({ settings = {}, dismissed = false, firefox = false, permitted = true } = {}) {
  const { document } = parseHTML(fs.readFileSync(require.resolve('../popup.html'), 'utf8'));
  let ready;
  let changed;
  let rescans = 0;
  let permissionRequests = 0;
  const writes = [];
  const local = { notandiaLookupSetupDismissed: dismissed };
  document.addEventListener = (_, fn) => { ready = fn; };
  document.getElementById('rescan').focus = () => {};
  document.getElementById('rescan').addEventListener('click', () => rescans++);
  const context = {
    document,
    chrome: {
      runtime: { getManifest: () => firefox ? { browser_specific_settings: { gecko: { data_collection_permissions: { optional: ['websiteContent'] } } } } : {} },
      storage: {
        local: { get: async () => local, set: async value => Object.assign(local, value) },
        sync: { get: async defaults => ({ ...defaults, ...settings }), set: async value => { writes.push(value); Object.assign(settings, value); } },
        onChanged: { addListener: fn => { changed = fn; } }
      }
    },
    browser: { permissions: { request: async value => { permissionRequests++; assert.deepEqual(Array.from(value.data_collection), ['websiteContent']); return permitted; } } }
  };
  vm.runInNewContext(source, context);
  await ready();
  const click = async id => {
    document.getElementById(id).click();
    await new Promise(resolve => setImmediate(resolve));
  };
  return { document, settings, writes, local, click, changed, rescans: () => rescans, permissionRequests: () => permissionRequests };
}

test('first popup opening recommends lookup setup without enabling network requests', async () => {
  const s = await setup();
  assert.equal(s.document.getElementById('lookupSetup').hidden, false);
  assert.equal(s.writes.length, 0);
  assert.equal(s.permissionRequests(), 0);
  assert.equal(s.rescans(), 0);
});

test('explicit setup enables both providers, leaves other settings alone and starts a rescan', async () => {
  const settings = { integrityLookupsEnabled: false, ncbiApiEnabled: false, loggingEnabled: true };
  const s = await setup({ settings });
  await s.click('enableRecommendedChecks');
  assert.equal(settings.integrityLookupsEnabled, true);
  assert.equal(settings.ncbiApiEnabled, true);
  assert.equal(settings.loggingEnabled, true);
  assert.equal(s.document.getElementById('integrityLookupsEnabled').checked, true);
  assert.equal(s.document.getElementById('ncbiApiEnabledPopup').checked, true);
  assert.equal(s.local.notandiaLookupSetupDismissed, true);
  assert.equal(s.document.getElementById('lookupSetup').hidden, true);
  assert.equal(s.rescans(), 1);
});

test('keeping current settings preserves an explicit disabled choice and remembers dismissal', async () => {
  const settings = { integrityLookupsEnabled: false, ncbiApiEnabled: true };
  const s = await setup({ settings });
  assert.equal(s.document.getElementById('lookupSetup').hidden, false);
  await s.click('keepLookupSettings');
  assert.equal(settings.integrityLookupsEnabled, false);
  assert.equal(settings.ncbiApiEnabled, true);
  assert.equal(s.writes.length, 0);
  assert.equal(s.local.notandiaLookupSetupDismissed, true);
  for (const options of [{ dismissed: true }, { settings: { integrityLookupsEnabled: true, ncbiApiEnabled: true } }]) {
    assert.equal((await setup(options)).document.getElementById('lookupSetup').hidden, true);
  }
});

test('Firefox optional data permission is requested only by the enable action and denial preserves settings', async () => {
  for (const permitted of [false, true]) {
    const s = await setup({ firefox: true, permitted });
    assert.equal(s.permissionRequests(), 0);
    await s.click('enableRecommendedChecks');
    assert.equal(s.permissionRequests(), 1);
    assert.equal(s.writes.length, permitted ? 1 : 0);
    assert.equal(s.rescans(), permitted ? 1 : 0);
    assert.equal(s.document.getElementById('lookupSetup').hidden, permitted);
    if (!permitted) {
      assert.match(s.document.getElementById('lookupSetupStatus').textContent, /settings are unchanged/);
      assert.equal(s.document.getElementById('enableRecommendedChecks').disabled, false);
    }
  }
});

test('existing service toggles are the only lookup controls and withdrawal does not repeat setup', async () => {
  const settings = { integrityLookupsEnabled: true, ncbiApiEnabled: true };
  const s = await setup({ settings, dismissed: true });
  assert.equal(s.document.getElementById('externalChecksControls'), null);
  assert.equal(s.document.getElementById('disableExternalChecks'), null);
  assert.ok(s.document.getElementById('integrityLookupsEnabled'));
  assert.ok(s.document.getElementById('ncbiApiEnabledPopup'));
  settings.integrityLookupsEnabled = settings.ncbiApiEnabled = false;
  s.changed({ integrityLookupsEnabled: { newValue: false }, ncbiApiEnabled: { newValue: false } }, 'sync');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.document.getElementById('lookupSetup').hidden, true);
});

test('upgrades preserve all saved combinations and only offer setup when needed', async () => {
  for (const integrityLookupsEnabled of [false, true]) {
    for (const ncbiApiEnabled of [false, true]) {
      const settings = { integrityLookupsEnabled, ncbiApiEnabled, loggingEnabled: true };
      const s = await setup({ settings });
      assert.equal(s.writes.length, 0, 'opening the updated popup must not change a saved choice');
      assert.equal(settings.integrityLookupsEnabled, integrityLookupsEnabled);
      assert.equal(settings.ncbiApiEnabled, ncbiApiEnabled);
      assert.equal(s.document.getElementById('lookupSetup').hidden, integrityLookupsEnabled && ncbiApiEnabled);
      assert.equal(s.document.getElementById('lookupCurrentSettings').textContent, `Current settings: Crossref ${integrityLookupsEnabled ? 'on' : 'off'}; NCBI ${ncbiApiEnabled ? 'on' : 'off'}.`);
    }
  }
});

test('saving individual checks preserves mixed choices and completes setup', async () => {
  for (const [integrityEnabled, ncbiEnabled] of [[true, false], [false, true], [false, false]]) {
    const { document, Event } = parseHTML(fs.readFileSync(require.resolve('../options.html'), 'utf8'));
    let stored = { integrityLookupsEnabled: true, ncbiApiEnabled: true, loggingEnabled: true };
    let dismissed = false;
    let requested = 0;
    let removed = 0;
    const sandbox = {
      document, NotandiaPublisherProfiles: require('../shared/publisher_profiles.js'), setTimeout: () => {},
      browser: { permissions: {
        getAll: async () => ({data_collection:['websiteContent']}),
        request: async () => { requested++; return true; },
        remove: async () => { removed++; }
      } },
      chrome: {
        runtime: { getManifest: () => ({browser_specific_settings:{gecko:{data_collection_permissions:{optional:['websiteContent']}}}}) },
        storage: {
          sync: { get: (defaults, cb) => cb({...defaults,...stored}), set: (values, cb) => { stored = {...stored,...values}; cb?.(); } },
          local: { set: (values, cb) => { dismissed = values.notandiaLookupSetupDismissed; cb?.(); } }
        }
      }
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../options.js'), 'utf8'), sandbox);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setImmediate(resolve));
    document.getElementById('integrityLookupsEnabledOptions').checked = integrityEnabled;
    document.getElementById('ncbiApiEnabledOptions').checked = ncbiEnabled;
    document.getElementById('save').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored.integrityLookupsEnabled, integrityEnabled);
    assert.equal(stored.ncbiApiEnabled, ncbiEnabled);
    assert.equal(stored.loggingEnabled, true);
    assert.equal(dismissed, true);
    assert.equal(requested, integrityEnabled || ncbiEnabled ? 1 : 0);
    assert.equal(removed, integrityEnabled || ncbiEnabled ? 0 : 1);
  }
});
