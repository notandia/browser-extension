# Privacy policy

Last updated: 1 August 2026

Notandia, previously distributed as MDPI Filter, identifies user-selected publisher context and can optionally check scholarly DOI identifiers for formal post-publication updates.

## Data processed locally

The extension may inspect the current webpage to find:

- DOI identifiers for the current scholarly work;
- DOI identifiers and short citation text in a visible bibliography;
- publisher domains, links, references, and search results;
- matches against enabled built-in or custom publisher profiles.

Publisher profiles—including names, domains, DOI prefixes, actions, colors, and confidence policies—are stored and evaluated locally. Profiles cannot contain executable scripts or selectors.

This processing occurs inside the browser. Article text, bibliography text, publisher-profile settings, search queries, and the complete page address or browsing history are not sent to Notandia, an analytics service, or the research-integrity provider.

## Data sent for integrity lookups

Research-integrity lookups are **off by default**. When the user explicitly enables DOI checks, the extension sends normalized DOI identifiers to the Crossref REST API solely to retrieve scholarly metadata and post-publication update relationships, including retractions, expressions of concern, corrections, reinstatements, withdrawals/removals, and related notices.

The extension may query both the DOI's direct record and Crossref's reverse `updates:<doi>` relationship to find separately registered notices.

Requests:

- omit cookies and other credentials;
- use a no-referrer policy;
- do not include the webpage address, article text, citation text, publisher profiles, account identifiers, or analytics identifiers;
- are limited and rate-spaced to no more than four request starts per second.

Crossref operates independently and its own privacy terms apply to requests it receives.

## NCBI metadata requests

NCBI is an optional biomedical identifier resolver, not Notandia's primary identity system. NCBI lookups are disabled by default for new installations. When the user enables them, the extension sends only validated DOI, PMID, or PMCID identifiers to the documented PMC ID Converter endpoint. These requests help resolve identifier relationships when a page does not expose a direct DOI.

NCBI requests:

- omit browser credentials and referrer information;
- contain the public application label `NotandiaBrowser`;
- do not contain a personal NCBI username, personal maintainer address, or NCBI API key;
- are deduplicated, cached in memory, limited to 50 identifiers per batch, and started no more than once per second;
- stop during a cooldown after HTTP 403 or 429 responses and honor a valid `Retry-After` response;
- treat provider failure as unavailable or throttled, not as evidence that an article has no matching identifier.

A public extension package is inspectable. Notandia will not embed a personal address or private API credential in a browser release. A public project contact may be added only after it is created and registered with NCBI.

## Storage

The extension stores user settings, including publisher profiles, in browser synchronization storage.

Lookup-response caches remain only in the extension background process's memory. To recover the visible result state after a Manifest V3 service worker stops, the extension also stores a sanitized per-tab snapshot in browser session storage. A snapshot may contain normalized DOI identifiers, short bibliography text, detected publisher-profile matches, formal-update statuses, summary counts, and scan progress for the corresponding open tab.

Session snapshots:

- remain in memory and are not written to the extension's synchronized settings;
- are available only to trusted extension contexts under the browser's default session-storage access rules;
- are removed when the corresponding tab navigates or closes;
- are cleared when the extension is disabled, reloaded, or updated, and when the browser restarts.

The extension does not create an analytics profile or a persistent browsing-history database.

## User control

Users can independently disable MDPI, Frontiers, or any custom publisher profile and choose context-only, badge, highlight, dim, or hide behavior for each. They can add, remove, import, export, or reset profiles.

Integrity and NCBI lookups can be enabled or disabled at any time. Disabling integrity lookups cancels active requests and prevents new DOI requests. Disabling NCBI lookups prevents new PMC ID Converter requests. Firefox also requires separate optional website-content consent before integrity requests begin.

## Interpretation and limitations

A publisher watchlist match identifies configured publisher evidence. It is not a quality score and does not claim that every work from a matched publisher is unreliable.

The extension may limit DOI checks on pages with very large bibliographies and reports deferred or unresolved identifiers instead of treating them as clear. A message that no known signal was found means only that none was found in the checked sources.

## Logging

Diagnostic logging is disabled by default. When enabled by the user, logs remain in the browser's developer console unless the user manually copies or submits them.

## Reports and support

Issue reports are submitted only when the user chooses to open GitHub. The prefilled report includes the selected category, sanitized page origin/path, extension/browser information, enabled profile IDs, and whether integrity checks are enabled. It omits query strings, fragments, citation text, and DOI lists. Users should remove any information they do not want to publish before submitting.

Security reports should follow `SECURITY.md`. Privacy questions and correction requests may be opened in the repository issue tracker without including sensitive personal information.

## Independence

Notandia is an independent open-source project. It is not affiliated with, authorized by, or endorsed by MDPI AG, Frontiers Media SA, Crossref, Retraction Watch, NCBI, browser vendors, or any publisher or data provider.

## Changes

Material changes to data collection, recipients, or purposes will be documented here and in release notes before the corresponding extension update is published.
