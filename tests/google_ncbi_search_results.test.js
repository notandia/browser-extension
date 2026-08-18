'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadNcbiHandler(recordsForRequest) {
  const messages = [];
  let directFetches = 0;
  const context = {
    URL,
    URLSearchParams,
    Map,
    Set,
    console,
    fetch() {
      directFetches += 1;
      throw new Error('content NCBI handler must not fetch providers directly');
    },
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          messages.push(message);
          callback({
            success: true,
            providerStatus: 'ok',
            records: recordsForRequest(message)
          });
        }
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  context.NotandiaSettings = { ncbiApiEnabled: true };
  vm.createContext(context);
  vm.runInContext(source('shared/work_identifiers.js'), context);
  vm.runInContext(source('content/ncbi_api_handler.js'), context);
  return { context, messages, directFetches: () => directFetches };
}

test('resolves the supplied Google PMC and Europe PMC identifiers to MDPI DOIs through the background provider', async () => {
  const fixture = loadNcbiHandler(message => {
    if (message.idType === 'pmcid' && message.ids.includes('PMC6268482')) {
      return [{ pmcid: 'PMC6268482', pmid: '22301722', doi: '10.3390/molecules17021354' }];
    }
    if (message.idType === 'pmid' && message.ids.includes('22971582')) {
      return [{ pmid: '22971582', pmcid: 'PMC6268707', doi: '10.3390/molecules170910971' }];
    }
    return [];
  });

  const pmc = await fixture.context.NotandiaNcbiApiHandler.resolveNcbiIdsToDois(['PMC6268482'], 'pmcid');
  const europePmc = await fixture.context.NotandiaNcbiApiHandler.resolveNcbiIdsToDois(['22971582'], 'pmid');

  assert.equal(pmc.doiById.get('PMC6268482'), '10.3390/molecules17021354');
  assert.equal(europePmc.doiById.get('22971582'), '10.3390/molecules170910971');
  assert.deepEqual(
    fixture.messages.map(message => [message.type, message.idType, Array.from(message.ids)]),
    [
      ['ncbiIdConversion', 'pmcid', ['PMC6268482']],
      ['ncbiIdConversion', 'pmid', ['22971582']]
    ]
  );
  assert.equal(fixture.context.MDPIFilterNcbiApiHandler, fixture.context.NotandiaNcbiApiHandler);
  assert.equal(fixture.directFetches(), 0);
});

test('content-side NCBI resolution is strictly opt-in', async () => {
  const fixture = loadNcbiHandler(() => []);
  fixture.context.NotandiaSettings.ncbiApiEnabled = false;

  const result = await fixture.context.NotandiaNcbiApiHandler.resolveNcbiIdsToDois(['22971582'], 'pmid');

  assert.equal(result.status, 'disabled');
  assert.equal(fixture.messages.length, 0);
  assert.equal(fixture.directFetches(), 0);
});

