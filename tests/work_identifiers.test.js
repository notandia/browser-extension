'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadMapper() {
  const context = { URL, console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source('shared/work_identifiers.js'), context);
  return context.NotandiaWorkIdentifiers;
}

test('normalizes DOI, PMID, PMCID and arXiv identifiers from canonical URLs', () => {
  const mapper = loadMapper();

  assert.equal(
    mapper.normalizeDOI('https://doi.org/10.1016%2Fj.ijantimicag.2020.105949.'),
    '10.1016/j.ijantimicag.2020.105949'
  );
  assert.equal(
    mapper.normalizePMID('https://pubmed.ncbi.nlm.nih.gov/33408014/'),
    '33408014'
  );
  assert.equal(
    mapper.normalizePMCID('https://pmc.ncbi.nlm.nih.gov/articles/PMC7779265/'),
    'PMC7779265'
  );
  assert.equal(mapper.normalizeArxiv('https://arxiv.org/pdf/2301.10140v2.pdf'), '2301.10140');
  assert.deepEqual(
    { ...mapper.parseArxiv('arXiv:hep-th/9901001v3') },
    { id: 'hep-th/9901001', version: 3 }
  );
});

test('extracts exact identifiers without treating arbitrary numbers as PMIDs', () => {
  const mapper = loadMapper();
  const identity = mapper.extract([
    'DOI: 10.1182/blood-2009-08-240044',
    'PMID: 20061557',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC7779265/',
    'arXiv:2301.10140v2',
    'Reference 14 was published in 2010'
  ], { source: 'test-fixture', method: 'structured-text' });

  assert.deepEqual(Array.from(identity.identifiers.doi), ['10.1182/blood-2009-08-240044']);
  assert.deepEqual(Array.from(identity.identifiers.pmid), ['20061557']);
  assert.deepEqual(Array.from(identity.identifiers.pmcid), ['PMC7779265']);
  assert.deepEqual(Array.from(identity.identifiers.arxiv), ['2301.10140']);
  assert.equal(identity.canonicalKey, 'doi:10.1182/blood-2009-08-240044');
  assert.ok(identity.evidence.every(entry => entry.source === 'test-fixture'));
});

test('requires an explicit type before a bare numeric value becomes a PMID', () => {
  const mapper = loadMapper();
  const ambiguous = mapper.extract('33408014', {
    source: 'page-text',
    method: 'unstructured-text'
  });
  assert.deepEqual(Array.from(ambiguous.identifiers.pmid), []);
  assert.equal(ambiguous.canonicalKey, null);

  const structured = mapper.extract({ year: 2020, pmid: '33408014' }, {
    source: 'structured-metadata'
  });
  assert.deepEqual(Array.from(structured.identifiers.pmid), ['33408014']);
  assert.deepEqual(Array.from(structured.identifiers.arxiv), []);
  assert.equal(structured.canonicalKey, 'pmid:33408014');
});

test('merges identities deterministically and preserves provider provenance', () => {
  const mapper = loadMapper();
  const local = mapper.extract('PMID: 14699080', {
    source: 'page',
    method: 'metadata',
    confidence: 'exact'
  });
  const resolved = mapper.identitiesFromNCBIRecords([
    {
      pmid: '14699080',
      pmcid: 'PMC1193645',
      doi: '10.1084/jem.20020509'
    }
  ])[0];
  const merged = mapper.merge(local, resolved);

  assert.equal(merged.canonicalKey, 'doi:10.1084/jem.20020509');
  assert.deepEqual(Array.from(merged.identifiers.pmid), ['14699080']);
  assert.deepEqual(Array.from(merged.identifiers.pmcid), ['PMC1193645']);
  assert.equal(
    merged.evidence.some(entry => entry.source === 'ncbi-id-converter' && entry.confidence === 'resolved'),
    true
  );
});

test('builds bounded NCBI DOI resolution maps through the shared identity model', () => {
  const mapper = loadMapper();
  const maps = mapper.resolutionMapsFromNCBI([
    {
      versions: [
        {
          pmid: '32205204',
          pmcid: 'PMC7102549',
          doi: '10.1016/j.ijantimicag.2020.105949'
        }
      ]
    }
  ]);

  assert.equal(maps.pmidToDoi.get('32205204'), '10.1016/j.ijantimicag.2020.105949');
  assert.equal(maps.pmcidToDoi.get('PMC7102549'), '10.1016/j.ijantimicag.2020.105949');
  assert.equal(
    mapper.resolvedDOI(mapper.extract('PMID: 32205204'), maps),
    '10.1016/j.ijantimicag.2020.105949'
  );
});

test('loads the mapper before every browser scanner that consumes scholarly IDs', () => {
  const manifest = JSON.parse(source('manifest.json'));
  const scripts = manifest.content_scripts[0].js;
  const mapperIndex = scripts.indexOf('shared/work_identifiers.js');

  assert.ok(mapperIndex >= 0);
  assert.ok(mapperIndex < scripts.indexOf('content/publisher_profile_scanner.js'));
  assert.ok(mapperIndex < scripts.indexOf('content/integrity_scanner.js'));
  assert.ok(mapperIndex < scripts.indexOf('content/ncbi_context_bridge.js'));
  assert.match(source('content/ncbi_context_bridge.js'), /window\.NotandiaWorkIdentifiers/);
  assert.match(source('content/ncbi_context_bridge.js'), /resolutionMapsFromNCBI/);
});
