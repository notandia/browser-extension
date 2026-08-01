'use strict';

(() => {
  const root = globalThis;
  if (root.NotandiaWorkIdentifiers) return;

  const DOI_EXACT = /^10\.\d{4,9}\/[\w.()/:;+-]+$/i;
  const DOI_SEARCH = /\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi;
  const PMID_EXACT = /^\d{1,12}$/;
  const PMCID_EXACT = /^PMC\d{1,12}$/i;
  const ARXIV_NEW = /^(\d{4}\.\d{4,5})(?:v(\d+))?$/i;
  const ARXIV_OLD = /^([a-z][a-z0-9.-]+\/\d{7})(?:v(\d+))?$/i;
  const IDENTIFIER_TYPES = Object.freeze(['doi', 'pmid', 'pmcid', 'arxiv']);
  const CONFIDENCE = new Set(['exact', 'resolved', 'probable']);

  function safeDecode(value) {
    const text = String(value ?? '').trim();
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }

  function stripTrailingPunctuation(value) {
    return String(value || '').replace(/[\s\u00a0),.;:\]}>'"`]+$/g, '');
  }

  function normalizeDOI(value) {
    let normalized = safeDecode(value)
      .replace(/^doi\s*:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/[\s\u00a0]+/g, '');
    normalized = stripTrailingPunctuation(normalized).toLowerCase();
    return DOI_EXACT.test(normalized) ? normalized : null;
  }

  function normalizePMID(value) {
    let normalized = safeDecode(value)
      .replace(/^pmid\s*:\s*/i, '')
      .trim();

    try {
      const url = new URL(normalized);
      const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      if (hostname === 'pubmed.ncbi.nlm.nih.gov') {
        normalized = url.pathname.match(/^\/(\d{1,12})\/?/)?.[1] || '';
      } else if (hostname === 'ncbi.nlm.nih.gov' || hostname.endsWith('.ncbi.nlm.nih.gov')) {
        normalized = url.searchParams.get('list_uids') ||
          url.pathname.match(/\/pubmed\/(\d{1,12})(?:\D|$)/i)?.[1] ||
          '';
      }
    } catch {
      const explicit = normalized.match(/(?:^|\b)PMID\s*:?\s*(\d{1,12})(?:\b|$)/i)?.[1];
      if (explicit) normalized = explicit;
    }

    return PMID_EXACT.test(normalized) ? normalized : null;
  }

  function normalizePMCID(value) {
    let normalized = safeDecode(value)
      .replace(/^pmcid\s*:\s*/i, '')
      .trim();

    try {
      const url = new URL(normalized);
      const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      if (hostname === 'pmc.ncbi.nlm.nih.gov' || hostname === 'ncbi.nlm.nih.gov' || hostname.endsWith('.ncbi.nlm.nih.gov')) {
        normalized = url.pathname.match(/\/(?:articles\/)?(PMC\d{1,12})(?:\D|$)/i)?.[1] || '';
      }
    } catch {
      const explicit = normalized.match(/(?:^|\b)(PMC\d{1,12})(?:\b|$)/i)?.[1];
      if (explicit) normalized = explicit;
    }

    normalized = normalized.toUpperCase();
    return PMCID_EXACT.test(normalized) ? normalized : null;
  }

  function parseArxiv(value) {
    let normalized = safeDecode(value)
      .replace(/^arxiv\s*:\s*/i, '')
      .trim();

    try {
      const url = new URL(normalized);
      const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      if (hostname === 'arxiv.org' || hostname.endsWith('.arxiv.org')) {
        normalized = url.pathname
          .replace(/^\/(?:abs|pdf|html)\//i, '')
          .replace(/\.pdf$/i, '')
          .replace(/^\/+|\/+$/g, '');
      }
    } catch {
      // Prefix and bare-ID handling continues below.
    }

    normalized = stripTrailingPunctuation(normalized);
    const match = normalized.match(ARXIV_NEW) || normalized.match(ARXIV_OLD);
    if (!match) return null;
    return Object.freeze({
      id: match[1].toLowerCase(),
      version: match[2] ? Number(match[2]) : null
    });
  }

  function normalizeArxiv(value) {
    return parseArxiv(value)?.id || null;
  }

  function emptyIdentity() {
    return {
      identifiers: {
        doi: [],
        pmid: [],
        pmcid: [],
        arxiv: []
      },
      evidence: [],
      canonicalKey: null
    };
  }

  function normalizeEvidenceMetadata(options = {}) {
    const source = String(options.source || 'local').trim().slice(0, 80) || 'local';
    const method = String(options.method || 'exact-value').trim().slice(0, 80) || 'exact-value';
    const confidence = CONFIDENCE.has(options.confidence) ? options.confidence : 'exact';
    return { source, method, confidence };
  }

  function canonicalKey(identity) {
    for (const type of IDENTIFIER_TYPES) {
      const first = Array.isArray(identity?.identifiers?.[type])
        ? [...identity.identifiers[type]].sort()[0]
        : null;
      if (first) return `${type}:${first}`;
    }
    return null;
  }

  function finalize(identity) {
    for (const type of IDENTIFIER_TYPES) {
      identity.identifiers[type] = Array.from(new Set(identity.identifiers[type])).sort();
    }
    const seenEvidence = new Set();
    identity.evidence = identity.evidence.filter(entry => {
      const key = [entry.type, entry.value, entry.source, entry.method, entry.confidence].join('|');
      if (seenEvidence.has(key)) return false;
      seenEvidence.add(key);
      return true;
    });
    identity.canonicalKey = canonicalKey(identity);
    return identity;
  }

  function addIdentifier(identity, type, value, options = {}) {
    if (!IDENTIFIER_TYPES.includes(type) || !value) return false;
    const normalizers = {
      doi: normalizeDOI,
      pmid: normalizePMID,
      pmcid: normalizePMCID,
      arxiv: normalizeArxiv
    };
    const normalized = normalizers[type](value);
    if (!normalized) return false;
    identity.identifiers[type].push(normalized);
    const metadata = normalizeEvidenceMetadata(options);
    const evidence = {
      type,
      value: normalized,
      source: metadata.source,
      method: metadata.method,
      confidence: metadata.confidence
    };
    const parsedArxiv = type === 'arxiv' ? parseArxiv(value) : null;
    if (parsedArxiv?.version) evidence.version = parsedArxiv.version;
    identity.evidence.push(evidence);
    return true;
  }

  function parseUrl(value, identity, options) {
    let url;
    try {
      url = new URL(safeDecode(value));
    } catch {
      return;
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'doi.org' || hostname === 'dx.doi.org') {
      addIdentifier(identity, 'doi', url.href, { ...options, method: 'doi-url' });
    }
    if (hostname === 'pubmed.ncbi.nlm.nih.gov') {
      addIdentifier(identity, 'pmid', url.href, { ...options, method: 'pubmed-url' });
    }
    if (hostname === 'pmc.ncbi.nlm.nih.gov' || hostname.endsWith('.ncbi.nlm.nih.gov')) {
      addIdentifier(identity, 'pmcid', url.href, { ...options, method: 'pmc-url' });
      addIdentifier(identity, 'pmid', url.href, { ...options, method: 'ncbi-url' });
    }
    if (hostname === 'arxiv.org' || hostname.endsWith('.arxiv.org')) {
      addIdentifier(identity, 'arxiv', url.href, { ...options, method: 'arxiv-url' });
    }
  }

  function extractOne(value, identity, options = {}) {
    const text = String(value ?? '').trim();
    if (!text) return;

    parseUrl(text, identity, options);

    addIdentifier(identity, 'doi', text, { ...options, method: options.method || 'doi-value' });
    addIdentifier(identity, 'pmid', text, { ...options, method: options.method || 'pmid-value' });
    addIdentifier(identity, 'pmcid', text, { ...options, method: options.method || 'pmcid-value' });
    addIdentifier(identity, 'arxiv', text, { ...options, method: options.method || 'arxiv-value' });

    for (const found of text.matchAll(DOI_SEARCH)) {
      addIdentifier(identity, 'doi', found[0], { ...options, method: 'doi-text' });
    }
    for (const found of text.matchAll(/\bPMID\s*:?\s*(\d{1,12})\b/gi)) {
      addIdentifier(identity, 'pmid', found[1], { ...options, method: 'pmid-text' });
    }
    for (const found of text.matchAll(/\bPMC\d{1,12}\b/gi)) {
      addIdentifier(identity, 'pmcid', found[0], { ...options, method: 'pmcid-text' });
    }
    for (const found of text.matchAll(/\barXiv\s*:\s*((?:\d{4}\.\d{4,5}|[a-z][a-z0-9.-]+\/\d{7})(?:v\d+)?)\b/gi)) {
      addIdentifier(identity, 'arxiv', found[1], { ...options, method: 'arxiv-text' });
    }
  }

  function flattenValues(values) {
    if (values == null) return [];
    if (Array.isArray(values)) return values.flatMap(flattenValues);
    if (values instanceof Set) return Array.from(values).flatMap(flattenValues);
    if (typeof values === 'object') return Object.values(values).flatMap(flattenValues);
    return [values];
  }

  function extract(values, options = {}) {
    const identity = emptyIdentity();
    for (const value of flattenValues(values)) extractOne(value, identity, options);
    return finalize(identity);
  }

  function merge(...identities) {
    const merged = emptyIdentity();
    for (const identity of identities.flat()) {
      if (!identity) continue;
      for (const type of IDENTIFIER_TYPES) {
        for (const value of identity.identifiers?.[type] || []) merged.identifiers[type].push(value);
      }
      for (const evidence of identity.evidence || []) merged.evidence.push({ ...evidence });
    }
    return finalize(merged);
  }

  function identitiesFromNCBIRecords(records, options = {}) {
    const source = options.source || 'ncbi-id-converter';
    const identities = [];
    for (const record of Array.isArray(records) ? records : []) {
      const candidates = [record, ...(Array.isArray(record?.versions) ? record.versions : [])];
      const identity = emptyIdentity();
      for (const candidate of candidates) {
        addIdentifier(identity, 'doi', candidate?.doi, { source, method: 'provider-record', confidence: 'resolved' });
        addIdentifier(identity, 'pmid', candidate?.pmid, { source, method: 'provider-record', confidence: 'resolved' });
        addIdentifier(identity, 'pmcid', candidate?.pmcid, { source, method: 'provider-record', confidence: 'resolved' });
      }
      const finalized = finalize(identity);
      if (finalized.canonicalKey) identities.push(finalized);
    }
    return identities;
  }

  function resolutionMapsFromNCBI(records) {
    const pmidToDoi = new Map();
    const pmcidToDoi = new Map();
    for (const identity of identitiesFromNCBIRecords(records)) {
      const doi = identity.identifiers.doi[0];
      if (!doi) continue;
      for (const pmid of identity.identifiers.pmid) pmidToDoi.set(pmid, doi);
      for (const pmcid of identity.identifiers.pmcid) pmcidToDoi.set(pmcid, doi);
    }
    return { pmidToDoi, pmcidToDoi };
  }

  function resolvedDOI(identity, maps) {
    const normalized = identity?.identifiers ? identity : extract(identity);
    for (const pmid of normalized.identifiers.pmid || []) {
      if (maps?.pmidToDoi?.has(pmid)) return maps.pmidToDoi.get(pmid);
    }
    for (const pmcid of normalized.identifiers.pmcid || []) {
      if (maps?.pmcidToDoi?.has(pmcid)) return maps.pmcidToDoi.get(pmcid);
    }
    return normalized.identifiers.doi?.[0] || null;
  }

  root.NotandiaWorkIdentifiers = Object.freeze({
    IDENTIFIER_TYPES,
    normalizeDOI,
    normalizePMID,
    normalizePMCID,
    normalizeArxiv,
    parseArxiv,
    extract,
    merge,
    canonicalKey,
    identitiesFromNCBIRecords,
    resolutionMapsFromNCBI,
    resolvedDOI
  });
})();
