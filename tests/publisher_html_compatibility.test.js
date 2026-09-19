'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { parseHTML } = require('linkedom');

// Reduced HTML contracts from the original MDPI Filter selector catalog.
// These exercise actual CSS matching, not current live-site availability.
function page(html, url = 'https://example.org/article') {
  const { window } = parseHTML(`<html><head></head><body>${html}</body></html>`);
  const location = new URL(url);
  Object.defineProperty(window.document, 'baseURI', { value: url });
  window.document.location = location;
  const context = {
    document: window.document, Element: window.Element, HTMLElement: window.HTMLElement, HTMLAnchorElement: window.HTMLAnchorElement,
    HTMLDetailsElement: window.HTMLDetailsElement, URL, URLSearchParams, location, console
  };
  context.window = context;
  vm.createContext(context);
  context.load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  for (const file of [
    'shared/work_identifiers.js', 'shared/publisher_profiles.js',
    'content/reference_selectors.js', 'content/link_extraction_selectors.js',
    'content/link_extractor.js', 'content/item_content_checker.js',
    'content/reference_id_extractor.js', 'content/inline_footnote_selectors.js',
    'content/inline_reference_mapper.js', 'content/source_context.js'
  ]) context.load(file);
  return context;
}

const doiLink = '<a href="https://doi.org/10.3390/example">Crossref</a>';
const layouts = [
  ['Nature', `<li class="c-article-references__item"><p id="ref-CR1" class="c-article-references__text">${doiLink}</p></li>`, 'href="#ref-CR1"'],
  ['Frontiers', `<div class="References"><p class="ReferencesCopy1"><a id="anchor1" name="B1"></a>${doiLink}</p></div>`, 'href="#B1"'],
  ['MDPI', `<li class="html-xx" id="B1-paper">${doiLink}</li>`, 'href="#B1-paper"'],
  ['Wiley', `<li id="citation1" data-bib-id="bib1"><div class="extra-links"><span class="data-doi">10.3390/example</span></div></li>`, 'href="#bib1"'],
  ['Springer', `<li id="CR1">${doiLink}</li>`, 'href="#CR1"'],
  ['Taylor & Francis', `<li id="cit0001">${doiLink}</li>`, 'data-rid="cit0001"'],
  ['PMC', `<ul class="ref-list"><li id="bib1">${doiLink}</li></ul>`, 'href="#bib1"'],
  ['Europe PMC', `<div id="B1-paper" class="ref-cit-blk">${doiLink}</div>`, 'rid="B1-paper"'],
  ['PubMed', `<div id="references"><ol class="references-list"><li id="reference1">${doiLink}</li></ol></div>`, 'href="#reference1"'],
  ['ScienceDirect', `<li><span class="label"><a class="anchor" id="ref-id-bb0105"></a></span>${doiLink}</li>`, 'href="#bb0105"'],
  ['Cell', `<li><div class="citation" id="sref1">${doiLink}</div></li>`, 'data-db-target-for="sref1"'],
  ['OUP', `<div class="js-splitview-ref-item" content-id="CIT1">${doiLink}</div>`, 'class="link-ref xref-bibr" reveal-id="CIT1"'],
  ['Sage', `<div class="citations" id="bibr1-paper">${doiLink}</div>`, 'role="doc-biblioref" data-xml-rid="bibr1-paper"'],
  ['BMJ', `<li><div class="cit ref-cit"><a class="rev-xref-ref" id="ref-1"></a>${doiLink}</div></li>`, 'href="#ref-1"'],
  ['LWW', `<div class="article-references__item" id="R1">${doiLink}</div>`, 'class="ejp-citation-link" data-reference-links="R1"'],
  ['Wikipedia', `<li id="cite_note-1">${doiLink}</li>`, 'href="#cite_note-1"'],
  ['Cambridge', `<div class="circle-list__item" id="r1">${doiLink}</div>`, 'href="#r1"'],
  ['Healthline', `<hl-trusted-source id="health1"><a class="content-link" href="https://doi.org/10.3390/example">Study</a></hl-trusted-source>`, 'href="#health1"']
];

