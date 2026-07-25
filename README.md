# Notandia browser extension

**Notandia** is an independent, open-source browser extension for configurable publisher context and explainable formal post-publication signals. It is the public successor to **MDPI Filter** and uses one canonical source tree for Chrome, Microsoft Edge, Firefox, and Safari.

> **Independent project:** Notandia is not affiliated with, authorized by, or endorsed by MDPI AG, Frontiers Media, Crossref, Retraction Watch, NCBI, browser vendors, or any publisher or data provider. Publisher profiles identify content and apply user preferences; they are not objective publisher-quality scores.

## Browser outputs

| Target | Generated release asset | Distribution status |
|---|---|---|
| Chrome | `notandia-chrome-vX.Y.Z.zip` | Uploadable to the existing Chrome Web Store item |
| Microsoft Edge | `notandia-edge-vX.Y.Z.zip` | Uploadable to the existing Microsoft Edge Add-ons product |
| Firefox | `notandia-firefox-source-vX.Y.Z.zip` | First submission to AMO for Mozilla signing |
| Safari | `notandia-safari-source-vX.Y.Z.zip` | Local compatibility source; App Store publication deferred |

All packages are generated from the same source commit. Browser-specific manifests, store metadata, terminology restrictions, and credentials remain isolated.

## Features

### Personal publisher watchlists

- Built-in MDPI and Frontiers profiles are enabled with **Highlight** as the initial default.
- Every publisher, including MDPI and Frontiers, can be disabled independently.
- Each profile supports **Badge only**, **Highlight**, **Dim**, **Hide**, or **No page styling**.
- Colors and confirmed-versus-potential matching policy are configurable per publisher.
- Users can add validated custom profiles with publisher domains and DOI prefixes.
- Profile settings can be imported and exported as normalized JSON.
- Publisher matching is performed locally in the browser.
- Search results, current articles, bibliography entries, and supported related-article sections can be annotated.

### Formal integrity signals

- Checks the current article and DOI-bearing references for formal Crossref update relationships.
- Reports retractions, expressions of concern, corrections, reinstatements, withdrawals/removals, and duplicate-publication relationships when present in checked metadata.
- Queries both a work's singleton Crossref record and reverse `updates:<doi>` relationships, covering notices stored as separate records.
- Shows evidence type, chronology, source, coverage, deferred checks, and unresolved checks rather than producing an opaque quality score.
- Formal integrity status and publisher classification remain independent.

### Integrated context and reporting

- Combines publisher-profile matches and formal integrity events in one popup.
- Scrolls from a detected reference in the popup to the corresponding bibliography item where page structure permits.
- Provides structured reporting for missed/wrong publishers, confidence errors, missing/wrong integrity signals, layout problems, and suggested publisher presets.
- Prefilled reports omit query strings, URL fragments, citation text, and DOI lists unless the user adds them manually.

## Defaults and migration

- New Chrome, Edge, and Safari installations enable integrity checks because they are a core Notandia feature.
- Existing MDPI Filter installations do not silently enable new Crossref transmission when updated.
- Firefox keeps integrity checks opt-in because `websiteContent` is declared as optional data collection and must be granted by the user.
- Existing MDPI `highlight`/`hide` and potential-match preferences migrate into the MDPI publisher profile.
- MDPI remains fully deactivable after migration.

## Identity and update compatibility

Notandia is a public-facing rebrand of released Chrome, Edge, and Zotero software, not a replacement store item.

- Chrome keeps its existing extension ID and registered CRX signing key.
- Microsoft Edge keeps its existing Product ID and extension identity.
- Firefox has not been released and uses the new Gecko ID `browser-extension@notandia.github.io`.
- Existing storage keys and MDPI-specific internal identifiers remain only where changing them could reset settings or break upgrade compatibility.
- New release files, store-facing metadata, UI labels, documentation, and public project links use Notandia.

See [Identity compatibility](docs/IDENTITY_COMPATIBILITY.md).

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

Store publication is separate from package creation. The **Publish Browser Store** workflow downloads an already verified release asset, checks its SHA-256 hash, and uploads or submits it through the official store mechanism behind a protected GitHub Environment.

See [Multi-browser releases and store publication](docs/MULTI_BROWSER_RELEASES.md).

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
- Executes no remote code and has no runtime npm dependencies.
- Performs publisher-profile matching locally.
- Stores only validated profile and feature preferences in browser synchronization storage.
- Sends normalized DOI identifiers to Crossref only when integrity checks are enabled for that installation.
- Limits an integrity scan to 50 unique DOI requests and no more than four request starts per second.
- Cancels active and queued integrity requests when disabled, replaced by a newer scan, or navigation begins.
- Omits browser credentials and referrer information from NCBI and Crossref requests.
- Does not send complete page text, citation text, full URLs, search queries, browsing history, account identifiers, or analytics identifiers to Crossref.
- Supports a zero-network configuration.
- Uses pinned GitHub Actions and deterministic release inputs.

See [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), and the project website for current disclosures.

## Known limitations

Publisher identification depends on available domain, DOI, and metadata evidence. Potential name-only matching is optional because it is less reliable. Some dynamically loaded or unusual page structures may prevent safe annotation or scrolling.

Integrity coverage depends on DOI availability and the formal relationships present in Crossref. “No known signal” is not a guarantee that a work is correct or reliable; deferred, failed, and unresolved checks are not treated as clear.

Representative regression pages include PubMed Central, Europe PMC, Nature, Frontiers, MDPI, Cell, BMJ, ScienceDirect, Wiley, Sage, Taylor & Francis, Oxford Academic, LWW, and Wikipedia.

## License

- Code: [GNU AGPL-3.0-or-later](LICENSE-CODE)
- Logo: [CC BY-SA 4.0](LICENSE-LOGO)
