# Google generated and composite modules

Google search pages contain composite answer modules. They are not sources themselves. Notandia attributes context to the smallest concrete source unit that carries the evidence, not to an AI-generated answer, FAQ/question wrapper, or other composite parent.

This is part of Notandia's general source-context model, not a scholarly-only feature. A source can be a journal article, Wikipedia page, Healthline page, publisher page, news/article page, or another external URL. Scholarly identifiers are optional enrichment used when available.

## AI Overview

The outer `[data-subtree="mfc"]` AI Overview is never treated as a source. Based on the live Google DOM used for acceptance, Notandia scans these concrete child-source representations independently:

- inline cited-source wrappers: `span.WBgIic:has(a[href])`;
- canonical source cards: `li.h7wxwc > div.cRH23c[data-src-id]:has(a[href])`.

Google may render duplicate hidden/expanded copies of a source card. The `h7wxwc > cRH23c[data-src-id]` representation is used as the canonical visible card in the current adapter to reduce duplicate context counts. Sources inserted after expanding the overview are discovered by the dynamic rescan path.

## People Also Ask

Neither the outer People Also Ask module nor `.related-question-pair` is a source record. The question wrapper can contain multiple source URLs, so styling the wrapper would incorrectly make one nested publisher match color the entire answer.

Notandia instead scans source units inside the question independently:

- `span.WBgIic:has(a[href])` cited-source wrappers;
- `li.h7wxwc > div.cRH23c[data-src-id]:has(a[href])` source cards.

## Shared source and work identity

Publisher context and formal-integrity checks consume the same Google source selectors. Every selected source can contribute exact URL/hostname evidence for source or publisher context without requiring a DOI.

When the source also exposes a supported scholarly identifier, both scanners use `NotandiaWorkIdentifiers`:

1. extract DOI, PMID, PMCID, arXiv, and recognized scholarly-URL evidence when present;
2. optionally resolve PMID/PMCID through the governed NCBI provider;
3. attach the resolved DOI to the page record as `data-notandia-doi`;
4. use that DOI for formal Crossref/Retraction Watch lookup and to join alternate representations of the same work.

Europe PMC article URLs are normalized by the shared mapper, including both `/article/pmc/7102549` and `/article/pmc/PMC7102549` forms.

On result pages that expose the same work through multiple URLs, an unresolved result may inherit a DOI only when another result on the same page has an exact normalized title and that title maps to exactly one resolved DOI. Prefixes such as `RETRACTED:` and `WITHDRAWN:` are ignored only for this identity comparison. They are never accepted as formal-status evidence.

## Manual acceptance

Before merging changes to these selectors or the shared identity path, verify that:

- the AI Overview outer container is not publisher-styled;
- matching AI Overview source pills/cards are styled independently;
- expanding AI Overview discovers newly inserted source units;
- the People Also Ask outer module and `.related-question-pair` wrapper are not publisher-styled;
- matching sources inside an expanded question are styled independently;
- ordinary Google organic results still work;
- Google Scholar Europe PMC `/article/pmc/<numeric-id>` links resolve through the shared work mapper when NCBI metadata is enabled;
- alternate publisher, PubMed, and Europe PMC representations of the same work converge on the same formal status when resolvable;
- status-looking title text alone cannot create a formal status when the provider does not return one;
- popup counts do not inflate because the same hidden/duplicate Google source UI was scanned more than once.