test('one source-context module owns source discovery, evidence extraction and record identity', () => {
  const context = source('content/source_context.js');
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;

  assert.match(context, /window\.NotandiaSourceContext/);
  assert.match(context, /function referenceNodes/);
  assert.match(context, /function searchNodes/);
  assert.match(context, /function evidenceFromElement/);
  assert.match(context, /workIds\.extract/);
  assert.match(context, /data-notandia-doi/);
  assert.match(context, /function buildRecord/);

  const sourceIndex = scripts.indexOf('content/source_context.js');
  assert.ok(sourceIndex > scripts.indexOf('shared/work_identifiers.js'));
  assert.ok(sourceIndex < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.ok(sourceIndex < scripts.indexOf('content/integrity_scanner.js'));
});

test('publisher scanner classifies shared source records and preserves mature MDPI evidence', () => {
  const scanner = source('content/publisher_profile_scanner.js');
  const profiles = source('shared/publisher_profiles.js');

  assert.match(scanner, /window\.NotandiaSourceContext/);
  assert.match(scanner, /sourceContext\.referenceNodes/);
  assert.match(scanner, /sourceContext\.searchNodes/);
  assert.match(scanner, /sourceContext\.buildRecord/);
  assert.match(scanner, /resolveNcbiIdsToDois/);
  assert.match(scanner, /sourceContext\.setResolvedDoi/);
  assert.match(scanner, /MDPIFilterItemContentChecker\?\.checkItemContent/);
  assert.match(scanner, /mature-mdpi-detector/);
  assert.match(scanner, /mature-google-context/);
  assert.match(profiles, /profileSignals/);
  assert.match(profiles, /confidence === 'potential'/);
});

test('Google AI Overview and People Also Ask expose sources rather than composite answer containers', () => {
  const domainsSource = source('content/domains.js');
  const context = { window: { location: { search: '' } } };
  vm.createContext(context);
  vm.runInContext(domainsSource, context);
  const selector = context.window.NotandiaDomains.googleWeb.itemSelector;
  const units = selector.split(',').map(value => value.trim());

  assert.ok(selector.includes('div.MjjYud .related-question-pair span.WBgIic:has(a[href])'));
  assert.ok(selector.includes('div.MjjYud .related-question-pair li.h7wxwc > div.cRH23c[data-src-id]:has(a[href])'));
  assert.ok(selector.includes('[data-subtree="mfc"] span.WBgIic:has(a[href])'));
  assert.ok(selector.includes('[data-subtree="mfc"] li.h7wxwc > div.cRH23c[data-src-id]:has(a[href])'));
  assert.equal(units.includes('div.MjjYud .related-question-pair'), false);
  assert.equal(units.includes('[data-subtree="mfc"]'), false);
  assert.equal(selector.includes('[data-subtree="mfc"] [role="listitem"]:has(a[href])'), false);
});

test('formal integrity consumes the same source records independently of publisher classification', () => {
  const scanner = source('content/integrity_scanner.js');
  const presentation = source('content/integrity_presentation.js');

  assert.match(scanner, /window\.NotandiaSourceContext/);
  assert.match(scanner, /sourceContext\.referenceNodes/);
  assert.match(scanner, /sourceContext\.searchNodes/);
  assert.match(scanner, /sourceContext\.buildRecord/);
  assert.match(scanner, /resolveNcbiIdsToDois/);
  assert.match(scanner, /propagateExactTitleIdentities/);
  assert.match(scanner, /sourceContext\.setResolvedDoi/);
  assert.match(scanner, /kind: record\.kind/);
  assert.match(scanner, /Source discovery is publisher-agnostic/);
  assert.doesNotMatch(scanner, /addEuropePmcIdentifiers/);
  assert.doesNotMatch(scanner, /matchProfiles/);

  assert.match(presentation, /data-notandia-doi/);
  assert.match(presentation, /window\.NotandiaUtils \|\| window\.MDPIFilterUtils/);
  assert.match(presentation, /record\?\.kind !== 'current-article'/);
});

test('Google Scholar alternate URLs can converge on one DOI without trusting RETRACTED title text as status evidence', () => {
  const scanner = source('content/integrity_scanner.js');

  assert.match(scanner, /replace\(\/\^\\s\*\(\?:retracted\|withdrawn\)\\s\*:\\s\*\/i, ''\)/);
  assert.match(scanner, /candidates\?\.size !== 1/);
  assert.match(scanner, /sourceContext\.setResolvedDoi\(record, Array\.from\(candidates\)\[0\]\)/);
  assert.doesNotMatch(scanner, /primaryStatus\s*=.*RETRACTED/i);
  assert.doesNotMatch(scanner, /status.*title.*retract/i);
});

test('NCBI content transport remains background-only', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(!scripts.includes('content/ncbi_fetch_proxy.js'));
  assert.doesNotMatch(source('content/ncbi_api_handler.js'), /https?:\/\//);
  assert.doesNotMatch(source('content/ncbi_api_handler.js'), /\bfetch\s*\(/);
  assert.match(source('content/ncbi_api_handler.js'), /type: 'ncbiIdConversion'/);
});
