# Google generated and composite modules

Google search pages contain composite modules that are not scholarly works themselves. Notandia must attribute context to the smallest source-level unit that carries the evidence, not to an AI-generated answer, FAQ container, or other composite parent.

## AI Overview

The outer `[data-subtree="mfc"]` AI Overview is never treated as a publication. Notandia scans visible source cards and inline cited-source wrappers inside the module individually. Sources inserted after expanding the overview are discovered by the normal dynamic rescan path.

## People Also Ask

The outer Google result/module is not treated as a publication merely because one expanded answer contains a matching source. Individual `.related-question-pair` units are evaluated independently so one source cannot color the whole FAQ block.

## Shared scholarly identity

Publisher context and formal-integrity checks use the same search-result selectors and scholarly identifier resolution path:

1. extract DOI, PMID, PMCID, and supported scholarly URL evidence from the source/result unit;
2. optionally resolve PMID/PMCID through the governed NCBI provider;
3. attach the resolved DOI to the page record as `data-notandia-doi`;
4. use that DOI both for publisher-profile matching and for formal Crossref/Retraction Watch checks;
5. present a returned formal status on every source/result unit on the page that has the same resolved DOI.

On result pages that expose the same work through multiple URLs, an unresolved result may inherit a DOI only when another result on the same page has an exact normalized title and that title maps to exactly one resolved DOI. Prefixes such as `RETRACTED:` and `WITHDRAWN:` are ignored only for this title-identity comparison. They are never accepted as formal-status evidence; formal status still comes from the configured provider lookup.

## Manual acceptance

Before merging changes to these selectors or the shared identity path, verify that:

- an AI Overview outer container is not publisher-styled;
- only the matching AI Overview source unit is styled;
- expanding AI Overview discovers newly inserted source units;
- a People Also Ask outer container is not publisher-styled;
- individual expanded questions/sources are evaluated independently;
- ordinary Google organic results still work;
- Google Scholar representations of the same DOI through publisher, PubMed, and Europe PMC URLs converge on the same formal status;
- status-looking title text alone cannot create a formal status when the provider does not return one;
- popup counts do not inflate because the same hidden/duplicate Google source UI was scanned more than once.
