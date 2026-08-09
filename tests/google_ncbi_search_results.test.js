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
  context.MDPIFilterSettings = { ncbiApiEnabled: true };
  vm.createContext(context);
  vm.runInContext(source('shared/work_identifiers.js'), context);
  vm.runInContext(source('content/ncbi_api_handler.js'), context);
  return { context, messages, directFetches: () => directFetches };
}

test('resolves the supplied Google PMC and Europe PMC identifiers to MDPI DOIs through the background provider', async () => {
  const fixture = loadNcbiHandler(message => {
    if (message.idType === 'pmcid' && message.ids.includes('PMC6268482')) {
      return [{
        pmcid: 'PMC6268482',
        pmid: '22301722',
        doi: '10.3390/molecules17021354'
      }];
    }
    if (message.idType === 'pmid' && message.ids.includes('22971582')) {
      return [{
        pmid: '22971582',
        pmcid: 'PMC6268707',
        doi: '10.3390/molecules170910971'
      }];
    }
    return [];
  });

  const pmc = await fixture.context.MDPIFilterNcbiApiHandler.resolveNcbiIdsToDois(
    ['PMC6268482'],
    'pmcid'
  );
  const europePmc = await fixture.context.MDPIFilterNcbiApiHandler.resolveNcbiIdsToDois(
    ['22971582'],
    'pmid'
  );

  assert.equal(pmc.doiById.get('PMC6268482'), '10.3390/molecules17021354');
  assert.equal(europePmc.doiById.get('22971582'), '10.3390/molecules170910971');
  assert.deepEqual(
    fixture.messages.map(message => [message.type, message.idType, Array.from(message.ids)]),
    [
      ['ncbiIdConversion', 'pmcid', ['PMC6268482']],
      ['ncbiIdConversion', 'pmid', ['22971582']]
    ]
  );
  assert.equal(fixture.directFetches(), 0);
});

test('content-side NCBI resolution is strictly opt-in', async () => {
  const fixture = loadNcbiHandler(() => []);
  fixture.context.MDPIFilterSettings.ncbiApiEnabled = false;

  const result = await fixture.context.MDPIFilterNcbiApiHandler.resolveNcbiIdsToDois(
    ['22971582'],
    'pmid'
  );

  assert.equal(result.status, 'disabled');
  assert.equal(fixture.messages.length, 0);
  assert.equal(fixture.directFetches(), 0);
});

test('publisher scanner recognizes biomedical URL evidence and enriches search results before matching', () => {
  const scanner = source('content/publisher_profile_scanner.js');
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;

  assert.match(scanner, /\/article\\\/\(med\|pmc\)\\\/\(\[\^\/?#\]\+\)/);
  assert.match(scanner, /resolveNcbiIdsToDois/);
  assert.match(scanner, /await enrichRecordsWithNcbi\(\[\.\.\.referenceRecords, \.\.\.searchRecords\]\)/);
  assert.match(scanner, /ncbiApiEnabled: false/);
  assert.match(scanner, /stored\.ncbiApiEnabled === true/);
  assert.ok(!scripts.includes('content/ncbi_fetch_proxy.js'));
  assert.ok(scripts.indexOf('content/ncbi_api_handler.js') < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.doesNotMatch(source('content/ncbi_api_handler.js'), /https?:\/\//);
  assert.doesNotMatch(source('content/ncbi_api_handler.js'), /\bfetch\s*\(/);
  assert.match(source('content/ncbi_api_handler.js'), /type: 'ncbiIdConversion'/);
});
