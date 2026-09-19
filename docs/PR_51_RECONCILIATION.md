# PR 51 reconciliation — 20 September 2026

PR #52 supersedes #51 for this release. The #51 branch is retained.

- Shared source extraction, centralized NCBI resolution, Europe PMC numeric identifiers, Wikipedia/Healthline adapters, publisher evidence, and removal of the fetch proxy are covered by #52.
- Settings now use a separate view; the user accepted the corrected popup and enlarged gear. Do not replace this with the older popup implementation.
- Ported the useful reference-count behavior directly into popup.js: exclude the current article and count each work once per status. No competing popup count updater is introduced.
- Defer #51 Google AI Overview/PAA source-card support. Its required live acceptance was not completed, and #52 deliberately excludes whole AI containers following reproduced false positives. Retain the branch as the implementation reference for future source-card work.
- Defer broad runtime namespace renaming. Existing aliases preserve compatibility; removing names is not required for the public Notandia identity.
- Do not carry over temporary marker files or tests that merely assert documentation wording.

Legacy migration is bounded: mode maps to the MDPI action, highlightPotentialMdpiSites maps to its confidence policy, and potentialMdpiHighlightColor maps to its color. Existing publisher profiles take precedence. loggingEnabled and ncbiApiEnabled keep their storage keys; migration writes only publisherWatchlist. Automated migration coverage is not a claim of a signed-store upgrade test.

User authorized reconciliation and merge on 20 September. Store uploads/submission and listing refresh remain separate release steps.
