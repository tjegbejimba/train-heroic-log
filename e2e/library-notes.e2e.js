import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence, expectBottomNavVisible } from './helpers.js';

test.describe('Exercise Library - Form Notes Editing @visual', () => {
  test('note editor actions remain above mobile navigation', async ({ page }) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    // Navigate to Library
    await page.getByRole('button', { name: 'Library' }).click();
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

    // Scroll down to ensure we have exercises lower in the viewport
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(300);

    // Expand an exercise row that's lower in the list (use the 3rd one to ensure scrolling is needed)
    const thirdRow = page.locator('.library-row').nth(2);
    await thirdRow.scrollIntoViewIfNeeded();
    await thirdRow.locator('.library-row__header').click();
    await expect(thirdRow.locator('.library-row__details')).toBeVisible();

    // Click the Form Notes toggle button to open the editor
    const notesToggle = thirdRow.locator('.library-row__notes-toggle');
    await notesToggle.click();

    // Wait for textarea to be visible
    const textarea = thirdRow.locator('textarea');
    await expect(textarea).toBeVisible();

    // Find the action row (contains Save and Cancel buttons)
    const actionRow = thirdRow.locator('.library-row__actions');
    await expect(actionRow).toBeVisible();

    // Wait for scroll animation to complete (smooth scroll takes time)
    await page.waitForTimeout(300);

    // Assert both Save and Cancel buttons are present
    const saveButton = actionRow.getByRole('button', { name: 'Save' });
    const cancelButton = actionRow.getByRole('button', { name: 'Cancel' });
    await expect(saveButton).toBeVisible();
    await expect(cancelButton).toBeVisible();

    // Mobile-specific geometry check: action row must end above the bottom navigation
    // Bottom nav is fixed at the bottom, 76px tall + safe-area-inset-bottom
    // Get the action row's bottom position
    const actionRowBottom = await actionRow.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.bottom;
    });

    // Get the viewport height and nav height (76px + safe-area)
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const navHeight = 76; // From App.css
    const navTop = viewportHeight - navHeight;

    // Action row bottom must be above the nav top (with some margin for safety)
    // On mobile this is critical; on desktop it's nice-to-have
    const isMobile = await page.evaluate(() => window.innerWidth < 768);
    if (isMobile) {
      // Strict check on mobile - must be fully above nav
      expect(actionRowBottom).toBeLessThan(navTop - 8);
    } else {
      // Looser check on desktop - just ensure it's visible (within viewport)
      expect(actionRowBottom).toBeLessThan(viewportHeight);
    }

    // Verify nav is still visible
    await expectBottomNavVisible(page);

    // Capture visual evidence
    await captureVisualEvidence(page, test.info(), 'library-notes-edit-mobile');
  });
});
