# Popup scrolling regression check

Version: 0.1.5

The popup uses a bounded main scroll region. Its scrollbar remains visible and
draggable in WebKit/Chromium, including macOS configurations that hide overlay
scrollbars. The main region is keyboard focusable and has a visible focus outline.
There are no custom wheel handlers or changes to article-page reference navigation.

## Manual check

1. Load the built Safari extension and visit an article with a long reference list.
2. Open the popup. Check that the track and thumb appear along its right edge.
3. Scroll through the list with the trackpad/wheel, then drag the scrollbar thumb.
   Check that the popup moves and the article behind it stays in position.
4. Use Tab to focus the main area; check keyboard scrolling and focus visibility.
5. Check settings, filtering and expanded evidence remain reachable.
6. Repeat at narrow mobile widths; controls must stay within the popup.

## Validation recorded 23 October 2026

- Existing extension verification and 151 tests passed; all four targets built.
- Chromium interaction/layout checks with 100 references passed at widths 320,
  390, 430 and 480 CSS px: bounded 600 px scroll region, keyboard navigation to
  the end, no horizontal document overflow, last reference reachable, and no
  outer-page scrolling. Desktop wheel scrolling also passed.
- The updated Safari-target build was loaded as a separate temporary extension.
  Mario confirmed that scrolling inside its popup works perfectly.
- This change was not tested on a physical iPhone. The mobile checks above are
  Chromium layout checks, not a new iOS Safari certification.
