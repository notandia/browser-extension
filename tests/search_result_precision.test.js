'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');

function page(url, html) {
  const { window } = parseHTML(`<html><head></head><body>${html}</body></html>`);
  Object.defineProperty(window.document, 'baseURI', { value: url });
  const c = { document: window.document, Element: window.Element, HTMLAnchorElement: window.HTMLAnchorElement,
    URL, URLSearchParams, atob, location: new URL(url), console };
  c.window = c;
  vm.createContext(c);
  c.load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c);
  for (const file of ['shared/work_identifiers.js', 'shared/publisher_profiles.js', 'content/domains.js',
    'content/reference_selectors.js', 'content/item_content_checker.js', 'content/source_context.js']) c.load(file);
  return c;
}
const matches = (c, record) => c.NotandiaPublisherProfiles.matchProfiles(c.NotandiaPublisherProfiles.defaultSettings(), record.evidence);

test('Google selects one organic card, not its wrapper, AI answer, empty block or questions', () => {
  const c = page('https://www.google.com/search?q=10.3390/example', `
    <div class="MjjYud" id="wrapper"><div class="MjjYud" id="result"><a href="https://www.mdpi.com/paper"><h3>Paper</h3></a></div></div>
    <div class="MjjYud" id="ai"><div data-aim="1"><a href="https://www.mdpi.com/paper"><h3>AI citation</h3></a></div></div>
    <div class="MjjYud">People also ask <a href="https://www.mdpi.com/">Source</a></div>
    <div class="MjjYud"></div><li id="search-other">Related search</li>`);
  const records = c.NotandiaSourceContext.collectRecords();
  assert.deepEqual(Array.from(records.searchResults, r => r.element.id), ['result']);
  assert.equal(records.references.length, 0);
  assert.equal(records.searchResults[0].number, 1);
  assert.deepEqual(Array.from(c.NotandiaSourceContext.currentArticleEvidence().dois), []);
});

for (const [name, url, wrap, title] of [
  ['Google', 'https://www.google.com/search?q=mdpi', html => `<div class="MjjYud">${html}</div>`, '<a href="https://example.org/paper"><h3>Int J Mol Sci discussion</h3></a>'],
  ['Bing', 'https://www.bing.com/search?q=mdpi', html => `<li class="b_algo" id="result-r1">${html}</li>`, '<h2><a href="https://example.org/paper">Int J Mol Sci discussion</a></h2>'],
  ['DuckDuckGo', 'https://duckduckgo.com/?q=mdpi', html => `<li data-layout="organic"><article>${html}</article></li>`, '<h2><a data-testid="result-title-a" href="https://example.org/paper">Int J Mol Sci discussion</a></h2>'],
  ['Yandex', 'https://yandex.com/search/?text=mdpi', html => `<li data-fast="1" id="result-r1">${html}</li>`, '<h2><a href="https://example.org/paper">Int J Mol Sci discussion</a></h2>']
]) {
  test(`${name}: related links, query text and stale resolutions cannot label a neutral destination MDPI`, () => {
    const c = page(url, wrap(`${title}<p>MDPI, 10.3390/example, PMID: 32205204</p><a href="https://www.mdpi.com/">Related source</a>`));
    const first = c.NotandiaSourceContext.collectRecords();
    assert.equal(first.searchResults.length, 1);
    assert.equal(first.references.length, 0);
    first.searchResults[0].element.setAttribute('data-notandia-doi', '10.3390/stale');
    const record = c.NotandiaSourceContext.collectRecords().searchResults[0];
    assert.equal(record.doi, null);
    assert.equal(matches(c, record).length, 0);
    assert.deepEqual(Array.from(record.evidence.hostnames), ['example.org']);
  });
}

test('Google and DuckDuckGo redirect wrappers identify the actual destination', () => {
  for (const [url, html] of [
    ['https://www.google.com/search?q=mdpi', '<div class="MjjYud"><a href="/url?q=https%3A%2F%2Fwww.mdpi.com%2Fpaper&other=10.3389%2Fwrong"><h3>Study</h3></a></div>'],
    ['https://duckduckgo.com/?q=mdpi', '<li data-layout="organic"><article><h2><a href="/l/?uddg=https%3A%2F%2Fwww.mdpi.com%2Fpaper">Study</a></h2></article></li>']
  ]) {
    const c = page(url, html);
    const [record] = c.NotandiaSourceContext.collectRecords().searchResults;
    assert.equal(matches(c, record)[0].profileId, 'mdpi');
    assert.equal(record.doi, null);
  }
});

