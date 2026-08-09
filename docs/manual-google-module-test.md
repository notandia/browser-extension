# Manual acceptance: Google AI Overview and People Also Ask

Use a Google result page that contains an AI Overview and People Also Ask answers with a mix of publisher sources.

1. Confirm the outer AI Overview is not bordered, dimmed, hidden, or labelled as a publisher match.
2. Confirm only individual AI Overview source cards or inline cited-source wrappers receive the configured publisher action.
3. Expand **Show more** in AI Overview and verify newly inserted sources are detected without reloading the page.
4. Confirm the outer People Also Ask block is not styled as a publisher match.
5. Expand questions individually and verify only a question whose own answer/source evidence matches a profile receives the configured action.
6. Collapse and re-expand a question and verify the result remains correct after Google mutates the DOM.
7. Open the Notandia popup and verify special-module matches are counted as source/question records rather than as the entire Google module.
8. Verify ordinary organic Google results still retain their existing detection and styling behavior.
