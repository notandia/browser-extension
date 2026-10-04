# Publisher preset accessibility checks

Validated locally on 4 October 2026 against the built Chrome extension and the synthetic presentation page.

## Color and meaning

| Default | Color | Small-text contrast against its opaque white background |
|---|---|---|
| MDPI | `#B45309` | 5.02:1 |
| Frontiers | `#7C3AED` | 5.70:1 |
| Optional identification preset | `#48627A` | 6.36:1 |
| OMICS (optional) | `#0F766E` | 5.47:1 |
| iMedPub (optional) | `#9F1239` | 8.02:1 |
| Scientific Research Publishing (SCIRP) (optional) | `#4D7C0F` | 4.99:1 |
| Bentham Open (optional) | `#1D4ED8` | 6.70:1 |

These meet the [WCAG 2.2 small-text contrast threshold of 4.5:1](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Publisher names appear on reference badges. Highlighted inline citations retain their original text, use bold dotted underlining as a non-color cue, and expose the publisher through an accessible description. Follow the citation to its named bibliography badge to distinguish publishers without hue. This follows the [use-of-color guidance](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

Badges and highlighted citation text use an opaque white surface on both light and dark pages. Light custom colors retain their accent while using dark readable badge/citation text. Existing saved colors and actions are preserved; fresh installs receive the new defaults. Color does not imply confirmed article quality or current journal classification.

## Browser checks

- Loaded the built extension in an isolated Chromium profile; exercised its actual options page and popup.
- Checked the first-use lookup recommendation, keyboard activation, matching checkbox/storage state, disablement through the existing service toggles and Save quick settings, and remembered setup choice after reload. Regression tests additionally cover all four saved lookup combinations, independent settings, Firefox permission denial and network transmission gates.
- Checked named publisher controls, visible keyboard focus, and keyboard expansion of the sourced rationale.
- Confirmed fresh Settings show MDPI and Frontiers. Preset catalogue controls are absent. Publisher action changes and manually added publishers survive saving and reload. Export/import restores a manually added profile; Reset defaults returns to two profiles, and diagnostic logging changes survive reload.
- Confirmed the Additional publisher and journal warnings switch saves and reloads without adding profile cards. An intercepted synthetic HTTPS page exercises the installed extension: six of eight references match, including a publisher beyond the original four and a specific journal on a shared host. The other journal on that host stays unflagged. Preprints.org has a separate type label and explanation. Switching additional warnings off removes all dataset matches while preserving MDPI/Frontiers. Source links work by keyboard without toggling the checkbox. Full Settings and the content demo reflow at 320px; the popup is checked at its natural 480px width.
- Verified the popup’s MDPI flow with a reconstructed 50-reference layout: three matches, the current article excluded from the reference count, and expandable attributed source details. This was a fixture check, not live MDPI verification.
- Checked settings and demo reflow at 320 CSS pixels without horizontal scrolling.
- Measured the rendered MDPI/Frontiers badge and inline-citation contrast on light and dark backgrounds. All measured pairs met 4.5:1; synthetic retraction/correction citation text also passed.
- Checked that publisher names remain visible with forced colors enabled.
- Exercised the actual publisher matcher and formal-notice renderers using invented demo records. Formal notices remain visible when optional publisher identification is removed.
- Confirmed zero external requests and no page-script errors in the synthetic demo.

Run `npm test` for the contrast, migration, compatibility, and named-control regression checks. Run `npm run build` before the optional browser checker, `node scripts/check-preset-accessibility.js`. The browser checker requires an existing Playwright installation and Chromium; `NODE_PATH` can point to the desktop app's bundled Node packages. It creates an isolated temporary browser profile and records screenshots and measured results in a temporary directory. It does not use a personal browser profile or call research APIs.

## Limits

This is focused validation of the changed publisher controls and presentation, not a full WCAG certification of every extension flow or third-party page. A screen reader and the Firefox, Edge, and Safari interfaces were not manually exercised. User-selected Dim/Hide modes deliberately alter visibility; arbitrary third-party page typography remains outside these checks. The demo uses synthetic records and does not verify live provider coverage.

CiteWatch checks extend the browser fixture with a DOI-only Academic Journals reference and structured Alternative Medicine Review metadata. Both warn with source explanations. Journal of Management metadata and Bentham’s shared DOI prefix remain unflagged. Disabling the group removes the new warnings. The fixture now has 8 matches among 12 scanned references.
