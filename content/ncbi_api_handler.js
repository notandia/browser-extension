'use strict';

(() => {
  if (window.NotandiaNcbiApiHandler) return;

  const MDPI_DOI_PREFIX = '10.3390/';
  const BATCH_SIZE = 50;
  const MAX_IDS_PER_PAGE = 600;
  const MAX_CACHE_ENTRIES = 1000;

  let remainingLookupBudget = MAX_IDS_PER_PAGE;

  function notandiaSettings() {
    return window.NotandiaSettings || window.MDPIFilterSettings || {};
  }

  function normalizeId(id, idType) {
    if (typeof id !== 'string' && typeof id !== 'number') return null;
    let value = String(id).trim();
    if (!value) return null;

    if (idType === 'pmid') return /^\d{1,12}$/.test(value) ? value : null;
    if (idType === 'pmcid') {
      value = value.toUpperCase();
      return /^PMC\d{1,12}$/.test(value) ? value : null;
    }
    if (idType === 'doi') {
      value = value.split('#', 1)[0].split('?', 1)[0].trim().toLowerCase();
      return /^10\.\d{4,9}\/[^\s"',<>&]{1,240}$/.test(value) ? value : null;
    }
    return null;
  }

  function normalizeIdsForQuery(ids, idType) {
    if (!Array.isArray(ids)) return [];
    const unique = new Set();
    for (const rawId of ids) {
      const normalized = normalizeId(rawId, idType);
      if (normalized) unique.add(normalized);
    }
    return Array.from(unique);
  }

  function candidateRecordIds(record) {
    const versions = Array.isArray(record?.versions) ? record.versions : [];
    const values = new Set();
    for (const candidate of [record, ...versions]) {
      if (!candidate || typeof candidate !== 'object') continue;
      const pmid = normalizeId(candidate.pmid, 'pmid');
      const pmcid = normalizeId(candidate.pmcid, 'pmcid');
      const doi = normalizeId(candidate.doi, 'doi');
      if (pmid) values.add(pmid);
      if (pmcid) values.add(pmcid);
      if (doi) values.add(doi);
    }
    return values;
  }

  function recordIsMdpi(record) {
    const versions = Array.isArray(record?.versions) ? record.versions : [];
    return [record, ...versions].some(candidate => {
      const doi = normalizeId(candidate?.doi, 'doi') || '';
      return doi.startsWith(MDPI_DOI_PREFIX);
    });
  }

  function setBoundedCache(cache, key, value) {
    if (!(cache instanceof Map)) return;
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  }

  function writeResult(id, value, aliases, runCache, ncbiApiCache, persist) {
    const keys = new Set([id, ...(aliases.get(id) || [])]);
    for (const key of keys) {
      runCache.set(key, value);
      if (persist) setBoundedCache(ncbiApiCache, key, value);
    }
  }

  function sendProviderBatch(batch, idType) {
    return new Promise(resolve => {
      if (notandiaSettings().ncbiApiEnabled !== true) {
        resolve({ status: 'disabled', records: [], retryAfterMs: 0 });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: 'ncbiIdConversion', idType, ids: batch },
          response => {
            if (chrome.runtime.lastError || !response) {
              resolve({ status: 'unavailable', records: [], retryAfterMs: 0 });
              return;
            }
            resolve({
              status: String(response.providerStatus || (response.success ? 'ok' : 'unavailable')),
              records: Array.isArray(response.records) ? response.records : [],
              retryAfterMs: Math.max(0, Number(response.retryAfterMs) || 0)
            });
          }
        );
      } catch {
        resolve({ status: 'unavailable', records: [], retryAfterMs: 0 });
      }
    });
  }

  async function requestProviderRecords(ids, idType) {
    if (notandiaSettings().ncbiApiEnabled !== true) {
      return { status: 'disabled', records: [], retryAfterMs: 0 };
    }
    const normalized = normalizeIdsForQuery(ids, idType);
    if (!normalized.length) return { status: 'invalid', records: [], retryAfterMs: 0 };

    const allowed = normalized.slice(0, Math.max(0, remainingLookupBudget));
    if (!allowed.length) return { status: 'budget-exhausted', records: [], retryAfterMs: 0 };
    remainingLookupBudget -= allowed.length;

    const records = [];
    let status = 'ok';
    let retryAfterMs = 0;
    for (let offset = 0; offset < allowed.length; offset += BATCH_SIZE) {
      const batch = allowed.slice(offset, offset + BATCH_SIZE);
      const result = await sendProviderBatch(batch, idType);
      if (result.status === 'ok') records.push(...result.records);
      else if (status === 'ok') {
        status = result.status;
        retryAfterMs = result.retryAfterMs;
      }
    }
    return { status, records, retryAfterMs };
  }

  function resolutionMapFromRecords(records, idType, ids) {
    const doiById = new Map(ids.map(id => [id, null]));
    const workIds = window.NotandiaWorkIdentifiers;
    if (records.length && workIds?.resolutionMapsFromNCBI) {
      const maps = workIds.resolutionMapsFromNCBI(records);
      const sourceMap = idType === 'pmid' ? maps.pmidToDoi : idType === 'pmcid' ? maps.pmcidToDoi : null;
      if (sourceMap) {
        for (const id of ids) if (sourceMap.has(id)) doiById.set(id, sourceMap.get(id));
        return doiById;
      }
    }

    for (const record of records) {
      const versions = Array.isArray(record?.versions) ? record.versions : [];
      for (const candidate of [record, ...versions]) {
        const doi = normalizeId(candidate?.doi, 'doi');
        const candidateId = normalizeId(candidate?.[idType], idType);
        if (doi && candidateId && doiById.has(candidateId)) doiById.set(candidateId, doi);
      }
    }
    return doiById;
  }

  async function resolveNcbiIdsToDois(ids, idType) {
    if (!['pmid', 'pmcid', 'doi'].includes(idType)) {
      return { status: 'invalid', doiById: new Map(), records: [] };
    }
    const normalized = normalizeIdsForQuery(ids, idType);
    if (!normalized.length) return { status: 'invalid', doiById: new Map(), records: [] };

    if (idType === 'doi') {
      return { status: 'not-needed', doiById: new Map(normalized.map(id => [id, id])), records: [] };
    }

    const provider = await requestProviderRecords(normalized, idType);
    return {
      ...provider,
      doiById: resolutionMapFromRecords(provider.records, idType, normalized)
    };
  }

  async function checkNcbiIdsForMdpi(ids, idType, runCache, ncbiApiCache) {
    if (notandiaSettings().ncbiApiEnabled !== true) return false;
    if (!(runCache instanceof Map) || !(ncbiApiCache instanceof Map)) return false;
    if (!['pmid', 'pmcid', 'doi'].includes(idType) || !Array.isArray(ids)) return false;

    const aliases = new Map();
    for (const rawId of ids) {
      const normalized = normalizeId(rawId, idType);
      if (!normalized) continue;
      if (!aliases.has(normalized)) aliases.set(normalized, new Set());
      aliases.get(normalized).add(rawId);
      aliases.get(normalized).add(String(rawId).trim());
    }

    const normalizedIds = Array.from(aliases.keys());
    if (!normalizedIds.length) return false;

    const uncachedIds = [];
    for (const id of normalizedIds) {
      let cachedValue;
      let found = false;
      for (const candidate of [id, ...(aliases.get(id) || [])]) {
        if (ncbiApiCache.has(candidate)) {
          cachedValue = ncbiApiCache.get(candidate) === true;
          found = true;
          break;
        }
      }
      if (found) writeResult(id, cachedValue, aliases, runCache, ncbiApiCache, true);
      else uncachedIds.push(id);
    }

    if (uncachedIds.length) {
      const provider = await requestProviderRecords(uncachedIds, idType);
      if (provider.records.length) {
        const results = new Map(uncachedIds.map(id => [id, false]));
        for (const record of provider.records) {
          const isMdpi = recordIsMdpi(record);
          for (const candidateId of candidateRecordIds(record)) {
            if (results.has(candidateId)) results.set(candidateId, isMdpi);
          }
        }
        for (const [id, isMdpi] of results) {
          writeResult(id, isMdpi, aliases, runCache, ncbiApiCache, provider.status === 'ok');
        }
      } else if (provider.status === 'ok') {
        for (const id of uncachedIds) writeResult(id, false, aliases, runCache, ncbiApiCache, true);
      }
    }

    return normalizedIds.some(id => runCache.get(id) === true);
  }

  const handler = Object.freeze({
    checkNcbiIdsForMdpi,
    normalizeIdsForQuery,
    requestProviderRecords,
    resolveNcbiIdsToDois
  });

  window.NotandiaNcbiApiHandler = handler;
  window.MDPIFilterNcbiApiHandler = handler;
})();
