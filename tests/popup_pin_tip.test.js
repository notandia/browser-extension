'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const source = fs.readFileSync(require.resolve('../popup_pin_tip.js'), 'utf8');
async function setup({ pinned = false, dismissed = false, unsupported = false, fail = false } = {}) {
  const { document } = parseHTML('<html><body><aside id="pinTip" hidden><p id="pinInstructions"></p><button id="dismissPinTip"></button></aside></body></html>');
  let ready, changed, saved;
  document.addEventListener = (_, fn) => { ready = fn; };
  const action = unsupported ? {} : {
    getUserSettings: async () => { if (fail) throw Error('unavailable'); return { isOnToolbar: pinned }; },
    onUserSettingsChanged: { addListener: fn => { changed = fn; } }
  };
  vm.runInNewContext(source, { document, navigator: { userAgent: 'Chrome/130' }, chrome: { action, storage: { local: {
    get: async () => ({ notandiaPinTipDismissed: dismissed }),
    set: async value => { saved = value.notandiaPinTipDismissed; }
  } } } });
  await ready();
  return { document, change: value => changed(value), saved: () => saved };
}
test('pin tip shows only for a confirmed unpinned action and remembers dismissal', async () => {
  const state = await setup();
  assert.equal(state.document.getElementById('pinTip').hidden, false);
  assert.match(state.document.getElementById('pinInstructions').textContent, /puzzle piece/);
  state.document.getElementById('dismissPinTip').click();
  assert.equal(state.document.getElementById('pinTip').hidden, true);
  assert.equal(state.saved(), true);
});
test('pin tip stays hidden when pinned, dismissed, unsupported or unavailable', async () => {
  for (const options of [{ pinned: true }, { dismissed: true }, { unsupported: true }, { fail: true }]) {
    const state = await setup(options);
    assert.equal(state.document.getElementById('pinTip').hidden, true);
  }
});
test('pinning while the popup is open hides the tip', async () => {
  const state = await setup();
  state.change({ isOnToolbar: true });
  assert.equal(state.document.getElementById('pinTip').hidden, true);
});
