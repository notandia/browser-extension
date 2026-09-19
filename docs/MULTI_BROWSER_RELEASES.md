# Multi-browser releases and store publication

This repository is the canonical source for the Notandia browser extension. A single source commit generates isolated packages for Chrome, Microsoft Edge, Firefox, and Safari.

## Release outputs

A tag such as `v0.1.0` is intended to create one GitHub release containing:

- `notandia-chrome-v0.1.0.zip`
- `notandia-edge-v0.1.0.zip`
- `notandia-firefox-source-v0.1.0.zip`
- `notandia-safari-source-v0.1.0.zip`
- `checksums.txt`

The Edge ZIP is directly uploadable. The Chrome ZIP is the checksummed input used by the protected publication workflow to create a CRX with the registered key. Firefox and Safari are labelled `source`: Firefox must be signed by Mozilla, and Safari must be packaged and signed through Apple before ordinary installation.

All packages use the same runtime files. `platforms/<target>/manifest.json` contains target-specific manifest overlays, `store/<target>/` contains store metadata, and `platforms/<target>/policy.json` contains target-specific terminology restrictions.

## Current testing status

The following has been tested in pull-request CI:

- locked dependency installation;
- security and regression tests;
- generation of all four unpacked browser targets;
- generated manifest and runtime-file verification.

The GitHub-only release path was exercised by [run 30155660868](https://github.com/notandia/browser-extension/actions/runs/30155660868) for commit `d41dc02d733734c0b9bfea401d7b4856feaf7c5b`. The [v0.1.0-rc.1 prerelease](https://github.com/notandia/browser-extension/releases/tag/v0.1.0-rc.1) contains all four target ZIPs and `checksums.txt`. These July artifacts predate the subsequent runtime changes and are not the current release candidate.

The following has **not** yet been demonstrated end to end:

- downloading those release assets in the protected publication workflow;
- signing and uploading a Chrome CRX through the Chrome Web Store API;
- uploading or submitting an Edge package through Partner Center;
- signing or submitting the first Firefox package through AMO;
- protected-environment approvals during real store jobs.

The previous [store workflow attempt](https://github.com/notandia/browser-extension/actions/runs/30004805606) failed before any job steps ran: GitHub reported that the deployment was rejected or did not satisfy protection rules. This is not evidence of a store API upload attempt. Required reviewers must approve a future eligible deployment; do not remove the protection rules to get past it.

Do not describe store publication as operational until the draft-upload and submission paths have been exercised. See the [September release-readiness audit](RELEASE_READINESS_2026-09-19.md) for the remaining gates.

## Stable and prerelease versions

GitHub prerelease tags such as `v0.1.0-rc.1` are for building and inspecting candidate artifacts. They must not be uploaded to browser stores.

Browser manifests accept numeric versions, so both `v0.1.0-rc.1` and `v0.1.0` produce manifest version `0.1.0`, while the full candidate label is retained only as `version_name` where supported. Uploading an RC could therefore consume the numeric version intended for the stable release.

The **Publish Browser Store** workflow accepts only stable numeric tags such as `v0.1.0`. This validation exists in code but still requires a real workflow test.

## Local builds

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Generated targets:

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

## GitHub Environments

Configured environments:

- `store-chrome`
- `store-edge`
- `store-firefox`

Each environment should retain required reviewers, deployment restrictions to `main`, and only the secrets needed by that store. The environments being configured does not prove that the publication jobs work; each must be validated during the release process.

## Chrome Web Store

The intended workflow updates the existing Chrome Web Store item and supports Verified CRX Uploads. The Notandia release must remain on the existing item so installed users retain the update path.

Required `store-chrome` secrets:

```text
CHROME_PUBLISHER_ID
CHROME_EXTENSION_ID
CHROME_CLIENT_ID
CHROME_CLIENT_SECRET
CHROME_REFRESH_TOKEN
CHROME_CRX_PRIVATE_KEY_B64
```

Never commit or disclose the private key. The workflow is designed to reconstruct it only in the runner, validate that its public key derives `CHROME_EXTENSION_ID`, create a CRX from the verified ZIP, and remove temporary key material. This path still requires a real draft upload test with `submit=false` before it can be considered validated.

## Microsoft Edge Add-ons

The intended workflow updates the existing Partner Center product. The Notandia release must remain on that product so installed users receive the update.

Required `store-edge` secrets:

```text
EDGE_PRODUCT_ID
EDGE_CLIENT_ID
EDGE_API_KEY
```

An optional `EDGE_CERTIFICATION_NOTES` environment variable may be used. Test the first canonical package as a draft/upload before submission, inspect Partner Center, and keep `notandia/microsoft-edge` available until certification and upgrade behavior are confirmed.

## Firefox Add-ons

Firefox has not yet been released. The first submission will use this pre-release Gecko ID:

```text
browser-extension@notandia.github.io
```

The Firefox workflow uses Mozilla's `web-ext` client and requires:

```text
AMO_JWT_ISSUER
AMO_JWT_SECRET
```

There is no useful draft-only path in the current workflow: `submit=true` performs a real AMO submission. Before doing that, validate the Firefox package locally, review `store/firefox/amo-metadata.json`, test the optional `websiteContent` consent flow, and confirm the exact ID and listing metadata. After the first signed or listed submission, the Gecko ID becomes a compatibility identity and must remain stable.

## Safari status

The workflow only generates Safari-compatible source. Public distribution still requires Apple Developer Program membership, identifiers, Xcode or Safari Web Extension packaging, signing, physical-device testing, App Store metadata, privacy disclosures, and review.

## Release-candidate validation sequence

1. Create a GitHub-only prerelease tag.
2. Confirm the tag workflow creates exactly four ZIP assets plus `checksums.txt`.
3. Download and inspect every archive and generated manifest.
4. Complete `docs/store-release-checklist.md` for Chrome, Edge, Firefox, and Safari source.
5. Verify upgrade behavior from released Chrome and Edge installations.
6. Do not send the RC to any store.
7. Create the stable tag only after the RC evidence passes.
8. Run Chrome and Edge first with `submit=false` and inspect the resulting drafts/uploads.
9. Run real submission only after the draft paths and dashboard metadata are confirmed.
10. Submit Firefox only after its first-release review is complete.

## Release safety properties intended by the workflows

- one source commit generates all store packages;
- Actions are pinned to full commit hashes;
- release assets are generated only after tests pass;
- store jobs download and checksum existing release assets instead of rebuilding;
- Chrome signing validates the configured key against the extension ID;
- store publication rejects prerelease tags before credentials are used;
- credentials and approvals are isolated by store environment.

These are implemented controls, not evidence of a successful end-to-end release. Record the first real test results before marking them operational.
