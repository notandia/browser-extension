# Release readiness: 19 September 2026

Status: **not ready for store submission**. This report records observed evidence, not completion of the [release checklist](store-release-checklist.md).

## Repository and pull requests

- `main`: `4595bad8a7356761def2dd8f9f191afaa5594871`.
- [PR #52](https://github.com/notandia/browser-extension/pull/52) is the shared-source foundation. Its initial head was `13b7e59808bfc2a3a994327dea1f4a2e729283c7`, with successful hosted checks, but it remains draft pending live acceptance.
- [PR #51](https://github.com/notandia/browser-extension/pull/51) has additional Google AI Overview / People Also Ask, popup, and runtime naming work. Its head is `629140f`. The author's [integration note](https://github.com/notandia/browser-extension/pull/51#issuecomment-5322387667) explicitly recommends validating #52 first and porting useful #51 changes onto that source model. Do not merge the branches blindly: they contain different versions of the shared scanner. #51 also contains temporary marker files and redundant documentation-policy tests that need review before integration.
- Initially there were no modified tracked files; only generated `dist/` outputs were untracked. Generated outputs are now ignored.

## Fixes and local evidence

- Fixed search result numbering: a missing `data-rp` attribute previously became `Number(null) === 0`, assigning result number 1 to every result without that attribute. A runtime regression test covers sequential fallback, explicit zero-based positions, and malformed positions.
- Restricted copied directories to `_locales`, `content`, `icons`, and `shared`, and excluded hidden files. This prevents editor configuration and unrelated output directories from entering browser packages. The build test places an unexpected directory in the checkout and verifies it is absent from every target.
- Node.js 24.18.1: `npm test` passes all 68 tests; `npm run build` produces Chrome, Edge, Firefox, and Safari targets; `git diff --check` passes.
- These results do not establish live-browser compatibility, migration correctness, or store acceptance.

## Store and release evidence

| Destination | Observed state | Remaining gate |
|---|---|---|
| Chrome | Publisher dashboard and [public listing](https://chromewebstore.google.com/detail/mdpi-filter/comknkeimaaadpiopddjoknflbmjeccp) show MDPI Filter 0.0.2, updated 25 June 2025. Dashboard still has the old description, screenshots and homepage/support links. | Upgrade tests, verified release artifact, refreshed listing/privacy forms and screenshots, draft upload inspection, review submission. |
| Edge | [Public listing](https://microsoftedge.microsoft.com/addons/detail/mdpi-filter/efonlkldplkaeekpiajloajjmkappjgi) remains titled MDPI Filter. GitHub's previous package manifest is 0.0.1; the live dashboard version was not verified. | Published-package comparison and upgrade tests, current listing/privacy metadata, draft upload and certification. |
| Firefox | Repository documents an unreleased first submission; dashboard status was not verified. AMO credential names exist. | Live consent/runtime tests and review of first-release metadata before actual AMO submission. |
| Safari | Source build only. | Apple packaging/signing, device testing, metadata and review prerequisites. |

All required secret **names** exist in `store-chrome`, `store-edge`, and `store-firefox`; secret values and validity were not inspected. All three environments require reviewer approval.

All four `https://mdpi-filter.pages.dev/privacy/<browser>/` URLs returned HTTP 200 on the audit date. This confirms reachability, not correctness of the store-dashboard disclosures.

The successful [July RC build](https://github.com/notandia/browser-extension/actions/runs/30155660868) produced four ZIPs and a checksum inventory for `v0.1.0-rc.1`. No stable `v0.1.0` release exists. The sole [store workflow run](https://github.com/notandia/browser-extension/actions/runs/30004805606) failed at deployment protection before any upload step ran.

Previous GitHub release packages were downloaded for comparison, and both ZIP integrity checks passed:

| Package | SHA-256 |
|---|---|
| Chrome v0.0.2 `mdpi-filter.zip` | `7c8fd23d65262b4e05363941721fea9df2586edbca21744925384b740fc44a7c` |
| Edge v0.0.1 `mdpi-filter.zip` | `91539146d672449cf0703ba3b9ebde471005b2fb699b067a8599cc144eaf1968` |

These are GitHub artifacts; equivalence to the currently served store packages has not been established. Their manifests request `storage`, `scripting`, and `webNavigation`; the current builds request only `storage` and retain the existing HTTPS host scope.

## Completion order

1. Run #52's live Scholar and bibliography acceptance tests against the exact rebuilt candidate. Validate settings migration using the existing store identities.
2. Port and validate the useful #51 changes on the shared-source foundation; remove temporary scaffolding from the proposed integration.
3. Complete the browser, privacy, accessibility, screenshot and upgrade evidence in the release checklist. Produce packages through GitHub Actions for the final tested commit.
4. Create the stable tag only after the release gates pass. Dispatch Chrome and Edge uploads with `submit=false` and obtain the configured environment approval.
5. Inspect both drafts and submit them for review. Submit Firefox separately after its first-release checks. Keep Safari source-only until its Apple prerequisites are complete.

Do not equate a passing test suite, a generated ZIP, or configured credentials with a published store update.
