# Privacy Policy for the Notandia Browser Extension

**Last updated:** July 25, 2026

Notandia, previously distributed as MDPI Filter, provides configurable publisher context and formal post-publication signals while users read scholarly literature. Publisher identification occurs locally; DOI integrity requests occur only when enabled for that installation.

## 1. Information handled locally

The extension may inspect HTTPS pages to identify:

- publisher domains and publisher names;
- DOI, PMID, and PMCID identifiers;
- bibliography and search-result structure;
- short citation text needed to present results locally;
- page elements needed to apply selected publisher actions or scroll to references;
- formal status metadata returned for DOI lookups.

Publisher profiles contain validated names, domains, DOI prefixes, colors, confidence policies, and display actions. Custom profiles cannot include executable scripts or page selectors.

The extension does not send complete page content, citation text, search queries, browsing history, or full page addresses to the developer or an analytics service.

## 2. Preferences and synchronization

Publisher and feature preferences are stored through browser extension storage and may be synchronized by the browser vendor when the user has enabled browser synchronization. Stored preferences may include:

- enabled publisher profiles;
- per-profile action and color;
- confirmed-only or potential-match policy;
- validated custom publisher domains and DOI prefixes;
- integrity, NCBI, and diagnostic-logging settings.

Notandia does not operate a separate account or synchronization server for these settings.

## 3. External communications

### NCBI resolution

When NCBI resolution is enabled, the extension sends bounded, validated DOI, PMID, or PMCID values to documented NCBI endpoints. Requests identify the application as `notandia` and omit browser cookies, other credentials, referrer information, and a developer email address.

NCBI resolution can be disabled independently; disabling it may reduce publisher-detection coverage when pages expose only PubMed identifiers.

### Crossref integrity lookups

When integrity checks are enabled, the extension sends normalized DOI identifiers to the Crossref REST API to retrieve scholarly metadata and formal update relationships such as retractions, expressions of concern, corrections, reinstatements, withdrawals/removals, and duplicate-publication relationships.

Defaults depend on installation context:

- fresh Chrome, Edge, and Safari installations enable integrity checks;
- existing MDPI Filter installations are not silently opted into new DOI transmission during an update;
- Firefox requires the user to enable the feature and grant optional `websiteContent` data collection.

Crossref requests:

- include normalized DOI identifiers and ordinary network metadata visible to Crossref, such as the user's IP address;
- may use reverse `updates:<doi>` queries when a notice is stored separately from the original work;
- omit page addresses, page/citation text, search queries, browser cookies, credentials, account identifiers, analytics identifiers, and referrers;
- are limited to no more than 50 unique DOI checks per page scan and four request starts per second;
- are cancelled when the feature is disabled, a scan is replaced, or navigation begins.

### User-initiated GitHub reports

Selecting the report control opens a public GitHub issue draft. The extension pre-fills a problem category, extension/browser version, enabled profile identifiers, integrity-check state, and the page origin/path while removing query parameters and fragments. Citation text and DOI lists are not added automatically. Nothing is submitted without user action.

## 4. Storage and retention

- Preferences remain in browser extension storage until changed, cleared, or the extension is removed.
- Publisher and integrity results are held in bounded background memory and are not used for tracking.
- Crossref lookup responses may remain in memory for up to 24 hours and disappear sooner when the background process stops.
- Per-tab context is cleared when navigation begins or a tab closes.
- The extension does not maintain a persistent browsing-history database or analytics profile.

## 5. Security and data-use boundaries

- The extension executes no remote code and ships no runtime npm dependencies.
- Page-derived content is rendered as text rather than injected as HTML.
- Messages, identifiers, and custom profiles crossing extension contexts are validated and bounded.
- Network requests use HTTPS, omit credentials, and use a no-referrer policy.
- The project contains no advertising or product analytics and does not sell or rent user data.

## 6. User choices and interpretation

Users can disable MDPI, Frontiers, or any other profile independently; change per-profile actions; remove custom profiles; disable NCBI or Crossref lookups; revoke Firefox's optional permission; disable diagnostic logging; clear synchronized data; disable the extension; or uninstall it.

A publisher-profile match represents an identification rule and user preference, not an objective claim about reliability. “No known signal” means only that none was found in checked metadata; it is not a claim that a work, journal, or publisher is reliable.

## 7. Independence and contact

Notandia is independent and is not affiliated with, authorized by, or endorsed by MDPI AG, Frontiers Media, Crossref, Retraction Watch, NCBI, browser vendors, or any publisher or data provider.

Questions and non-sensitive reports may be submitted through `notandia/browser-extension`. Security vulnerabilities should be reported privately as described in `SECURITY.md`.
