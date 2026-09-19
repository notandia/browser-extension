(function() {
  'use strict';

  if (window.MDPIFilterReferenceIdExtractor) return;

  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;

  function normalizeReferenceId(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return SAFE_REFERENCE_ID.test(normalized) ? normalized : null;
  }

  function extractInternalScrollId(itemElement, currentRefIdCounter) {
    let idToUse = null;
    let nextRefIdCounter = Number.isInteger(currentRefIdCounter) && currentRefIdCounter >= 0
      ? currentRefIdCounter
      : 0;

    const candidates = [];
    const frontiersAnchor = itemElement.querySelector('a[name][id]');
    if (frontiersAnchor?.name && frontiersAnchor?.id) candidates.push(frontiersAnchor.name);

    const natureElement = itemElement.querySelector('p.c-article-references__text[id^="ref-CR"]');
    if (natureElement?.id) candidates.push(natureElement.id);

    if (itemElement.dataset?.id) candidates.push(itemElement.dataset.id);

    const scienceDirectAnchor = itemElement.querySelector('span.label a.anchor[id^="ref-id-b"]');
    if (scienceDirectAnchor?.id) candidates.push(scienceDirectAnchor.id);

    const scienceDirectSpan = itemElement.querySelector('span.reference[id^="rf"]');
    if (scienceDirectSpan?.id) candidates.push(scienceDirectSpan.id);

    const bmjAnchor = itemElement.querySelector('a.rev-xref-ref[id^="ref-"]');
    if (bmjAnchor?.id) candidates.push(bmjAnchor.id);

    if (itemElement.id) candidates.push(itemElement.id);
    candidates.push(
      itemElement.getAttribute('content-id'),
      itemElement.getAttribute('data-legacy-id'),
      itemElement.dataset?.bibId,
      itemElement.getAttribute('data-reference-id'),
      itemElement.dataset?.notandiaRefId,
      itemElement.dataset?.mdpiFilterRefId
    );

    for (const candidate of candidates) {
      idToUse = normalizeReferenceId(candidate);
      if (idToUse) break;
    }

    if (!idToUse) {
      idToUse = `mdpi-ref-${nextRefIdCounter++}`;
    }

    itemElement.dataset.mdpiFilterRefId = idToUse;
    return { extractedId: idToUse, updatedRefIdCounter: nextRefIdCounter };
  }

  window.MDPIFilterReferenceIdExtractor = {
    extractInternalScrollId,
    normalizeReferenceId
  };
})();
