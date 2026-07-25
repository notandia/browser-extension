# Notandia visual identity

## Concept

The mark is a geometric **N** built from three strong strokes. Its highlighted amber endpoint is the **notandum**: a point worth noting. The rounded ink field gives the symbol a stable silhouette at browser-toolbar sizes without resembling a warning shield, verification badge, or citation-generator icon.

The identity is intentionally calm and evidence-oriented:

- **N**: Notandia;
- **linked diagonal**: context connecting a publication to surrounding evidence;
- **amber point**: information worth noticing, not a verdict;
- **rounded square**: reliable app/extension silhouette across platforms.

## Primary colors

| Token | Value | Use |
|---|---|---|
| Ink | `#12263F` | Primary background and wordmark |
| Paper | `#F8FAFC` | Main mark and light surfaces |
| Note | `#FFC857` | Highlighted notandum point only |
| Muted ink | `#48627A` | Supporting interface text |

## Files

- `notandia-symbol.svg`: master icon-only mark;
- `notandia-symbol-transparent.svg`: mark without app-tile background;
- `notandia-symbol-mono-dark.svg`: one-color dark-field version;
- `notandia-symbol-mono-light.svg`: one-color light-field version;
- `notandia-wordmark.svg`: outlined wordmark with no font dependency;
- `notandia-lockup-horizontal.svg`: primary logo;
- `notandia-lockup-horizontal-dark.svg`: dark-surface presentation;
- `notandia-lockup-stacked.svg`: square/vertical presentation;
- `notandia-brand-review.png`: review sheet including small-size tests.

Runtime extension icons live in `/icons`. Store-ready square exports live in `/store/assets`.

## Usage rules

1. Use the icon-only mark for browser toolbars, store icons, favicons, GitHub avatars, and Zotero's add-on icon.
2. Use the horizontal lockup in website headers, documentation, and wide promotional assets.
3. Preserve at least one-quarter of the symbol width as clear space around a standalone mark.
4. Never recolor the amber point red or green; it represents noteworthy context, not failure or approval.
5. Do not add shields, checkmarks, warning triangles, journal initials, or publisher marks.
6. Do not place text inside the toolbar icon.
7. At 16×16 and 32×32, use the supplied raster exports rather than re-rasterizing with arbitrary settings.

## Wordmark

The wordmark is based on Inter Display SemiBold and converted to vector outlines. The SVG therefore does not require the font to be installed and must not be replaced with live text in production logo files.
