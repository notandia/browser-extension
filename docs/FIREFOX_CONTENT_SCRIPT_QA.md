# Firefox content-script scope regression

Firefox content scripts have a sandbox global distinct from `window`, with
`window` on its prototype chain. Shared identifier and publisher libraries are
registered on `globalThis`. Reading them from `window` prevented the source
context, publisher scanner and NCBI bridge from initialising.

Reference: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities#content_script_environment

## Fix and automated evidence

Read shared identifier/publisher helpers from `globalThis` in the source context,
publisher scanner, NCBI bridge and NCBI response mapper. No permissions, external
requests, page-script execution or security isolation changes are introduced.

`tests/firefox_global_scope.test.js` models Firefox's distinct, inheriting global
and loads the actual shared modules and scanner. Wikipedia and PubMed fixtures
both fail on the unpatched source before scanning begins; after the fix they
collect the DOI, apply an MDPI badge and publish the reference report. Existing
same-global browser fixtures remain in the suite.

## User-reported Android case

- Firefox for Android 158.0.2; Mozilla-listed Notandia 0.1.2.
- Normal tabs, both default/mobile view and Desktop site mode.
- Wikipedia's MDPI article and a PubMed paper containing MDPI citations.
- Settings/menu accessible; no source highlighting reported.

This report is consistent with the reproduced scope defect. It is not proof that
this is the only Android issue. A physical Android retest of the signed update
is still required; do not describe Android compatibility as verified yet.

## Retest after installing the signed update

1. Confirm the installed Notandia version is 0.1.6 or later.
2. Open a fresh normal tab on Wikipedia's MDPI article and reload it.
3. Confirm the MDPI profile is enabled with Highlight selected.
4. Inspect references containing MDPI links/DOIs for badges/highlighting.
5. Open the extension popup and confirm reference reports appear.
6. Repeat on the original PubMed paper in normal and Desktop site modes.
7. Check optional external lookups separately and only with explicit consent.
