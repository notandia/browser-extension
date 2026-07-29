# Privacy policy

Last updated: 29 July 2026

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

When enabled, NCBI lookups send only validated DOI, PMID, or PMCID identifiers. These requests help resolve publisher evidence when search results do not expose a direct DOI or publisher link. They omit browser credentials and referrer information.

## Storage

The extension stores user settings, including publisher profiles, in browser synchronization storage. Lookup responses and per-tab context reports are cached only in the extension background process's memory and may disappear when it stops. The extension does not create an analytics profile or persistent browsing-history database.

## User control

Users can independently disable MDPI, Frontiers, or any custom publisher profile and choose context-only, badge, highlight, dim, or hide behavior for each. They can add, remove, import, export, or reset profiles.

Integrity and NCBI lookups can be enabled or disabled at any time. Disabling integrity lookups cancels active requests and prevents new DOI requests. Firefox also requires separate optional website-content consent before integrity requests begin.

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
