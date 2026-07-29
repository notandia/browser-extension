# Notandia browser extension

**Notandia** is an independent, open-source browser extension that adds configurable publisher context and explainable post-publication signals to scholarly literature. It preserves the mature MDPI-detection capabilities previously distributed as **MDPI Filter** while generalizing them into user-controlled publisher watchlists. This repository is the canonical source for Chrome, Microsoft Edge, Firefox, and Safari.

> **Independent project:** Notandia is not affiliated with, authorized by, or endorsed by MDPI AG, Frontiers Media SA, Crossref, Retraction Watch, NCBI, browser vendors, or any publisher or data provider. Publisher names and marks belong to their respective owners.

## Browser outputs

| Target | Generated release asset | Distribution status |
|---|---|---|
| Chrome | `notandia-chrome-vX.Y.Z.zip` | Uploadable to the existing Chrome Web Store item |
| Microsoft Edge | `notandia-edge-vX.Y.Z.zip` | Uploadable to the existing Microsoft Edge Add-ons product |
| Firefox | `notandia-firefox-source-vX.Y.Z.zip` | Submitted to AMO for Mozilla signing |
| Safari | `notandia-safari-source-vX.Y.Z.zip` | Local compatibility source; App Store publication deferred |

All packages are generated from the same source commit. Browser-specific manifests, store metadata, terminology restrictions, and credentials remain isolated.

## Features

### Configurable publisher watchlists

- Identify enabled publisher profiles in article pages, reference lists, and supported search-result pages.
- Ship built-in MDPI and Frontiers profiles, both enabled and highlighted by default on fresh installations.
- Allow every publisher profile—including MDPI—to be independently enabled or disabled.
- Apply a per-publisher action: context only, badge, highlight, dim, or hide.
- Configure a separate color and confirmed-only or potential-match policy for each profile.
- Add validated custom profiles using publisher domains and DOI prefixes.
- Import and export profile settings as versioned, declarative JSON; custom profiles cannot contain scripts or executable selectors.
- Preserve the mature MDPI detector as an additional evidence source for pages where direct publisher domains or DOI prefixes are unavailable.

A watchlist match identifies a publisher selected in the user's settings. It is not a quality score and does not claim that every article from a matched publisher is unreliable.

### Integrated article and reference context

- Present current-article publisher matches and formal update status together while keeping those concepts independent.
- Combine publisher-profile chips and retraction, correction, concern, withdrawal, duplicate-publication, and reinstatement signals in one reference/result view.
- Scroll from a popup record to its corresponding page reference where the page structure permits.
- Use structured issue-report categories for missed or incorrect publisher context, integrity status, confidence, layout, and suggested presets.

### Research-integrity metadata

- Optionally check the current article and DOI-bearing references for formal Crossref/Retraction Watch update relationships.
- Query both a work's direct Crossref metadata and reverse `updates:<doi>` relationships so separately registered notices can be found.
- Show evidence type, chronology, provenance, coverage, deferred checks, and unresolved checks instead of producing an opaque quality score.
- Keep research-integrity lookups off by default and allow NCBI and integrity network features to be disabled independently.

## Defaults and migration

Fresh installations begin with:

| Profile | Enabled | Action |
|---|---:|---|
| MDPI | Yes | Highlight |
| Frontiers | Yes | Highlight |

Both settings are user-controlled. Published MDPI Filter installations are migrated into the versioned watchlist schema. The legacy MDPI mode, potential-match preference, and color are preserved rather than overwritten by the new defaults.

## Identity and update compatibility

Notandia is a public-facing rebrand and expansion of released Chrome and Microsoft Edge software, not a replacement extension.

- Chrome keeps its existing extension ID and registered CRX signing key.
- Microsoft Edge keeps its existing Product ID and extension identity.
- Firefox has not been released; its first release uses Gecko ID `browser-extension@notandia.github.io`.
- Existing storage keys and MDPI-specific runtime identifiers remain temporarily where changing them could reset published-user settings or break compatibility.
- New release files, store-facing metadata, UI labels, documentation, and public project links use Notandia.

