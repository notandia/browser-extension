'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildTarget } = require('../scripts/build-target');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
function readManifest(DIST, target) {
  return JSON.parse(fs.readFileSync(path.join(DIST, target, 'manifest.json'), 'utf8'));
}

test('one source tree generates isolated Notandia browser packages', () => {
  // Chrome may be running the unpacked development build in ROOT/dist.
  // Tests must never replace or remove that installed copy.
  const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'notandia-packaging-test-'));
  const installedManifest = path.join(ROOT, 'dist', 'chrome', 'manifest.json');
  const before = fs.existsSync(installedManifest) ? fs.readFileSync(installedManifest, 'utf8') : null;
  const fixtureDirectory = fs.mkdtempSync(path.join(ROOT, 'packaging-fixture-'));
  fs.writeFileSync(path.join(fixtureDirectory, 'local-notes.txt'), 'Must not ship');
  try {
    for (const target of ['chrome', 'edge', 'firefox', 'safari']) buildTarget(target, '1.2.3-beta.1', DIST);

    const locale = JSON.parse(
      fs.readFileSync(path.join(ROOT, '_locales', 'en', 'messages.json'), 'utf8')
    );
    assert.equal(locale.extName.message, 'Notandia');

    const chrome = readManifest(DIST, 'chrome');
    const edge = readManifest(DIST, 'edge');
    const firefox = readManifest(DIST, 'firefox');
    const safari = readManifest(DIST, 'safari');

    for (const manifest of [chrome, edge, firefox, safari]) {
      assert.equal(manifest.version, '1.2.3');
      assert.equal(manifest.version_name, '1.2.3-beta.1');
      assert.equal(manifest.name, '__MSG_extName__');
      assert.equal(manifest.action.default_title, 'Notandia');
      assert.equal(manifest.homepage_url, 'https://mdpi-filter.pages.dev/');
      assert.deepEqual(manifest.permissions, ['storage']);
      assert.ok(manifest.content_scripts[0].js.includes('shared/publisher_profiles.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/reference_counter_normalizer.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/publisher_profile_scanner.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/integrity_scanner.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/integrity_presentation.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/ncbi_fetch_proxy.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/ncbi_article_scope.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/ncbi_context_bridge.js'));
      assert.ok(manifest.content_scripts[0].js.includes('content/inline_reference_mapper.js'));
      assert.ok(
        manifest.content_scripts[0].js.indexOf('content/inline_footnote_selectors.js') <
        manifest.content_scripts[0].js.indexOf('content/inline_reference_mapper.js')
      );
      assert.ok(
        manifest.content_scripts[0].js.indexOf('content/inline_reference_mapper.js') <
        manifest.content_scripts[0].js.indexOf('content/publisher_profile_scanner.js')
      );
      assert.ok(
        manifest.content_scripts[0].js.indexOf('content/ncbi_article_scope.js') <
        manifest.content_scripts[0].js.indexOf('content/ncbi_context_bridge.js')
      );
      assert.ok(manifest.content_scripts[0].css.includes('content/integrity_presentation.css'));
    }

    assert.equal(chrome.background.service_worker, 'service_worker.js');
    assert.equal(edge.background.service_worker, 'service_worker.js');
    assert.deepEqual(firefox.background.scripts, [
      'shared/publisher_profiles.js',
      'shared/integrity.js',
      'background_support.js',
      'background.js',
      'background_persistence.js',
      'background_live_context.js',
      'background_ncbi_priority.js'
    ]);
    assert.equal(Object.hasOwn(firefox.background, 'service_worker'), false);
    assert.equal(Object.hasOwn(firefox.background, 'type'), false);
    assert.equal(firefox.browser_specific_settings.gecko.id, 'browser-extension@notandia.github.io');
    assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions.optional, ['websiteContent']);
    assert.equal(Object.hasOwn(safari, 'externally_connectable'), false);

    for (const target of ['chrome', 'edge', 'firefox', 'safari']) {
      assert.equal(fs.existsSync(path.join(DIST, target, 'background.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'background_support.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'background_persistence.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'background_live_context.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'background_ncbi_priority.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'service_worker.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'popup_progress.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'shared', 'publisher_profiles.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'shared', 'integrity.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'reference_counter_normalizer.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'publisher_profile_scanner.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'integrity_scanner.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'integrity_presentation.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'integrity_presentation.css')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'ncbi_fetch_proxy.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'ncbi_article_scope.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'ncbi_context_bridge.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'inline_reference_mapper.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'content', 'content_script.js')), true);
      assert.equal(fs.existsSync(path.join(DIST, target, 'scripts')), false);
      assert.equal(fs.existsSync(path.join(DIST, target, 'tests')), false);
      assert.equal(fs.existsSync(path.join(DIST, target, '.vscode')), false);
      assert.equal(fs.existsSync(path.join(DIST, target, path.basename(fixtureDirectory))), false);
    }
  } finally {
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
    fs.rmSync(DIST, { recursive: true, force: true });
    assert.equal(fs.existsSync(installedManifest) ? fs.readFileSync(installedManifest, 'utf8') : null, before);
  }
});
