# Multi-browser store release checklist

The first stable Notandia release must not receive a stable tag or be submitted to any browser store until every applicable item is evidenced.

## Package and provenance

- [ ] Use packages produced by the successful GitHub Actions run for the exact release commit.
- [ ] Record the commit SHA, workflow run, artifact checksums, manifest versions, and package sizes.
- [ ] Verify ZIP integrity and confirm there are no untracked or unexpected generated runtime files.
- [ ] Retain the previous Chrome and Edge store packages and rollback instructions.
- [ ] Compare the canonical Edge package with the currently published Edge package before replacing the old repository workflow.
- [ ] Test an update from the currently published MDPI Filter Chrome and Edge packages rather than only a fresh unpacked installation.

## Publisher-profile migration and behavior

- [ ] Confirm fresh installations start with MDPI and Frontiers enabled and set to Highlight.
- [ ] Confirm MDPI and Frontiers can each be disabled independently.
- [ ] Confirm context-only, badge, highlight, dim, and hide work independently for each built-in profile.
- [ ] Confirm per-profile colors apply without overwriting unrelated page inline styles.
- [ ] Confirm the published MDPI Filter `mode`, potential-match preference, and color migrate into the MDPI profile.
- [ ] Confirm an existing user who disabled MDPI in Notandia remains disabled after browser restart and synchronization.
- [ ] Confirm disabling MDPI removes legacy MDPI styling and suppresses its legacy badge count.
- [ ] Confirm Frontiers matches by `frontiersin.org` and DOI prefix `10.3389` without affecting unrelated publishers.
- [ ] Confirm the mature MDPI detector remains available as evidence when direct domain or DOI evidence is absent.
- [ ] Confirm multiple profile matches resolve deterministically and all matching publisher chips remain visible.
- [ ] Confirm custom profile validation rejects malformed domains, DOI prefixes, colors, IDs, and executable content.
- [ ] Confirm profile import/export round-trips valid data and cannot introduce scripts or executable selectors.
- [ ] Confirm repeated DOM mutations do not create duplicate badges, repeated styling, or an endless observer loop.
- [ ] Confirm publisher matching is described as a user-selected watchlist rule, never as an objective quality score.

## Privacy and listing disclosure

- [ ] Confirm the public Chrome, Edge, Firefox, and Safari privacy-policy URLs load successfully.
- [ ] Update the Chrome Web Store privacy form to disclose optional NCBI identifier requests and DOI/website-content transmission.
- [ ] Update the Microsoft Edge listing and privacy declarations with the same description.
- [ ] Confirm the Firefox listing exposes the privacy policy and Mozilla's optional `websiteContent` consent prompt.
- [ ] State consistently that publisher profiles are processed locally and stored through browser extension storage.
- [ ] State consistently that only validated scholarly identifiers are sent to NCBI and normalized DOI identifiers are sent to Crossref.
- [ ] State consistently that page/article text, citation text, full URLs, search queries, browsing history, publisher-profile settings, cookies, account identifiers, and analytics identifiers are not sent.
- [ ] Confirm the declared purpose is single-purpose scholarly context, not advertising, profiling, sale, credit assessment, or unrelated transfer.
- [ ] Use `store/LISTING_COPY.md` as the canonical dashboard-copy source.

## Runtime evidence

Perform the checks in current Chrome, Edge, and Firefox builds. Repeat Safari checks before any App Store submission.

- [ ] With integrity lookups disabled, confirm zero Crossref requests occur, including after navigation and DOM mutations.
- [ ] Enable lookups and inspect traffic on retraction, concern, correction, reinstatement, duplicate-publication, clean, unresolved, and more-than-50-DOI fixtures.
- [ ] Verify `10.1038/nature00870` is detected through the reverse Crossref `updates:<doi>` relationship and links to notice DOI `10.1038/s41586-024-07653-0`.
- [ ] Confirm every Crossref request contains only the DOI in the endpoint or filter and sends no cookies or referrer.
- [ ] Confirm request starts remain at or below four per second.
- [ ] Disable lookups during an active scan and confirm queued and in-flight requests stop.
- [ ] In Firefox, deny the optional data permission and confirm no Crossref request occurs; grant it and confirm lookups work.
- [ ] Confirm deferred, unresolved, not-found, and failed records are never labeled safe or clear.
- [ ] Confirm toolbar badge counts affected works once, not individual notices.
- [ ] Confirm reinstatement supersedes an older retraction while preserving the event history.
- [ ] Confirm publisher matching continues to work when integrity lookups are disabled.
- [ ] Confirm integrity signals work for references from publishers not present in the watchlist.

## Accessibility and presentation

- [ ] Verify each formal status has icon, text, and color; color is not the sole signal.
- [ ] Verify publisher chips contain readable text and remain distinct from formal integrity chips.
- [ ] Verify keyboard navigation, focus visibility, screen-reader labels, light mode, and browser zoom.
- [ ] Verify the settings page remains usable at narrow widths and with long custom publisher names.
- [ ] Capture the five store screenshots defined in `store/LISTING_COPY.md` from a clean tested browser profile.
- [ ] Generate the 440×280 and 1400×560 promotional tiles from the approved Notandia identity and verified release-candidate UI.
- [ ] Update release notes with watchlist semantics, migration behavior, limitations, Crossref/Retraction Watch attribution, and the opt-in privacy model.

## Store sequence

- [ ] Create the stable tag only after all checks above pass.
- [ ] Upload Chrome with `submit=false`; inspect the signed CRX draft and store declarations.
- [ ] Upload Edge with `submit=false`; inspect the draft and certification notes.
- [ ] Submit Chrome and Edge only after both drafts match the tested artifacts.
- [ ] Submit Firefox with `submit=true` only after reviewing the generated source package and listing metadata; AMO has no equivalent useful draft-only step in this workflow.
- [ ] Keep Safari source-only until Apple signing, device testing, App Store metadata, and review prerequisites are complete.
- [ ] Keep the dedicated Edge repository available until the canonical Edge update passes certification.

## Rollout and monitoring

- [ ] Use the smallest supported staged rollout for Chrome and Edge.
- [ ] Monitor only store-provided aggregate diagnostics and user reports; do not add product analytics.
- [ ] Expand rollout only after checking errors, permission-denial behavior, migration state, false-positive reports, and profile-disable behavior.
- [ ] Stop or roll back if privacy behavior, request load, compatibility, publisher matching, or integrity classification differs from the validated artifact.
