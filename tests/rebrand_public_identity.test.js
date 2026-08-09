'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('manifest locale and popup use the Notandia public identity', () => {
  const locale = JSON.parse(read('_locales/en/messages.json'));
  const popup = read('popup.html');
  const manifest = read('manifest.json');

  assert.equal(locale.extName.message, 'Notandia');
  assert.match(popup, /<title>Notandia<\/title>/);
  assert.match(popup, />Notandia<\/h1>/);
  assert.match(manifest, /"default_title": "Notandia"/);
});
