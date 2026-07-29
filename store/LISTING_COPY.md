# Notandia browser-store listing copy

Use this file as the canonical source for Chrome Web Store, Microsoft Edge Add-ons, and Firefox Add-ons text. Store dashboards must be updated only after the matching release candidate has passed manual runtime testing.

## Product name

**Notandia**

The Chrome and Edge product name is read from the uploaded package manifest. Upload the update to the existing products; do not create replacement listings.

## Short summary

**Configurable publisher watchlists and formal post-publication signals for scholarly literature.**

## Full description

Notandia adds transparent publisher context and formal post-publication signals while you search for and read scholarly literature.

Previously distributed as MDPI Filter, Notandia retains its mature MDPI detection and expands it into configurable publisher watchlists. Built-in MDPI and Frontiers profiles are enabled and highlighted by default, and both can be independently disabled or changed.

### Publisher watchlists

Choose how Notandia treats each enabled publisher profile:

- show context only;
- add a publisher badge;
- highlight the article, reference, or search result;
- dim it;
- hide it.

Each profile has its own color and match policy. You can also add validated custom publisher profiles using domains and DOI prefixes, then import or export your profile settings. Custom profiles cannot contain scripts or executable page selectors.

A publisher watchlist match identifies publisher evidence selected in your settings. It is not an objective quality score and does not claim that every article from a matched publisher is unreliable.

### Article and reference context

Notandia can identify enabled publisher profiles in:

- current article pages;
- reference lists;
- supported scholarly and general search results;
- cited-by and similar-article sections where the page structure permits.

The popup combines publisher context with formal integrity signals while keeping the two concepts independent. A paper can be on a personal publisher watchlist without having a formal retraction or correction, and a retracted paper can come from any publisher.

### Retractions, corrections, and other formal updates

When you explicitly enable research-integrity checks, Notandia sends normalized DOI identifiers to Crossref to look for formal relationships including:

- retractions;
- expressions of concern;
- corrections and errata;
- withdrawals or removals;
- duplicate-publication notices;
- reinstatements.

Notandia checks both direct DOI metadata and reverse Crossref update relationships so separately registered notices can be discovered. It reports checked, unresolved, failed, and deferred records rather than labeling unchecked work as safe.

Research-integrity checks are off by default. Firefox additionally asks for optional website-content data permission before DOI checks begin.

### Privacy and independence

Publisher matching and custom profiles are processed locally. Notandia does not send publisher-profile settings, full pages, citation text, search queries, browsing history, cookies, account identifiers, or analytics identifiers to Crossref or the developer.

Optional NCBI metadata requests send only validated DOI, PMID, or PMCID identifiers. Optional Crossref requests send only normalized DOI identifiers and normal network metadata such as the user's IP address. Requests omit credentials and referrers.

Notandia contains no advertising, product analytics, remote code, or runtime npm dependencies.

Notandia is an independent open-source project. It is not affiliated with, authorized by, or endorsed by MDPI AG, Frontiers Media SA, Crossref, Retraction Watch, NCBI, browser vendors, or any publisher or data provider.

## Chrome category

**Workflow & Planning**

## Edge category

Use the closest available research, productivity, or workflow category.

## Search terms

Use no more than seven fields and respect each store's word limits:

1. `research integrity`
2. `retraction checker`
3. `publisher watchlist`
4. `scientific literature`
5. `PubMed references`
6. `Google Scholar`
7. `citation context`

Do not use `predatory publisher`, `bad journal`, or similar categorical claims as search terms.

## Screenshot sequence

Capture the same five 1280×800 screenshots from a tested release-candidate build. Use real extension UI and real public scholarly pages; do not fabricate detection results.

1. **Integrated article context**  
   Caption: `See publisher watchlist matches and formal integrity signals in one clear article view.`

2. **Configurable publisher watchlists**  
   Caption: `Enable or disable MDPI, Frontiers, and custom publishers independently.`

3. **Per-publisher actions**  
   Caption: `Choose context only, badge, highlight, dim, or hide for each publisher.`

4. **Reference-level formal updates**  
   Caption: `Find retractions, corrections, concerns, withdrawals, and reinstatements by DOI.`

5. **Privacy and coverage controls**  
   Caption: `Control NCBI and Crossref lookups and see checked, unresolved, and deferred coverage.`

Before capture:

- remove personal browser data and unrelated extensions;
- use a clean browser profile;
- ensure the displayed status is verified against the underlying Crossref record;
- avoid showing account names, local paths, bookmarks, or private tabs;
- keep publisher and formal-integrity chips visually distinct;
- include at least one screenshot showing MDPI can be disabled;
- include at least one screenshot showing Frontiers can be disabled;
- include the disclaimer that a watchlist match is not a quality score.

## Promotional tiles

### Small tile — 440×280

Headline: **Research context worth noticing**

Supporting line: **Publisher watchlists · Retractions · Corrections**

Use the approved Notandia symbol and palette. Avoid publisher logos, warning triangles, approval checkmarks, and claims that a publisher is categorically safe or unsafe.

### Marquee tile — 1400×560

Headline: **Make publisher context visible**

Supporting line: **Configurable watchlists and formal post-publication signals across scholarly literature**

Use the approved Notandia symbol, horizontal lockup, and representative interface fragments only after the release-candidate UI has been manually verified.

## Privacy disclosure for store forms

Notandia processes webpage content locally to extract scholarly identifiers, publisher evidence, and bibliography structure. Publisher watchlist settings remain in browser extension storage.

When NCBI metadata lookup is enabled, validated DOI, PMID, or PMCID identifiers are sent to NCBI. When research-integrity lookup is explicitly enabled, normalized DOI identifiers are sent to Crossref. These requests are necessary to provide the user-facing metadata and integrity-check features.

Notandia does not send complete page content, citation text, full page URLs, search queries, browsing history, publisher-profile settings, cookies, account identifiers, or analytics identifiers to the developer or Crossref. It does not sell data, use it for advertising, or use it for unrelated purposes.

## Transition text for existing Chrome and Edge users

**Previously MDPI Filter.** This update introduces the Notandia name, configurable publisher watchlists, integrated formal post-publication signals, and a redesigned interface. The existing Chrome and Edge product identities are retained so installed copies continue to receive updates.
