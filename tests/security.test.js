'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadScript(relativePath, additions = {}) {
  const context = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    AbortController,
    Map,
    Set,
    ...additions
  };
  context.window ||= {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), context, {
    filename: relativePath
  });
  return context;
}

test('reference identifiers reject selector metacharacters and excessive length', () => {
  const context = loadScript('content/reference_id_extractor.js');
  const normalize = context.window.MDPIFilterReferenceIdExtractor.normalizeReferenceId;

  assert.equal(normalize('ref-CR12'), 'ref-CR12');
  assert.equal(normalize('  B1:section.2  '), 'B1:section.2');
  assert.equal(normalize('bad"] * { display:none }'), null);
  assert.equal(normalize('x'.repeat(257)), null);
});

test('inline selector construction rejects unsafe page identifiers', () => {
  const window = {
    MDPIFilterReferenceIdExtractor: {
      normalizeReferenceId(value) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim();
        return /^[A-Za-z0-9_.:-]{1,256}$/.test(normalized) ? normalized : null;
      }
    }
  };
  const document = {
    getElementById() { return null; },
    querySelectorAll() { return []; }
  };
  loadScript('content/inline_footnote_selectors.js', { window, document });

  const generate = window.MDPIFilterUtils.generateInlineFootnoteSelectors;
  assert.match(generate('CR12'), /href="#CR12"/);
  assert.equal(generate('x"] div'), '');
});

test('sanitizer preserves only plain string values', () => {
  const window = {};
  loadScript('content/sanitizer.js', { window });
  assert.equal(window.sanitize('<b>Reference</b>'), '<b>Reference</b>');
  assert.equal(window.sanitize({ text: 'Reference' }), '');
});

test('NCBI lookups validate, deduplicate, avoid direct provider traffic, and enforce page budget', async () => {
  const messages = [];
  let directFetches = 0;
  const window = { NotandiaSettings: { ncbiApiEnabled: true } };
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        messages.push(message);
        callback({ success: true, providerStatus: 'ok', records: [] });
      }
    }
  };
  const fetch = async () => {
    directFetches += 1;
    throw new Error('content-side NCBI code must not fetch the provider directly');
  };
  loadScript('content/ncbi_api_handler.js', { window, chrome, fetch });
  const handler = window.NotandiaNcbiApiHandler;
  const runCache = new Map();
  const persistentCache = new Map();

  assert.equal(window.MDPIFilterNcbiApiHandler, handler);
  assert.deepEqual(
    Array.from(handler.normalizeIdsForQuery(['123', '123', 'bad', '456'], 'pmid')),
    ['123', '456']
  );
  assert.deepEqual(
    Array.from(handler.normalizeIdsForQuery(['10.1000/OK', '10.1000/bad,split'], 'doi')),
    ['10.1000/ok']
  );

  await handler.checkNcbiIdsForMdpi(
    Array.from({ length: 800 }, (_, index) => String(index + 1)),
    'pmid',
    runCache,
    persistentCache
  );

  assert.equal(messages.length, 12);
  const queriedIds = messages.flatMap(message => message.ids);
  assert.equal(queriedIds.length, 600);
  assert.equal(new Set(queriedIds).size, 600);
  for (const message of messages) {
    assert.equal(message.type, 'ncbiIdConversion');
    assert.equal(message.idType, 'pmid');
    assert.ok(message.ids.length <= 50);
    assert.equal(Object.hasOwn(message, 'apiKey'), false);
    assert.equal(Object.hasOwn(message, 'email'), false);
  }
  assert.equal(directFetches, 0);

  await handler.checkNcbiIdsForMdpi(['901', '902'], 'pmid', runCache, persistentCache);
  assert.equal(messages.length, 12);
});

test('manifest and package maintain the converged least-privilege contract', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(packageJson.name, 'notandia-browser-extension');
  assert.equal(fs.existsSync(path.join(ROOT, 'content', 'dompurify.min.js')), false);
  assert.equal(Object.keys(packageJson.dependencies || {}).length, 0);
  assert.ok(manifest.content_scripts[0].js.includes('content/secure_message_handler.js'));
});

test('workflows pin actions and do not embed NCBI secrets', () => {
  const workflowDirectory = path.join(ROOT, '.github', 'workflows');
  for (const filename of fs.readdirSync(workflowDirectory).filter(name => /\.ya?ml$/i.test(name))) {
    const workflow = fs.readFileSync(path.join(workflowDirectory, filename), 'utf8');
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
      assert.match(match[1], /@[0-9a-f]{40}$/i, `${filename}: ${match[1]}`);
    }
    assert.doesNotMatch(workflow, /NCBI_(?:TOOL_NAME|API_EMAIL)_SECRET/);
  }
});
