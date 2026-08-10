# Manual acceptance: Google source modules and shared work identity

Use a fresh unpacked Chrome build from the candidate branch and hard-refresh each test page after reloading the extension.

## AI Overview

- Confirm the outer `[data-subtree="mfc"]` AI Overview is not highlighted or badged as a publisher.
- Confirm a matching source pill (`span.WBgIic`) or source card (`li.h7wxwc > div.cRH23c[data-src-id]`) can be highlighted independently.
- Include non-scholarly source URLs in the check when present; source context does not require a DOI.
- Expand the overview and confirm newly inserted source units are discovered without reloading the entire search page.
- Confirm unrelated source units remain untouched.

## People Also Ask

- Confirm the outer People Also Ask container is not highlighted or badged as a publisher.
- Confirm the `.related-question-pair` element itself has no `data-notandia-profile-style` merely because a nested source matches.
- Expand a question containing a matching source and confirm only its concrete source pill/card is evaluated and styled.
- Confirm another unrelated source in the same question/module does not inherit the match.

## Google Scholar shared identity

Search for the hydroxychloroquine/azithromycin trial represented by the following alternate URLs:

- ScienceDirect PII `S0924857920300996`;
- PubMed PMID `32205204`;
- Europe PMC numeric PMC path `https://europepmc.org/article/pmc/7102549`.

With NCBI metadata and formal DOI checks enabled:

- confirm the Europe PMC URL normalizes to PMCID `PMC7102549`;
- confirm the PubMed and Europe PMC records resolve to DOI `10.1016/j.ijantimicag.2020.105949`;
- confirm the publisher URL representation converges on that DOI only through the exact-title/unambiguous-identity rule;
- confirm every equivalent result unit receives the same provider-derived retracted status;
- confirm the literal `RETRACTED:` title prefix is not itself treated as formal evidence by disabling formal checks or testing a synthetic title-only fixture.

## General source adapters

- Confirm existing Wikipedia reference-list handling still identifies `cite_note` bibliography entries.
- Confirm existing Healthline trusted-source/Sources-list handling still identifies source units without requiring scholarly identifiers.

## Counts

- Confirm duplicate/hidden Google source UI does not inflate popup context counts.
- Confirm publisher and formal-integrity views are derived from the same selected source/result units, while formal integrity naturally includes only sources with a resolvable DOI.
