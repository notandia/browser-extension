'use strict';

;(function installNcbiFetchProxy() {
  if (window.notandiaNcbiFetchProxyInstalled || typeof window.fetch !== 'function') return;
  window.notandiaNcbiFetchProxyInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const ENDPOINT_ORIGIN = 'https://www.ncbi.nlm.nih.gov';
  const ENDPOINT_PATH = '/pmc/utils/idconv/v1.0/';
  const MAX_IDS = 200;

  function requestDetails(input) {
    try {
      const raw = typeof input === 'string' || input instanceof URL ? input : input?.url;
      const url = new URL(String(raw || ''), document.location.href);
      if (url.origin !== ENDPOINT_ORIGIN || url.pathname !== ENDPOINT_PATH) return null;
      const idType = url.searchParams.get('idtype') || '';
      if (!['pmid', 'pmcid', 'doi'].includes(idType)) return null;
      const ids = (url.searchParams.get('ids') || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, MAX_IDS);
      return ids.length ? { idType, ids } : null;
    } catch {
      return null;
    }
  }

  function proxyRequest(details, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      let settled = false;
      const finish = callback => value => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        callback(value);
      };
      const resolveOnce = finish(resolve);
      const rejectOnce = finish(reject);
      const onAbort = () => rejectOnce(new DOMException('The operation was aborted.', 'AbortError'));
      signal?.addEventListener('abort', onAbort, { once: true });

      chrome.runtime.sendMessage({ type: 'ncbiIdConversion', idType: details.idType, ids: details.ids }, response => {
        if (signal?.aborted) return;
        if (chrome.runtime.lastError || !response?.success) {
          resolveOnce(new Response(JSON.stringify({ records: [] }), {
            status: 502,
            headers: { 'content-type': 'application/json' }
          }));
          return;
        }
        resolveOnce(new Response(JSON.stringify({ records: response.records || [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }));
      });
    });
  }

  window.fetch = function notandiaPageFetch(input, init) {
    const details = requestDetails(input);
    if (!details) return nativeFetch(input, init);
    const signal = init?.signal || (typeof input === 'object' ? input?.signal : null);
    return proxyRequest(details, signal);
  };
})();