for (const [site, reference, inline] of layouts) {
  test(`${site}: shared record retains DOI and reaches its inline footnote`, () => {
    const context = page(`<p>Claim<sup><a id="inline" ${inline}>1</a><a id="other" href="#unrelated">2</a></sup></p>${reference}`);
    const records = context.NotandiaSourceContext.collectRecords().references;
    assert.equal(records.length, 1);
    const [record] = records;
    assert.equal(record.doi, '10.3390/example', 'formal-integrity input');
    assert.equal(context.NotandiaPublisherProfiles.matchProfiles(
      context.NotandiaPublisherProfiles.defaultSettings(), record.evidence
    )[0].profileId, 'mdpi', 'publisher input');
    const selectors = context.MDPIFilterUtils.generateInlineFootnoteSelectors(record.id);
    const matches = [...context.document.querySelectorAll(selectors)];
    assert.ok(matches.includes(context.document.getElementById('inline')), selectors);
    assert.ok(!matches.includes(context.document.getElementById('other')));
    assert.equal(context.NotandiaSourceContext.collectRecords().references[0].id, record.id, 'rescan ID stability');

    // Feed a provider-confirmed result through the real presentation module.
    // Publisher matching alone must not be responsible for these highlights.
    const timers = [];
    context.setTimeout = fn => { timers.push(fn); return timers.length; };
    context.clearTimeout = () => {};
    context.MutationObserver = class { observe() {} disconnect() {} };
    context.chrome = {
      runtime: { onMessage: { addListener() {} } },
      storage: { onChanged: { addListener() {} } }
    };
    context.NotandiaRuntime = {
      isAvailable: () => true,
      sendMessage(message, callback) {
        assert.equal(message.type, 'getIntegrityReport');
        callback({ report: { state: 'ready', records: [
          { id: record.id, kind: 'reference', doi: record.doi, primaryStatus: 'retracted' }
        ] } });
        return true;
      }
    };
    context.load('content/integrity_presentation.js');
    timers.shift()();
    assert.ok(record.element.classList.contains('notandia-integrity-reference'));
    assert.ok(context.document.getElementById('inline').classList.contains('notandia-integrity-citation'));
    assert.ok(!context.document.getElementById('other').classList.contains('notandia-integrity-citation'));
  });
}

test('full citation evidence survives popup truncation and excludes our own badges', () => {
  const context = page(`<li id="ref-1">${'Long author list '.repeat(80)} DOI: 10.3389/fmed.2026.1<span class="notandia-integrity-chip">10.3390/unrelated</span></li>`);
  const [record] = context.NotandiaSourceContext.collectRecords().references;
  assert.equal(record.text.length, 500);
  assert.equal(record.doi, '10.3389/fmed.2026.1');
  assert.deepEqual(Array.from(record.evidence.dois), ['10.3389/fmed.2026.1']);
});

test('descendant DOI attributes and Wikipedia COinS identify the cited work', () => {
  for (const metadata of [
    '<a data-doi="10.3389/fmed.2026.1">Study</a>',
    '<span data-reference-doi="10.3389/fmed.2026.1"></span>',
    '<span class="Z3988" title="rft_id=info%3Adoi%2F10.3389%2Ffmed.2026.1"></span>'
  ]) {
    const context = page(`<li id="ref-1">${metadata}</li>`);
    assert.equal(context.NotandiaSourceContext.collectRecords().references[0].doi, '10.3389/fmed.2026.1');
  }
});

test('Wiley linkout chooses the cited DOI, never the citing article DOI', () => {
  for (const parameter of ['refDoi', 'key']) {
    const context = page(`<li data-bib-id="bib1"><a href="/servlet/linkout?doi=10.1002%2Fciting&${parameter}=10.3390%2Fexample">Crossref</a></li>`, 'https://onlinelibrary.wiley.com/doi/10.1002/citing');
    const [record] = context.NotandiaSourceContext.collectRecords().references;
    assert.deepEqual(Array.from(record.evidence.dois), ['10.3390/example']);
    assert.equal(record.doi, '10.3390/example');
  }
});

