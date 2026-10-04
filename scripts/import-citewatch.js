'use strict';
// Offline conversion of public MediaWiki API revision snapshots.
// node scripts/import-citewatch.js configurations.json exclusions.json
const fs = require('node:fs');
const path = require('node:path');
function splitParameters(value) {
  const parts = []; let start = 0, braces = 0, links = 0;
  for (let i = 0; i < value.length; i++) {
    const pair = value.slice(i, i + 2);
    if (pair === '{{') { braces++; i++; }
    else if (pair === '}}') { braces--; i++; }
    else if (pair === '[[') { links++; i++; }
    else if (pair === ']]') { links--; i++; }
    else if (value[i] === '|' && !braces && !links) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(value.slice(start).trim()); return parts;
}
function omitRegions(text, opening, closing) {
  const parts = []; let cursor = 0;
  while (cursor < text.length) {
    const start = text.toLowerCase().indexOf(opening, cursor);
    if (start < 0) { parts.push(text.slice(cursor)); break; }
    parts.push(text.slice(cursor, start), ' ');
    const end = text.toLowerCase().indexOf(closing, start + opening.length);
    if (end < 0) break;
    cursor = end + closing.length;
  }
  return parts.join('');
}
function templates(text, name) {
  text = omitRegions(omitRegions(text, '<!--', '-->'), '<nowiki>', '</nowiki>');
  const entries = []; const pattern = new RegExp(`\\{\\{${name}\\s*\\|`, 'gi'); let match;
  while ((match = pattern.exec(text))) {
    let depth = 1, i = pattern.lastIndex;
    for (; i < text.length && depth; i++) {
      if (text.slice(i, i + 2) === '{{') { depth++; i++; }
      else if (text.slice(i, i + 2) === '}}') { depth--; if (depth) i++; }
    }
    if (depth) throw new Error('Unclosed template');
    entries.push(splitParameters(text.slice(pattern.lastIndex, i - 1)));
    pattern.lastIndex = i + 1;
  }
  return entries;
}
function parameters(parts) {
  const named = {}, names = []; let index = 1;
  for (const part of parts) {
    const m = part.match(/^([\w]+)\s*=\s*([\s\S]*)$/);
    if (m) { if (/^\d+$/.test(m[1])) names[Number(m[1]) - 1] = m[2]; else named[m[1]] = m[2]; }
    else names[index++ - 1] = part;
  }
  return { names: names.filter(Boolean), named };
}
function extractRecords(text, scope) {
  const records = templates(text, 'JCW-selected').map(parts => {
    const { names, named } = parameters(parts);
    const prefixes = Object.entries(named).filter(([key]) => /^doi\d*$/.test(key)).flatMap(([, value]) => value.split(/\s*[,;]\s*/)).filter(Boolean);
    if (!names.length || prefixes.some(value => !/^10\.\d{4,9}$/.test(value))) throw new Error('Unsupported CiteWatch entry');
    return { scope, names, prefixes, source: named.source || '', note: named.note || '' };
  });
  const nameKey = value => value.replace(/ \((?:publisher|journal)\)$/, '').toLowerCase();
  for (const [target, ...prefixes] of templates(text, 'JCW-doi-redirects')) {
    if (!prefixes.length || prefixes.some(value => !/^10\.\d{4,9}$/.test(value))) throw new Error('Unsupported DOI redirect');
    const record = records.find(record => record.names.some(name => nameKey(name) === nameKey(target)));
    if (!record) throw new Error(`Unmapped DOI redirect: ${target}`);
    record.prefixes = Array.from(new Set([...record.prefixes, ...prefixes]));
  }
  if (!records.length) throw new Error('Empty CiteWatch snapshot');
  return records;
}
function generate(configFile, exclusionFile) {
  const pages = JSON.parse(fs.readFileSync(configFile)).query.pages;
  const sources = pages.map(page => {
    const revision = page.revisions[0]; const scope = page.title.endsWith('/Publishers') ? 'publisher' : 'journal';
    return { title: `Wikipedia CiteWatch: ${scope === 'publisher' ? 'publishers' : 'journals'}`, scope, revision: revision.revid, date: revision.timestamp.slice(0, 10), url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${revision.revid}`, records: extractRecords(revision.slots.main.content, scope) };
  });
  const targets = new Set(sources.flatMap(source => source.records.flatMap(record => record.names)));
  const page = JSON.parse(fs.readFileSync(exclusionFile)).query.pages[0]; const revision = page.revisions[0];
  const exclusions = templates(revision.slots.main.content, 'JCW-exclude').map(parameters).map(({ names }) => names.slice(0, 2)).filter(([target, entry]) => targets.has(target) && entry);
  const filename = path.join(__dirname, '../shared/community_publishing_data.js');
  const data = require(filename);
  data.citewatch = { reviewed: '2026-10-04', sources, exclusions, exclusionSource: { title: 'CiteWatch: false-positive exclusions', revision: revision.revid, date: revision.timestamp.slice(0, 10), url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${revision.revid}` } };
  fs.writeFileSync(filename, `'use strict';\n// Generated local Wikimedia snapshots. See shared/COMMUNITY_DATA_NOTICE.md.\n;(function exposeCommunityPublishingData(root) {\n  const data = ${JSON.stringify(data, null, 2)};\n  if (typeof module === 'object' && module.exports) module.exports = data;\n  root.NotandiaCommunityPublishingData = data;\n})(typeof globalThis === 'object' ? globalThis : this);\n`);
  return sources.map(source => ({ scope: source.scope, records: source.records.length, revision: source.revision }));
}
if (require.main === module) console.log(JSON.stringify(generate(...process.argv.slice(2))));
module.exports = { splitParameters, extractRecords, templates };
