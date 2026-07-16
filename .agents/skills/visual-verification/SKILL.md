---
name: visual-verification
description: Visually verify TrainLog UI work with the project's Playwright evidence workflow. Use whenever an implementation changes React views, components, styles, layout, responsive behavior, navigation, modals, or any user-visible state—even if the request does not explicitly ask for E2E tests. Run this before declaring UI work complete; it complements, rather than replaces, functional and unit tests.
compatibility: Requires Node.js, npm, Playwright Chromium, and an image-capable file reader.
---

# Visual verification

Use Playwright to prove both behavior and appearance. A green test only proves the assertions passed; visual verification is complete only after you open every relevant screenshot and inspect it.

## Standard loop

1. **Map the change to user-visible states.** Identify the affected view, the interaction needed to reach it, and whether it can differ between desktop and mobile. Include loading, empty, error, modal, and populated states when the change touches them.
2. **Add or update behavior assertions first.** Put reusable setup in `e2e/helpers.js` and user journeys in `e2e/*.e2e.js`. Prefer roles, labels, and visible names over CSS selectors. Keep tests isolated with `gotoCleanApp(page)`.
3. **Run the narrow behavior test while implementing.** Use the project runner, which assigns a free port so concurrent agent worktrees do not collide:
   ```bash
   npm run test:e2e -- e2e/<affected-test>.e2e.js --project=chromium
   ```
4. **Capture task-specific evidence.** Import and call `captureVisualEvidence(page, testInfo, '<descriptive state>')` after the state is fully rendered. Add `@visual` to the test title if it should run through the visual command. Use names that explain what is on screen, not `screenshot-1`.
5. **Run visual verification in both configured viewports:**
   ```bash
   npm run test:e2e:visual
   ```
   This clears old evidence first and writes fresh PNGs under:
   - `artifacts/visual/chromium/`
   - `artifacts/visual/mobile-chrome/`
6. **Open every relevant PNG with the image-reading tool.** Do not infer appearance from DOM assertions, the HTML report, or the command exit code. Compare the image against the request and surrounding TrainLog UI.
7. **Fix and repeat.** Recapture evidence after every visual fix. Never report screenshots from an earlier run as proof of the final code.
8. **Run the full gate before completion:**
   ```bash
   npm run test:ci
   ```

## What to inspect

For each relevant desktop and mobile screenshot, deliberately check:

- no clipping, unintended horizontal scrolling, overlap, or content hidden beneath the bottom nav;
- clear hierarchy, spacing, alignment, and consistent dark-theme styling;
- readable text and controls with adequate contrast;
- sensible wrapping for long exercise/workout names and realistic data;
- correct selected, disabled, completed, empty, modal, and error states;
- touch targets and primary actions remain visible on the mobile viewport;
- fixed/sticky elements and dialogs layer correctly;
- the changed UI looks intentional next to unchanged neighboring UI.

Use `expectNoDocumentHorizontalOverflow(page)` and `expectBottomNavVisible(page)` on mobile-relevant states, but remember these assertions do not replace looking at the screenshots.

## Evidence design

The existing `e2e/visual-verification.e2e.js` is a broad smoke journey. Extend the nearest feature test for task-specific proof rather than continually growing the smoke test.

Capture the smallest useful set of states:

- at least one screenshot showing the completed change;
- before/after-interaction states when the interaction itself matters;
- both projects when responsive layout can differ;
- only the relevant project when the state is intentionally viewport-specific, and explain why.

Prefer viewport screenshots (`fullPage: false`, the helper default) for layout and fixed-nav checks. Pass `{ fullPage: true }` only when the whole scrollable page is the evidence being reviewed.

Do not add pixel snapshot assertions by default. They are platform-sensitive and can turn visual review into blind baseline updates. Add `toHaveScreenshot()` only when the user explicitly wants regression baselines and stable rendering has been established. Never update a failed baseline without first inspecting the diff.

## Completion report

When finishing UI work, state:

- behavior/E2E commands run and their result;
- the desktop and mobile PNG paths actually inspected;
- what was visually checked;
- any viewport or state not verified, with the reason.

Do not claim “visually verified” if you only ran Playwright without opening the generated images.
