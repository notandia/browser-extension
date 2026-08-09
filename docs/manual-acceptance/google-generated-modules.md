# Manual acceptance: Google generated modules and scholarly identity

Use a fresh unpacked Chrome build from the candidate branch and hard-refresh each test page after reloading the extension.

## AI Overview

- Confirm the outer AI Overview container is not highlighted or badged as a publisher.
- Confirm a matching scholarly source inside the overview can be highlighted independently.
- Expand the overview and confirm newly inserted source units are discovered without reloading the entire search page.
- Confirm unrelated source units remain untouched.

## People Also Ask

- Confirm the outer People Also Ask container is not highlighted or badged as a publisher.
- Expand a question containing a matching scholarly source and confirm only that question/source unit is evaluated.
- Confirm another unrelated question in the same module is not inherited as a match.

## Google Scholar shared identity

Search for the hydroxychloroquine/azithromycin trial represented by the following alternate URLs:

- ScienceDirect PII `S0924857920300996`;
- PubMed PMID `32205204`;
- Europe PMC PMCID `PMC7102549`.

With NCBI metadata and formal DOI checks enabled:

- confirm the PubMed and Europe PMC records resolve to DOI `10.1016/j.ijantimicag.2020.105949`;
- confirm the publisher URL representation converges on that DOI only through the exact-title/unambiguous-identity rule;
- confirm every equivalent result unit receives the same provider-derived retracted status;
- confirm the literal `RETRACTED:` title prefix is not itself treated as formal evidence by disabling formal checks or testing a synthetic title-only fixture.

## Counts

- Confirm duplicate/hidden Google source UI does not inflate popup context counts.
- Confirm publisher and formal-integrity filters reflect the same underlying source/result units.
