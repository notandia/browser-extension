'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { parseHTML } = require('linkedom');

// Firefox content scripts have a sandbox global inheriting from window.
// Helpers attached to globalThis are not properties of window. Chromium and
// the older test fixtures use the same object for both and hid this defect.
function fixture(url, html) {
  const { window: dom } = parseHTML(`<html><head></head><body>${html}</body></html>`);
  Object.getPrototypeOf(dom.document.body.style).getPropertyPriority ||= () => '';
  const window = {
    document: dom.document, location: new URL(url), Element: dom.Element,
    HTMLElement: dom.HTMLElement, HTMLAnchorElement: dom.HTMLAnchorElement,
    HTMLDetailsElement: dom.HTMLDetailsElement, URL, URLSearchParams, console
  };
  window.window = window;
  Object.defineProperty(dom.document, 'baseURI', { value: url });
  dom.document.location = window.location;
  const sandbox = Object.create(window);
  const timers = new Map();
  const messages = [];
  let timerId = 0;
  sandbox.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; };
  sandbox.clearTimeout = id => timers.delete(id);
  sandbox.MutationObserver = class { observe() {} disconnect() {} };
  sandbox.chrome = {
    runtime: { id: 'test-extension', onMessage: { addListener() {} },
      sendMessage: (message, callback) => { messages.push(message); callback?.({}); } },
    storage: { sync: { get: (defaults, callback) => callback(defaults), set() {} },
      onChanged: { addListener() {} } }
  };
  vm.createContext(sandbox);
  const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  for (const file of [
    'shared/work_identifiers.js', 'shared/community_publishing_data.js',
    'shared/community_publishing.js', 'shared/publisher_profiles.js',
    'content/domains.js', 'content/reference_selectors.js', 'content/link_extraction_selectors.js',
    'content/link_extractor.js', 'content/item_content_checker.js',
    'content/reference_id_extractor.js', 'content/inline_footnote_selectors.js',
    'content/inline_reference_mapper.js', 'content/source_context.js'
  ]) load(file);
  return { window, sandbox, timers, messages, load };
}

for (const [site, url, html] of [
  ['Wikipedia', 'https://en.wikipedia.org/wiki/MDPI', '<ol class="references"><li id="cite_note-1"><a href="https://doi.org/10.3390/example">MDPI paper</a></li></ol>'],
  ['PubMed', 'https://pubmed.ncbi.nlm.nih.gov/12345678/', '<div id="references"><ol class="references-list"><li id="reference1"><a href="https://doi.org/10.3390/example">MDPI paper</a></li></ol></div>']
]) {
  test(`${site}: Firefox sandbox shares helpers and highlights references`, async () => {
    const f = fixture(url, html);
    assert.notEqual(f.sandbox, f.window);
    assert.ok(f.sandbox.NotandiaWorkIdentifiers);
    assert.equal(f.window.NotandiaWorkIdentifiers, undefined);
    assert.ok(f.window.NotandiaSourceContext, 'source context must initialise with the sandbox helper');
    const records = f.window.NotandiaSourceContext.collectRecords().references;
    assert.equal(records.length, 1);
    assert.equal(records[0].doi, '10.3390/example');
    f.load('content/publisher_profile_scanner.js');
    const entry = [...f.timers].find(([, timer]) => timer.delay === 0);
    assert.ok(entry, 'publisher scanner must schedule an initial scan');
    f.timers.delete(entry[0]); entry[1].fn();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.window.document.querySelectorAll('.notandia-publisher-badge').length, 1);
    const report = f.messages.find(message => message.type === 'publisherContextUpdate');
    assert.ok(report);
    assert.equal(report.data.references[0].matches[0].profileId, 'mdpi');
  });
}