test('journal hints retain MDPI knowledge without manufacturing formal identifiers', () => {
  const context = page('<li id="ref-1">Study. Int J Mol Sci. 2020.</li><li id="ref-2">Molecules in motion</li><li id="ref-3"><span class="journal-title">Nutrients</span> Study</li>');
  const records = context.NotandiaSourceContext.collectRecords().references;
  const api = context.NotandiaPublisherProfiles;
  const settings = api.defaultSettings();
  assert.ok(records.every(record => record.doi === null));
  assert.equal(api.matchProfiles(settings, records[0].evidence)[0].confidence, 'potential');
  assert.equal(api.matchProfiles(settings, records[1].evidence).length, 0);
  assert.equal(api.matchProfiles(settings, records[2].evidence)[0].confidence, 'potential');
  settings.profiles[0].confidencePolicy = 'confirmed-only';
  assert.equal(api.matchProfiles(settings, records[0].evidence).length, 0);
});

test('Wiley popup navigation reveals the bibliography and scrolls to its actual entry', async () => {
  const context = page(`<div class="article-accordion"><button class="accordion__control" aria-expanded="false">References</button><ol hidden><li id="ref1" data-bib-id="bib1">${doiLink}</li></ol></div>`);
  const [record] = context.NotandiaSourceContext.collectRecords().references;
  const target = record.element;
  target.getClientRects = () => [{}];
  let scrolled = false;
  target.scrollIntoView = () => { scrolled = true; };
  const button = context.document.querySelector('button');
  button.click = () => {
    button.setAttribute('aria-expanded', 'true');
    context.document.querySelector('ol').removeAttribute('hidden');
  };
  let listener;
  context.chrome = { runtime: { id: 'test-extension', onMessage: { addListener: fn => { listener = fn; } } } };
  context.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
  context.requestAnimationFrame = fn => fn();
  context.setTimeout = () => 1; // Do not schedule removal of the animation during this assertion.
  context.load('content/secure_message_handler.js');
  const response = await new Promise(resolve => listener(
    { type: 'scrollToRefOnPage', refId: record.id, doi: record.doi },
    { id: 'test-extension' }, resolve
  ));
  assert.equal(response.status, 'expanded-and-scrolled');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(scrolled, true);
  assert.ok(target.classList.contains('notandia-scroll-target'));
});

test('in-page citation backlinks do not turn every reference into the hosting publisher', () => {
  const context = page('<li id="ref-1"><a href="#inline1">Back</a><a href="https://doi.org/10.1002/example">DOI</a></li>', 'https://www.mdpi.com/article');
  const [record] = context.NotandiaSourceContext.collectRecords().references;
  assert.deepEqual(Array.from(record.evidence.hostnames), ['doi.org']);
  assert.equal(context.NotandiaPublisherProfiles.matchProfiles(
    context.NotandiaPublisherProfiles.defaultSettings(), record.evidence
  ).length, 0);
});

test('Scholar cached navigation and snippets cannot identify an unrelated result', () => {
  const context = page(`<div class="gs_r"><h3 class="gs_rt"><a href="https://example.org/unrelated">Another paper</a></h3><div class="gs_rs">Discusses PMC7102549 and DOI 10.1016/j.ijantimicag.2020.105949</div><a href="https://scholar.googleusercontent.com/scholar?q=cache:example/+PMC7102549">View as HTML</a></div>`, 'https://scholar.google.com/scholar?q=PMC7102549');
  const record = context.NotandiaSourceContext.buildRecord(context.document.querySelector('.gs_r'), 0, 'search-result');
  assert.equal(record.doi, null);
  assert.deepEqual(Array.from(record.evidence.pmcids), []);
});

test('Scholar uses the canonical title DOI before a PDF mirror path', () => {
  const context = page(`<div class="gs_r"><a href="https://link.springer.com/content/pdf/10.1007/s13312-020-1852-4.pdf">PDF</a><h3 class="gs_rt"><a href="https://link.springer.com/article/10.1007/s13312-020-1852-4">Paper title</a></h3></div>`, 'https://scholar.google.com/scholar?q=PMC7102549');
  const record = context.NotandiaSourceContext.buildRecord(context.document.querySelector('.gs_r'), 0, 'search-result');
  assert.equal(record.doi, '10.1007/s13312-020-1852-4');
});
