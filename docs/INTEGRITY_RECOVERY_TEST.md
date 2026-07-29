# Integrity recovery and Nature presentation smoke test

Use this test before merging the integrity recovery fix.

## Build

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Load `dist/chrome` or `dist/edge` as an unpacked extension.

## Nature page

Open:

```text
https://www.nature.com/articles/s41569-020-0413-9
```

Enable integrity checks and allow the scan to finish.

For an affected reference such as reference 144, verify:

- the popup uses the visible reference number from `data-counter`;
- the bibliography item receives a formal-status border, tint, and text chip;
- the corresponding `a[data-test="citation-ref"]` marker receives the same status color and dotted underline;
- clicking the popup record still scrolls to the reference;
- publisher-watchlist styling remains independent.

## Recovery

After a completed scan:

1. open `chrome://extensions` or `edge://extensions`;
2. inspect and terminate/restart the extension service worker;
3. return to the still-open Nature page;
4. reopen the popup.

The extension should automatically request a fresh scan for that tab. While recovery is underway, the status counters display an ellipsis rather than a false zero. No manual Rescan click should be required.

## NCBI proxy

With NCBI metadata enabled, verify that the Nature page console no longer reports a CORS failure for:

```text
https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/
```

The request should appear in the extension background network log with omitted credentials and no referrer.
