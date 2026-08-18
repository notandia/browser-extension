'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('popup keeps status colors distinct and offers result controls', () => {
  const popup = source('popup.js');
  const css = source('popup.css');
  const html = source('popup.html');

  assert.match(popup, /function uniqueIntegrityEvents\(/);
  assert.match(popup, /primary-integrity/);
  assert.match(popup, /recordAccent\(record\)/);
  assert.match(popup, /restorePersistedTabState/);
  assert.match(html, /id="contextFilter"/);
  assert.match(html, /id="contextSort"/);
  assert.match(css, /\.chip\.integrity\s*\{[^}]*border-color:\s*var\(--chip-color/s);
  assert.doesNotMatch(css, /\.chip\.integrity\s*\{[^}]*border-color:\s*var\(--danger/s);
  assert.match(css, /context-item-accented/);
});

test('session persistence avoids stale loading reports and delayed-save races', () => {
  const persistence = source('background_persistence.js');

  assert.match(persistence, /STATE_VERSION = 2/);
  assert.match(persistence, /const restorePromises = new Map\(\)/);
  assert.match(persistence, /const saveTimers = new Map\(\)/);
  assert.match(persistence, /state\.integrity\?\.state === 'ready'/);
  assert.match(persistence, /clearTimeout\(timer\)/);
  assert.match(persistence, /ensureTab: restoreTab/);
});

test('integrity scanner ignores unrelated page and extension mutations', () => {
  const scanner = source('content/integrity_scanner.js');
  const context = source('content/source_context.js');

  assert.match(context, /OWN_NODE_SELECTOR/);
  assert.match(context, /function nodeTouchesSourceContext\(/);
  assert.match(context, /c-reading-companion/);
  assert.match(scanner, /sourceContext\.nodeTouchesSourceContext\(node\)/);
  assert.match(scanner, /mutation\.addedNodes/);
  assert.doesNotMatch(scanner, /setTimeout\(\(\) => scheduleScan\(0\), 2500\)/);
});
