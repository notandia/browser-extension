# Privacy policy

Last updated: 25 July 2026

Notandia, previously distributed as MDPI Filter, provides configurable publisher context and can check scholarly DOI identifiers for formal post-publication updates.

## Data processed locally

The extension may inspect the current webpage to identify:

- publisher domains and publisher names;
- DOI identifiers for the current scholarly work;
- DOI identifiers and short citation text in visible bibliographies or search results;
- PMID and PMCID identifiers when NCBI resolution is enabled;
- page elements needed to apply the user's selected publisher actions and scroll to references.

Publisher-profile matching is performed locally in the browser. Built-in and custom profiles contain only validated names, domains, DOI prefixes, colors, confidence policies, and display actions. Custom profiles cannot contain executable scripts or page selectors.

## Publisher-profile storage

The extension stores publisher-profile preferences in browser synchronization storage. These preferences may include:

- enabled or disabled state;
- display action: badge, highlight, dim, hide, or no page styling;
- selected color;
- confirmed-only or potential-match policy;
- validated custom publisher names, domains, and DOI prefixes.

Notandia does not transmit publisher-profile settings to the project developer. Browser synchronization services are operated by the browser vendor and are subject to the user's browser account and vendor privacy settings.

## Data sent for integrity lookups

When formal integrity checks are enabled, the extension sends normalized DOI identifiers to the Crossref REST API solely to retrieve scholarly metadata and update relationships, including retractions, expressions of concern, corrections, reinstatements, withdrawals/removals, duplicate-publication relationships, and related notices.

The default depends on installation context:

- new Chrome, Edge, and Safari installations enable integrity checks;
- existing MDPI Filter installations are not silently opted into new DOI transmission during an update;
- Firefox keeps integrity checks disabled until the user grants its optional `websiteContent` data permission;
- the setting can be disabled at any time.

Crossref requests:

- omit cookies and other browser credentials;
- use a no-referrer policy;
- include normalized DOI identifiers, including DOI values used in reverse `updates:<doi>` queries;
- do not include the webpage address, complete page text, citation text, search query, account identifier, or analytics identifier;
- are bounded and rate-spaced to no more than four request starts per second.

Crossref operates independently and its own privacy terms apply to requests it receives.

## Optional NCBI resolution

When NCBI resolution is enabled, bounded PMID, PMCID, or DOI identifiers may be sent to documented NCBI E-utilities endpoints to improve publisher detection. Requests omit browser credentials and referrer information. NCBI resolution can be disabled independently.

## Temporary processing and caching

Lookup responses and per-tab publisher/integrity reports are kept only in extension background memory and may disappear when the background process stops. Notandia does not create an analytics profile or persistent browsing-history database.

## User control

Users can:

- disable MDPI, Frontiers, or any other publisher profile independently;
- change each profile's action and color;
- remove custom profiles;
- disable integrity checks;
- disable NCBI resolution;
- disable diagnostic logging;
- export or import validated profile settings.

Disabling integrity checks cancels active requests and prevents new DOI requests. Disabling a publisher profile stops Notandia from presenting that publisher as a selected watchlist match.

## Coverage and limitations

Notandia may limit DOI checks on pages with very large bibliographies and reports deferred or unresolved identifiers instead of treating them as clear. “No known signal” means only that none was found in checked metadata.

Publisher identification is separate from formal integrity status. A publisher-profile match reflects the user's selected identification/display rules and is not an objective statement that the publisher or article is reliable or unreliable.

## Logging

Diagnostic logging is disabled by default. When enabled, logs remain in the browser's developer console unless the user manually copies or submits them.

## Reports and support

Issue reports are created only when the user chooses to open GitHub. The prefilled report includes a sanitized origin and path, selected problem category, extension/browser version, enabled profile identifiers, and integrity-check state. It omits query strings, URL fragments, citation text, and DOI lists unless the user adds them manually.

Users should remove any information they do not want to publish before submitting a GitHub issue.

## Independence

Notandia is an independent open-source project. It is not affiliated with, authorized by, or endorsed by MDPI AG, Frontiers Media, Crossref, Retraction Watch, NCBI, browser vendors, or any publisher or data provider.

## Changes

Material changes to data collection, recipients, defaults, or purposes will be documented here and in release notes before the corresponding extension update is published.
