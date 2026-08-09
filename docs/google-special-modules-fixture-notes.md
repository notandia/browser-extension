# Observed Google module structures

Manual 2026-08-09 fixtures showed:

- AI Overview root identified by `data-subtree="mfc"`, with visible source cards using `role="listitem"` and inline linked-source wrappers;
- People Also Ask questions identified by `.related-question-pair`, with answers inserted/expanded dynamically through `aria-controls` / `aria-expanded` state;
- the previous broad `div.MjjYud` Google selector could therefore treat an entire People Also Ask module as one search result and incorrectly attribute it to a publisher.

These selectors are compatibility observations, not guaranteed Google APIs, so manual acceptance remains required before release.
