# Release security review — 31 July 2026

## Scope

Prompt-only Codex Security review of Browser PR #40 at commit `9559da5cce7bc0b4ccd33ee353c4f5a585a56950`, covering the changed privileged/background code, content-script message paths, Crossref and NCBI request boundaries, session recovery, popup rendering, manifest/CSP changes, and generated-package checks.

This review is not an app-backed Codex Security workspace scan and does not produce canonical scan artifacts or SARIF.

## Threat model

The review treated webpage DOM, URLs, citation metadata, imported publisher profiles, content-script messages, and third-party API responses as untrusted. Privileged sinks included extension storage, toolbar state, tab messaging, Crossref/NCBI network requests, and DOM presentation.

## Result

No validated critical, high, or medium-severity exploitable vulnerability was found in the reviewed change set.

The review found one release-blocking privacy disclosure mismatch: per-tab reports are now stored in `chrome.storage.session` to survive Manifest V3 worker stops, while the policy still described reports as background-memory-only. The policy was corrected in commit `9559da5cce7bc0b4ccd33ee353c4f5a585a56950` to disclose the data categories, in-memory session scope, access boundary, and deletion events.

## Existing safeguards verified

- privileged message handlers validate and normalize identifiers and record fields before use;
- Crossref and NCBI requests use fixed HTTPS providers, omit credentials and referrers, validate response type, and use timeouts;
- DOI, PMID, PMCID, profile IDs, colors, reference IDs, and imported publisher profiles are bounded and sanitized;
- integrity lookups are disabled by default and Firefox additionally requires optional website-content consent;
- Crossref work is bounded per scan and globally rate-spaced;
- session snapshots are tab-keyed and removed on navigation or tab closure;
- extension pages prohibit remote script execution through the manifest CSP;
- dynamic popup and page labels are constructed with text nodes/text content rather than interpreted as HTML.

## Low-severity hardening observations

- A hostile, rapidly changing page can keep presenting previously unseen DOI-shaped values while integrity checks are enabled. Per-scan limits, cancellation, caching, concurrency limits, and the global four-starts-per-second limiter constrain this, but a cumulative per-tab request budget would further reduce sustained provider/resource abuse.
- Internal scan-state messages should continue to use exact source/type validation as new message types are added, even though external-extension messages are delivered through `onMessageExternal`, which the extension does not register.

Neither observation was validated as a release-blocking exploit in the current code.

## Verification

The workflow for the reviewed commit completed successfully, including security and regression tests, Chrome/Edge/Firefox/Safari builds, and generated-manifest and packaged-runtime verification.

Manual browser acceptance and an app-backed Codex Security workspace scan remain separate release gates.
