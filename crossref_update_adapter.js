'use strict';

;(function installCrossrefUpdateAdapter() {
  if (globalThis.NotandiaCrossrefUpdateAdapter || typeof globalThis.fetch !== 'function') return;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  const normalizeDOI = globalThis.MDPIIntegrity?.normalizeDOI;
  let nextReverseLookupAt = 0;

  async function waitForReverseLookupSlot() {
    const now = Date.now();
    const scheduled = Math.max(now, nextReverseLookupAt);
    nextReverseLookupAt = scheduled + 250;
    if (scheduled > now) await new Promise(resolve => setTimeout(resolve, scheduled - now));
  }

  function targetDoiFromUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.origin !== 'https://api.crossref.org' || url.search || !url.pathname.startsWith('/works/')) return null;
      return typeof normalizeDOI === 'function' ? normalizeDOI(decodeURIComponent(url.pathname.slice('/works/'.length))) : null;
    } catch {
      return null;
    }
  }

  function reverseUpdates(items, targetDoi) {
    if (!Array.isArray(items) || !targetDoi) return [];
    const updates = [];
    for (const item of items.slice(0, 100)) {
      const noticeDoi = typeof normalizeDOI === 'function' ? normalizeDOI(item?.DOI || item?.doi || '') : null;
      for (const relation of Array.isArray(item?.['update-to']) ? item['update-to'] : []) {
        const relationDoi = typeof normalizeDOI === 'function' ? normalizeDOI(relation?.DOI || relation?.doi || '') : null;
        if (!relation || relationDoi !== targetDoi) continue;
        updates.push({
          DOI: noticeDoi,
          type: relation.type,
          label: relation.label,
          source: relation.source || item.source || 'crossref',
          'record-id': relation['record-id'] ?? relation.recordId ?? null,
          updated: relation.updated || item.updated || item.created || item.published || null,
          date: relation.date || item?.published?.['date-time'] || item?.created?.['date-time'] || null
        });
      }
    }
    return updates;
  }

  async function enrichCrossrefSingleton(response, targetDoi, options) {
    let payload = null;
    try {
      if (response.ok) payload = await response.clone().json();
    } catch {
      return response;
    }
    if (Array.isArray(payload?.message?.['updated-by']) && payload.message['updated-by'].length) return response;

    try {
      await waitForReverseLookupSlot();
      const reverseUrl = `https://api.crossref.org/works?filter=updates:${encodeURIComponent(targetDoi)}&rows=100`;
      const reverseResponse = await nativeFetch(reverseUrl, {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' },
        signal: options?.signal
      });
      if (!reverseResponse.ok) return response;
      const reversePayload = await reverseResponse.json();
      const updates = reverseUpdates(reversePayload?.message?.items, targetDoi);
      if (!updates.length) return response;
      const enriched = payload && typeof payload === 'object' ? payload : { status: 'ok', 'message-type': 'work', message: {} };
      enriched.message = enriched.message && typeof enriched.message === 'object' ? enriched.message : {};
      enriched.message['updated-by'] = updates;
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json');
      return new Response(JSON.stringify(enriched), { status: 200, statusText: 'OK', headers });
    } catch {
      return response;
    }
  }

  globalThis.fetch = async function notandiaFetch(input, options) {
    const response = await nativeFetch(input, options);
    const targetDoi = targetDoiFromUrl(typeof input === 'string' || input instanceof URL ? input : input?.url);
    if (!targetDoi) return response;
    return enrichCrossrefSingleton(response, targetDoi, options || (typeof input === 'object' ? input : null));
  };

  globalThis.NotandiaCrossrefUpdateAdapter = Object.freeze({ targetDoiFromUrl, reverseUpdates });
})();