test('Bing tracking links decode the destination without treating tracking parameters as DOIs', () => {
  const target = Buffer.from('https://www.mdpi.com/paper').toString('base64url');
  const c = page('https://www.bing.com/search?q=mdpi', `<li class="b_algo"><h2><a href="/ck/a?u=a1${target}&other=10.3389/wrong">Study</a></h2></li>`);
  const [record] = c.NotandiaSourceContext.collectRecords().searchResults;
  assert.equal(matches(c, record)[0].profileId, 'mdpi');
  assert.equal(record.doi, null);
});

test('PubMed preserves structured DOI evidence and resolves relative article links', () => {
  const c = page('https://pubmed.ncbi.nlm.nih.gov/?term=mdpi', '<article class="full-docsum"><a class="docsum-title" href="/36417205/">Study</a><span class="docsum-journal-citation">doi: 10.3390/epidemiologia1010001.</span><p>Also discusses PMID: 32205204</p></article>');
  const [record] = c.NotandiaSourceContext.collectRecords().searchResults;
  assert.equal(record.doi, '10.3390/epidemiologia1010001');
  assert.deepEqual(Array.from(record.evidence.pmids), ['36417205']);
});

test('Europe PMC excludes action menus and author queries without duplicating references', () => {
  const c = page('https://europepmc.org/search?query=mdpi', '<li class="separated-list-item">Export citations</li><li class="separated-list-item"><div class="citation" id="search-results--single--block-42646068"><h3 class="citation-title"><a href="/article/MED/42646068">Study</a></h3><a href="/search?query=10.3390/wrong">Author</a><span id="citation--id--pmc-42646068">PMCID: PMC13514840</span></div></li>');
  const records = c.NotandiaSourceContext.collectRecords();
  assert.equal(records.references.length, 0);
  assert.equal(records.searchResults.length, 1);
  assert.deepEqual(Array.from(records.searchResults[0].evidence.pmids), ['42646068']);
  assert.deepEqual(Array.from(records.searchResults[0].evidence.pmcids), ['PMC13514840']);
  assert.equal(records.searchResults[0].doi, null);
});

test('repeated scans retain one badge and clean an obsolete AI container from a previous injection', async () => {
  const c = page('https://www.google.com/search?q=mdpi', '<div class="MjjYud" id="real"><a href="https://www.mdpi.com/paper"><h3>Study</h3></a></div><div class="MjjYud" id="ai" data-notandia-profile-style="mdpi" style="border-left:4px solid red"><span class="notandia-publisher-badges">MDPI</span><div data-aim="1"><h3>AI answer</h3><a href="https://www.mdpi.com/">Source</a></div></div>');
  // LinkeDOM omits CSS priority access; the browser style API supplies it.
  const stylePrototype = Object.getPrototypeOf(c.document.getElementById('real').style);
  if (!stylePrototype.getPropertyPriority) Object.defineProperty(stylePrototype, 'getPropertyPriority', { value: () => '' });
  const timers = [];
  let rescan;
  c.setTimeout = fn => { timers.push(fn); return timers.length; };
  c.clearTimeout = () => {};
  let onMutation;
  c.MutationObserver = class { constructor(callback) { onMutation = callback; } observe() {} };
  const settings = c.NotandiaPublisherProfiles.defaultSettings();
  c.chrome = {
    runtime: { id: 'test', sendMessage() {}, onMessage: { addListener(fn) { rescan = fn; } } },
    storage: { sync: { get(defaults, callback) { callback({ publisherWatchlist: settings }); }, set() {} }, onChanged: { addListener() {} } }
  };
  c.load('content/publisher_profile_scanner.js');
  timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.document.querySelectorAll('.notandia-publisher-badge').length, 1);
  assert.equal(c.document.getElementById('ai').hasAttribute('data-notandia-profile-style'), false);
  assert.ok(!c.document.getElementById('ai').style.getPropertyValue('border-left'));
  timers.length = 0;
  rescan({type:'forcePublisherRescan'}, {id:'test'}, () => {});
  timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.document.querySelectorAll('.notandia-publisher-badge').length, 1);
  timers.length = 0;
  const anchor = c.document.querySelector('#real a');
  anchor.setAttribute('href', 'https://example.org/new-result');
  onMutation([{ type: 'attributes', target: anchor, addedNodes: [], removedNodes: [] }]);
  assert.equal(timers.length, 1, 'reused result destination schedules a fresh scan');
  timers.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.document.querySelectorAll('.notandia-publisher-badge').length, 0);
});
