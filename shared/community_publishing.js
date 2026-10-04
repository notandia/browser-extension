'use strict';

;(function exposeCommunityPublishing(root, factory) {
  const data = root.NotandiaCommunityPublishingData || (typeof module === 'object' && module.exports ? require('./community_publishing_data.js') : null);
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NotandiaCommunityPublishing = api;
})(typeof globalThis === 'object' ? globalThis : this, data => {
  if (!data) throw new Error('Community publishing dataset failed to load');
  const rules = new Map();
  const byHost = new Map();

  function hash(value, seed) {
    let result = seed;
    for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return (result >>> 0).toString(16).padStart(8, '0');
  }

  function hostname(value) { return String(value || '').toLowerCase().replace(/^www\./, ''); }
  function parseUrl(value) {
    try {
      const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null;
    } catch { return null; }
  }

  for (const [sourceIndex, source] of data.sources.entries()) {
    for (const entry of source.entries) {
      const url = parseUrl(entry);
      if (!url) throw new Error(`Invalid bundled URL: ${entry}`);
      const host = hostname(url.hostname);
      const query = Array.from(url.searchParams.entries()).sort();
      const key = JSON.stringify([host, url.port, url.pathname, query, url.hash]);
      const id = `community-${hash(key, 2166136261)}${hash(key, 3339675911)}`;
      const existing = rules.get(id);
      if (existing) {
        if (existing.key !== key) throw new Error('Community rule ID collision');
        if (!existing.sourceIndices.includes(sourceIndex)) existing.sourceIndices.push(sourceIndex);
        continue;
      }
      const path = url.pathname;
      const rule = { id, key, hostname: host, port: url.port, path, query, fragment: url.hash, url: url.href, sourceIndices: [sourceIndex] };
      rule.profile = Object.freeze({
        id, name: `${host}${path === '/' ? '' : path}${url.search}${url.hash}`.slice(0, 80),
        domains: Object.freeze([host]), doiPrefixes: Object.freeze([]), enabled: true,
        action: 'highlight', color: '#9F1239', confidencePolicy: 'confirmed-only', source: 'community'
      });
      rules.set(id, rule);
      if (!byHost.has(host)) byHost.set(host, []);
      byHost.get(host).push(rule);
    }
  }

  const citewatchRules = new Map();
  const byPrefix = new Map();
  const byName = new Map();
  // Text only: callers display these strings through textContent, never HTML.
  function plain(value) {
    return String(value || '').replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, '$2')
      .replace(/\[(https?:\/\/[^\]]+)\]/g, '$1').replace(/'{2,}/g, '')
      .replace(/&nbsp;/g, ' ').trim();
  }
  function nameKey(value) { return plain(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }
  const exclusionMap = new Map();
  for (const [target, entry] of data.citewatch?.exclusions || []) {
    const key = nameKey(target);
    if (!exclusionMap.has(key)) exclusionMap.set(key, new Set());
    exclusionMap.get(key).add(nameKey(entry));
  }
  for (const source of data.citewatch?.sources || []) {
    for (const record of source.records) {
      const key = JSON.stringify(record);
      const id = `community-cw-${hash(key, 2166136261)}${hash(key, 3339675911)}`;
      if (citewatchRules.has(id)) {
        if (JSON.stringify(citewatchRules.get(id).record) !== key) throw new Error('CiteWatch rule ID collision');
        continue;
      }
      // CiteWatch expressly limits this entry to Bentham Open. The shared
      // prefix and parent publisher cannot distinguish it from Bentham Science.
      const bentham = record.names[0] === 'Bentham Science Publishers';
      const namedControl = ['MDPI', 'Frontiers Media'].includes(record.names[0]);
      const limitedPublisher = record.scope === 'publisher' && /individual journals|journals individually|journals listed individually|several.*journal.*(?:listed|list|UGC)|book.*silent.*journals/i.test(plain(record.note));
      const prefixes = bentham || namedControl || limitedPublisher ? [] : record.prefixes;
      const profile = Object.freeze({ id, name: plain(record.names[0]).replace(/ \((publisher|journal)\)$/, ''), domains: Object.freeze([]),
        doiPrefixes: Object.freeze(prefixes), controlId: record.names[0] === 'OMICS Publishing Group' ? 'omics' : null, aliases: Object.freeze(record.names.map(plain)), enabled: true, action: 'highlight', color: '#9F1239',
        confidencePolicy: 'confirmed-and-potential', source: 'community' });
      const rule = { id, record, source, profile, prefixes };
      citewatchRules.set(id, rule);
      for (const prefix of prefixes) {
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
        byPrefix.get(prefix).push(rule);
      }
      // Notes about impostors, namesakes or favourable reassessments need an
      // additional identifier. Keep their notes, but disable name-only matching.
      const qualified = /although.*not|likely not|make sure|not.*journal|could be multiple|likely the|same\/similar name|hijacked/i.test(plain(record.note));
      if (namedControl || qualified || limitedPublisher) continue;
      for (const alias of record.names) {
        if (/^(Category|Wikipedia|User):/.test(alias)) continue;
        const name = nameKey(alias.replace(/ \((journal|publisher|magazine|newsletter)\)$/, ''));
        if (name.length < 8 || !name.includes(' ')) continue;
        const key = `${record.scope}:${name}`;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(rule);
      }
    }
  }
  function citewatchMatch(evidence) {
    const found = new Map();
    for (const doi of evidence.primaryDoi ? [evidence.primaryDoi] : evidence.dois || []) {
      const prefix = String(doi).toLowerCase().match(/^(10\.\d{4,9})\/\S+$/)?.[1];
      for (const rule of byPrefix.get(prefix) || []) found.set(rule.id, { rule, reason: 'citewatch-doi-prefix' });
    }
    for (const [scope, values] of [['journal', evidence.journalNames], ['publisher', evidence.publisherNames]]) {
      for (const value of values || []) {
        const name = nameKey(value);
        for (const rule of byName.get(`${scope}:${name}`) || []) {
          if (rule.record.names.some(target => exclusionMap.get(nameKey(target))?.has(name))) continue;
          if (!found.has(rule.id)) found.set(rule.id, { rule, reason: 'citewatch-metadata-name' });
        }
      }
    }
    const unique = new Map();
    for (const item of found.values()) if (!unique.has(nameKey(item.rule.profile.name))) unique.set(nameKey(item.rule.profile.name), item);
    return Array.from(unique.values(), ({ rule, reason }) => ({ profileId: rule.id, profileName: rule.profile.name,
      confidence: 'potential', reasons: [reason], action: rule.profile.action, color: rule.profile.color }));
  }

  function candidates(host) {
    const result = [];
    const parts = hostname(host).split('.');
    while (parts.length > 1) {
      result.push(...(byHost.get(parts.join('.')) || []));
      parts.shift();
    }
    return result;
  }

  function matchesUrl(rule, url) {
    if (rule.port && rule.port !== url.port) return false;
    if (rule.path !== '/' && url.pathname !== rule.path && !url.pathname.startsWith(`${rule.path.replace(/\/$/, '')}/`)) return false;
    if (rule.fragment && rule.fragment !== url.hash) return false;
    return rule.query.every(([name, value]) => url.searchParams.getAll(name).includes(value));
  }

  function match(evidence = {}) {
    const matched = new Map();
    const urls = (evidence.urls || []).map(parseUrl).filter(Boolean);
    for (const url of urls) {
      for (const rule of candidates(url.hostname)) {
        if (matchesUrl(rule, url)) matched.set(rule.id, rule);
      }
    }
    for (const host of evidence.hostnames || []) {
      for (const rule of candidates(host)) {
        // A hostname alone cannot establish a journal path or query selector.
        if (rule.path === '/' && !rule.port && !rule.query.length && !rule.fragment) matched.set(rule.id, rule);
      }
    }
    // One warning per listed host; prefer a journal-specific entry when both
    // that entry and a broader publisher entry match the same reference.
    const selected = new Map();
    for (const rule of matched.values()) {
      const previous = selected.get(rule.hostname);
      const specificity = rule.path.length + rule.query.length * 100 + rule.fragment.length;
      const previousSpecificity = previous ? previous.path.length + previous.query.length * 100 + previous.fragment.length : -1;
      if (specificity > previousSpecificity) selected.set(rule.hostname, rule);
    }
    const urlMatches = Array.from(selected.values(), rule => ({
      profileId: rule.id, profileName: rule.profile.name, confidence: 'confirmed',
      reasons: ['community-list-url'], action: rule.profile.action, color: rule.profile.color
    }));
    return urlMatches.length ? urlMatches : citewatchMatch(evidence);
  }

  const assessmentSources = {
    BLP: ['Beall’s original publisher list', 'https://beallslist.net/'],
    BLPU: ['Beall’s updated publisher list', 'https://beallslist.net/'],
    BLJ: ['Beall’s original journal list', 'https://beallslist.net/standalone-journals/'],
    BLJU: ['Beall’s updated journal list', 'https://beallslist.net/standalone-journals/'],
    BLV: ['Beall’s List: vanity presses', 'https://beallslist.net/vanity-press/'],
    QW: ['Quackwatch: nonrecommended periodicals', 'https://quackwatch.org/related/periodicals/'],
    DOAJ: ['DOAJ: false claims of indexing', 'https://blog.doaj.org/2014/08/28/some-journals-say-they-are-in-doaj-when-they-are-not/'],
    SPJJ: ['Stop Predatory Journals: journals', 'https://predatoryjournals.com/journals/'],
    SPJP: ['Stop Predatory Journals: publishers', 'https://predatoryjournals.com/publishers/']
  };
  function context(id) {
    const citewatch = citewatchRules.get(id);
    if (citewatch) {
      const { record, source } = citewatch;
      const origins = record.source.split(/\s*,\s*/).map(code => assessmentSources[code]).filter(Boolean);
      const originLabel = origins.map(([label]) => label).join(', ') || 'the assessment linked in its entry';
      return { reviewed: data.citewatch.reviewed, assessment: 'Listed by Wikipedia CiteWatch', sourceFamily: 'wikipedia-citewatch',
        explanation: `Wikipedia CiteWatch lists ${plain(record.names[0])}. Its entry cites ${originLabel}.`,
        evidence: [record.note ? `CiteWatch note: ${plain(record.note)}` : '',
          record.prefixes.length ? `Listed DOI prefixes: ${record.prefixes.join(', ')}. Prefixes can cover several journals and earlier ownership.` : '',
          'Name and prefix matches are marked as potential. Open the source entry to review its scope.'].filter(Boolean).join(' '),
        sources: [{ label: `${source.title} (${source.date})`, url: source.url },
          ...origins.map(([label, url]) => ({ label, url })),
          { label: 'CiteWatch: assessment sources and source keys', url: 'https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Questionable.cfg&oldid=1365447174#Sources' },
          { label: 'CiteWatch: false-positive exclusions', url: data.citewatch.exclusionSource.url }] };
    }
    const rule = rules.get(id);
    if (!rule) return null;
    const sources = rule.sourceIndices.map(index => data.sources[index]);
    return {
      reviewed: data.reviewed, assessment: 'Listed by Cite Unseen', sourceFamily: 'community-beall-derived',
      explanation: `This website appears in Wikimedia’s Cite Unseen ${sources.some(source => source.scope === 'journal') ? 'standalone-journal' : 'publisher'} list, in the edition dated 30 March 2026.`,
      evidence: `The lists draw on Beall’s list and Wikipedia’s predatory open-access source list. The matching entry is ${rule.url}.`,
      sources: sources.map(source => ({ label: `${source.title} (${source.date})`, url: source.url }))
    };
  }

  return Object.freeze({
    edition: data.edition, profiles: Object.freeze([...Array.from(rules.values(), rule => rule.profile), ...Array.from(citewatchRules.values(), rule => rule.profile)]),
    sourceEntryCounts: Object.freeze(data.sources.map(source => source.entries.length)),
    citewatchEntryCounts: Object.freeze((data.citewatch?.sources || []).map(source => source.records.length)),
    match, context
  });
});
