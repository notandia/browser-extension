'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function readManifest(target) {
  return JSON.parse(fs.readFileSync(path.join(DIST, target, 'manifest.json'), 'utf8'));
}

test('one source tree generates isolated Notandia browser packages', () => {
  fs.rmSync(DIST, { recursive: true, force: true });
  try {
    const result = spawnSync(process.execPath, [
      path.join(ROOT, 'scripts', 'build-all.js'),
      '--version',
      '1.2.3-beta.1'
    ], { cwd: ROOT, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const locale = JSON.parse(
      fs.readFileSync(path.join(ROOT, '_locales', 'en', 'messages.json'), 'utf8')
    );
    assert.equal(locale.extName.message, 'Notandia');

    const chrome = readManifest('chrome');
    const edge = readManifest('edge');
    const firefox = readManifest('firefox');
    const safari = readManifest('safari');

    for (const manifest of [chrome, edge, firefox, safari]) {
      assert.equal(manifest.version, '1.2.3');
      assert.equal(manifest.version_name, '1.2.3-beta.1');
      assert.equal(manifest.name, '__MSG_extName__');
      assert.equal(manifest.action.default_title, 'Notandia');
      assert.equal(manifest.homepage_url, 'https://mdpi-filter.pages.dev/');
      assert.deepEqual(manifest.permissions, ['storage']);
      assert.ok(manifest.content_scripts[0].js.includes('shared/publisher_profiles.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/publisher_profile_scanner.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/integrity_scanner.js'));
    }

    assert.equal(chrome.background.service_worker, 'background.js');
    assert.equal(edge.background.service_worker, 'background.js');
    assert.deepEqual(firefox.background.scripts, ['shared/publisher_profiles.js', 'shared/integrity.js', 'background.js']);
    assert.equal(Object.hasOwn(firefox.background, 'service_worker'), false);
    assert.equal(Object.hasOwn(firefox.background, 'type'), false);
    assert.equal(firefox.browser_specific_settings.gecko.id, 'browser-extension@notandia.github.io');
    assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.optional, ['websiteContent']);
    assert.equal(Object.hasOwn(safari, 'externally_connectable'), false);

    for (const target of ['chrome', 'edge', 'firefox', 'safari']) {
      assert.equal(fs.existsSync(path.join(DIST, target, 'background.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'shared', 'publisher_profiles.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'shared', 'integrity.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'publisher_profile_scanner.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'integrity_scanner.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'content_script.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'scripts')), false);
      assert.equal(fs.existsSync(path.join(DIST, target, 'tests')), false);
    }
  } finally {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
});
