# Notandia source context model

Notandia operates on **source and citation units**, not only on scholarly papers.

A source unit is the smallest page element that represents an external source or a bibliographic citation in the host page's own information architecture. Examples include:

- an ordinary Google or Google Scholar result;
- an individual source card or cited-source pill inside Google AI Overview;
- an individual source inside a People Also Ask answer;
- a Wikipedia bibliography/reference-list entry;
- a Healthline trusted-source element or Sources-list citation;
- a journal article bibliography entry.

Not every hyperlink on a page is a source. Navigation, account, advertising, privacy, share, and unrelated UI links must not become source records merely because they contain a URL. Site/search adapters therefore identify source/citation units explicitly.

## Two layers, one source record

Every selected source unit can provide general context from exact URL/domain evidence. This does not require the source to have a DOI or to be a scholarly work.

For example, publisher/watchlist matching can classify a source from its hostname. A Wikipedia citation or Healthline source linking to an MDPI or Frontiers URL can therefore participate in publisher context even when no scholarly identifier is available locally.

Scholarly work identity is an **optional enrichment layer** on the same source record:

1. extract exact DOI, PMID, PMCID, arXiv, and recognized scholarly-URL evidence when present;
2. optionally resolve PMID/PMCID through the governed NCBI provider;
3. attach a resolved DOI as `data-notandia-doi` when available;
4. use the DOI for formal post-publication integrity lookup and for joining alternate representations of the same work.

Formal integrity lookup currently requires a DOI after local extraction/resolution. A source with no resolvable DOI can still receive publisher/source context; it simply cannot receive a DOI-based formal integrity status from that pipeline.

## Shared recognition contract

The publisher-context and formal-integrity scanners must consume the same source-unit selectors and the same `NotandiaWorkIdentifiers` mapper. Site-specific identifier parsing belongs in that shared mapper rather than being independently reimplemented as a second recognition system.

Google source selection is defined once in `NotandiaDomains.googleWeb.itemSelector`. Article-page citation/source selection is defined once in `NotandiaReferenceSelectors`.

## Composite Google modules

AI Overview and People Also Ask are answer containers, not source records. Only the concrete sources inside them are scanned. In the currently observed Google DOM these include cited-source wrappers such as `span.WBgIic:has(a[href])` and canonical source cards such as `li.h7wxwc > div.cRH23c[data-src-id]:has(a[href])`.

The outer `[data-subtree="mfc"]` AI Overview and `.related-question-pair` FAQ/question wrapper must never inherit publisher styling merely because one nested source matches a watchlist profile.

## Safety boundary

Source selection should prefer exact host-page structures over broad descendant scanning. Adding a new adapter requires a regression fixture or documented live structure showing that the selector represents a source/citation unit and does not sweep unrelated links into Notandia context counts.
