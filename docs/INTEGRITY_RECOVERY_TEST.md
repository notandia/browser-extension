# Integrity recovery and presentation smoke test

Use this test before merging the integrity recovery fix.

## Build

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Load `dist/chrome` or `dist/edge` as an unpacked extension and hard-refresh each test page.

## Nature pages

Open:

```text
https://www.nature.com/articles/s41569-020-0413-9
https://www.nature.com/articles/s41577-020-0311-8
```

Enable integrity checks and verify:

- MDPI and Frontiers matches appear from one stable publisher report;
- visible bibliography numbers remain unchanged;
- Frontiers and MDPI bibliography entries and inline citations use their configured profile colors;
- formal integrity status colors override publisher colors for affected works;
- a retracted-and-corrected work shows one red Retracted chip and one blue Corrected chip;
- filters and severity sorting work;
- the toolbar badge counts distinct contextual works, rather than suppressing publisher matches whenever formal signals exist;
- during integrity checking, the popup shows completed DOI records, attempted records, a percentage, and a progress bar.

For an affected reference such as reference 144, verify:

- the popup uses the visible reference number from `data-counter`;
- the bibliography item receives a formal-status border, tint, and text chip;
- the corresponding inline citation marker receives the same primary status color and dotted underline;
- clicking the popup record scrolls to the visible canonical reference;
- publisher-watchlist styling remains independent.

## MDPI bibliography page

On an MDPI article whose bibliography items use `data-content="25."` or similar, verify:

- the popup uses the visible bibliography number, not the trailing digits of the DOM ID;
- the MDPI badge is fully contained inside the highlighted reference entry;
- the built-in MDPI profile remains red (`#E2211C`) unless changed by the user;
- the publisher badge remains visibly distinct from formal integrity status chips.

## Recovery

After a completed scan:

1. open `chrome://extensions` or `edge://extensions`;
2. terminate the extension service worker;
3. return to the still-open article page;
4. reopen the popup without pressing Rescan.

The completed publisher and integrity reports should return from session storage. Completed integrity state must be written before the final update notification.

Repeat while a scan is incomplete. The stale loading snapshot must not be restored as a completed result; the scan should resume instead of remaining permanently stuck.

## NCBI proxy

With NCBI metadata enabled, verify that the page console no longer reports a CORS failure for:

```text
https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/
```

The request should appear in the extension background network log with omitted credentials and no referrer.
