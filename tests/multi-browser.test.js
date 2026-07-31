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
    }
  } finally {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
});