These legacy identifiers are compatibility mechanisms, not current product branding. See [Identity compatibility](docs/IDENTITY_COMPATIBILITY.md).

## Development

Requirements:

- Node.js 24
- npm
- `zip` for creating release archives locally

Run the complete verification and build:

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Generated unpacked extensions appear under:

```text
dist/chrome
dist/edge
dist/firefox
dist/safari
```

Build one target:

```bash
npm run build:target -- --target edge --version 0.1.0
```

## Releases

A protected version tag such as `v0.1.0` triggers the multi-browser release workflow. It:

1. Runs the security and regression suite.
2. Builds all browser targets independently.
3. Enforces store-specific terminology policies.
4. Creates reproducible ZIP archives.
5. Verifies each archive and manifest.
6. Publishes one GitHub release with all four packages and `checksums.txt`.

Store publication is intentionally separate from package creation. The **Publish Browser Store** workflow downloads the already verified release asset, checks its SHA-256 hash, and then uploads or submits it through the official store mechanism behind a protected GitHub Environment.

See [Multi-browser releases and store publication](docs/MULTI_BROWSER_RELEASES.md) for the exact account, secret, environment, and migration setup.

## Local installation

### Chrome

1. Build the Chrome target.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Select **Load unpacked** and choose `dist/chrome`.

### Microsoft Edge

1. Build the Edge target.
2. Open `edge://extensions`.
3. Enable Developer mode.
4. Select **Load unpacked** and choose `dist/edge`.

### Firefox

1. Build the Firefox target.
2. Open `about:debugging`.
3. Select **This Firefox → Load Temporary Add-on**.
4. Select `dist/firefox/manifest.json`.

Ordinary permanent installation requires Mozilla signing.

### Safari

Build the Safari target and use Safari's temporary web-extension development flow. The generated source package is not an App Store-signed application.

## Security and privacy

The extension:

- Uses Manifest V3 or the browser's compatible Web Extension form.
- Requests only `storage` as a standard extension permission.
- Executes no remote code.
- Includes no runtime npm dependencies.
- Stores publisher profiles locally through browser extension storage.
- Keeps Crossref integrity lookups off until the user explicitly enables them.
- Sends only bounded scholarly identifiers to documented APIs.
- Limits an integrity scan to 50 unique DOI requests and no more than four request starts per second.
- Cancels active and queued integrity requests when disabled, replaced by a newer scan, or navigation begins.
- Omits browser credentials and referrer information from NCBI and Crossref requests.
- Does not send complete page text, citation text, full URLs, search queries, browsing history, enabled publisher-profile data, account identifiers, or analytics identifiers to Crossref.
- Supports a zero-network configuration.
- Uses pinned GitHub Actions and deterministic release inputs.

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), and the project website for current disclosures.

## Known limitations

Some publisher pages use nonstandard, dynamically loaded, collapsed, or author-year citation structures. Reference-list detection can work even when inline-citation marking or scroll-to-reference cannot be performed safely. False-positive avoidance takes priority over guessing from weak journal-title evidence.

Publisher matching relies on configured domain, DOI-prefix, and mature legacy-MDPI evidence. A match is contextual metadata selected by the user, not a statement about an article's validity.

Integrity coverage depends on DOI availability and the formal relationships present in checked Crossref records. A result saying no known signal was found is not a guarantee that a work is correct or reliable. Deferred, failed, and unresolved checks are not treated as clear.

Representative regression pages include PubMed Central, Europe PMC, Nature, Frontiers, MDPI, Cell, BMJ, ScienceDirect, Wiley, Sage, Taylor & Francis, Oxford Academic, LWW, and Wikipedia pages. Regressions should be filed with the sanitized page URL, browser/version, extension version, expected result, and actual result.

## License

- Code: [GNU AGPL-3.0-or-later](LICENSE-CODE)
- Logo: [CC BY-SA 4.0](LICENSE-LOGO)
