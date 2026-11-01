import { test, expect } from '@playwright/test';
import {
  captureVisualEvidence,
  completeNextSet,
  expectBottomNavVisible,
  expectNoDocumentHorizontalOverflow,
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
} from './helpers';

test('allows pinch zoom and asks the keyboard to resize the app viewport', async ({ page }) => {
  await gotoCleanApp(page);

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('width=device-width');
  expect(viewport).toContain('viewport-fit=cover');
  expect(viewport).toContain('interactive-widget=resizes-content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=/);
});

test('suppresses double-tap zoom across the training app while preserving pinch zoom @visual', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await expect(page.locator('.app')).toHaveCSS('touch-action', 'manipulation');
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }))
    .not.toHaveCSS('user-select', 'none');
  await expectBottomNavVisible(page);
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'mobile-first-training-shell');
});

test('browser and installed app chrome match the dark canvas under either OS theme', async ({ page }) => {
  await gotoCleanApp(page);
  const canvasColor = await page.locator('.app').evaluate((app) => {
    const context = document.createElement('canvas').getContext('2d');
    context.fillStyle = getComputedStyle(app).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return `#${[...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
      .map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  });
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    const theme = page.locator(`meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`);
    await expect(theme).toHaveAttribute('content', canvasColor);
  }
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
  const manifest = await page.request.get('/manifest.json');
  const installedApp = await manifest.json();
  expect(installedApp.theme_color).toBe(canvasColor);
  expect(installedApp.background_color).toBe(canvasColor);
});

test('only applies hover feedback to a precise hovering pointer', async ({ page }) => {
  await gotoCleanApp(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const canHover = await page.evaluate(() =>
    matchMedia('(hover: hover) and (pointer: fine)').matches
  );
  const appearance = (control) => control.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color,
      shadow: style.boxShadow,
      transform: style.transform,
    };
  });
  async function expectCapabilityHover(control) {
    await page.mouse.move(0, 0);
    await control.scrollIntoViewIfNeeded();
    const normal = await appearance(control);
    await control.hover();
    if (canHover) {
      await expect.poll(() => appearance(control)).not.toEqual(normal);
    } else {
      await expect.poll(() => appearance(control)).toEqual(normal);
    }
    await page.mouse.move(0, 0);
  }

  await expectCapabilityHover(page.locator('.import-view__upload'));
  await importSampleCsv(page);
  await expectCapabilityHover(page.getByRole('button', { name: /Preview Lower Body B/ }));
  await page.getByRole('button', { name: /Preview Lower Body B/ }).click();
  await expectCapabilityHover(page.getByRole('button', { name: 'Start Now' }));
  await page.locator('.tpl-preview__close').click();

  await page.getByRole('button', { name: 'Planner' }).click();
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await expectCapabilityHover(page.getByRole('button', { name: /Pull Day\s+4 exercises/ }));
  await page.locator('.template-picker__close').click();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expectCapabilityHover(page.getByRole('button', { name: 'Pull from Server' }));
  await page.getByRole('button', { name: 'Library' }).click();
  await expectCapabilityHover(page.getByRole('tab', { name: 'Templates' }));
  await expectCapabilityHover(page.locator('.library-row__header').first());
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByRole('tab', { name: 'Templates' })).toHaveAttribute('aria-selected', 'true');
  await expectCapabilityHover(page.getByRole('button', { name: /Lower Body B/ }));
  await page.getByRole('button', { name: /Lower Body B/ }).click();
  await expectCapabilityHover(page.getByRole('button', { name: 'Rest duration' }).first());
  await page.getByRole('button', { name: 'Rest duration' }).first().click();
  const defaultRest = page.getByRole('button', { name: 'Default', exact: true }).first();
  await expect(defaultRest).toHaveAttribute('aria-pressed', 'true');
  await expectCapabilityHover(defaultRest);
  await page.getByRole('button', { name: /Cancel/ }).click();

  await page.getByRole('button', { name: 'Training', exact: true }).click();
  await quickStartLowerBodyWorkout(page);
  await expectCapabilityHover(page.getByRole('button', { name: 'Mark complete' }).first());
});

test('controls respond on press without selecting labels or disabling content selection', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const libraryTab = page.getByRole('button', { name: 'Library', exact: true });
  await expect(libraryTab).toHaveCSS('touch-action', 'manipulation');
  await expect(libraryTab).toHaveCSS('user-select', 'none');
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }))
    .not.toHaveCSS('user-select', 'none');
  await libraryTab.click();

  await page.locator('.library-row__header').first().click();
  const notesToggle = page.locator('.library-row__notes-toggle').first();
  await notesToggle.scrollIntoViewIfNeeded();
  await notesToggle.hover();
  await page.mouse.down();
  await expect(notesToggle).not.toHaveCSS('transform', 'none');
  await expect(page.locator('.library-row textarea')).toHaveCount(0);
  await page.mouse.up();
  const notesInput = page.locator('.library-row textarea').first();
  await expect(notesInput).toBeVisible();
  await expect(notesInput).not.toHaveCSS('user-select', 'none');
  await notesInput.fill('Keep elbows tight');
  await expect(notesInput).toHaveValue('Keep elbows tight');
});

test('editable fields stay at least 16px and offer appropriate numeric keyboards @visual', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  async function expectReadableFields() {
    for (const field of await page.locator('input:not([type="file"]):not([type="checkbox"]), textarea, select').all()) {
      if (await field.isVisible()) {
        const fontSize = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(fontSize, await field.getAttribute('class')).toBeGreaterThanOrEqual(16);
      }
    }
  }

  await expectReadableFields();
  await page.getByLabel('Paste CSV').scrollIntoViewIfNeeded();
  await captureVisualEvidence(page, testInfo, 'mobile-native-csv-paste-field');
  await importSampleCsv(page);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expectReadableFields();
  await page.getByRole('button', { name: 'Bulk Import YouTube Links' }).click();
  await expectReadableFields();
  await page.locator('.library-view__bulk-card textarea').scrollIntoViewIfNeeded();
  await captureVisualEvidence(page, testInfo, 'mobile-native-bulk-video-field');
  await page.getByRole('button', { name: 'Close bulk import' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Lower Body B/ }).click();
  await expectReadableFields();
  const setInputs = page.locator('.tpl-editor__set-input');
  await expect(setInputs.nth(0)).toHaveAttribute('inputmode', 'numeric');
  await expect(setInputs.nth(1)).toHaveAttribute('inputmode', 'decimal');
  await page.getByRole('button', { name: 'Rest duration' }).first().click();
  await page.locator('.rest-picker').first().getByRole('button', { name: 'Other', exact: true }).click();
  await expect(page.getByPlaceholder('seconds')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByPlaceholder('seconds')).toHaveAttribute('enterkeyhint', 'done');
  await expectReadableFields();
  await captureVisualEvidence(page, testInfo, 'mobile-native-template-fields');
  await page.getByRole('button', { name: 'Bar weight' }).first().click();
  await page.locator('.bar-weight-picker').first().getByRole('button', { name: 'Other', exact: true }).click();
  await expect(page.getByPlaceholder('weight')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByPlaceholder('weight')).toHaveAttribute('enterkeyhint', 'done');
  await page.getByRole('button', { name: /Cancel/ }).click();

  await page.getByRole('button', { name: 'Training', exact: true }).click();
  await quickStartLowerBodyWorkout(page);
  await expectReadableFields();
});

test('contains app and sheet scrolling and keeps actions reachable in a short viewport @visual', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveCSS('overscroll-behavior-y', 'none');
  await expect(page.locator('body')).toHaveCSS('overscroll-behavior-y', 'none');
  await expect(page.locator('.training-view')).toHaveCSS('overscroll-behavior-y', 'contain');

  await page.setViewportSize({ width: page.viewportSize().width, height: 480 });
  await page.getByRole('button', { name: /Preview Lower Body B/ }).click();
  await expect(page.locator('.tpl-preview-sheet')).toHaveCSS('overscroll-behavior-y', 'contain');
  await expect(page.getByRole('button', { name: 'Start Now' })).toBeInViewport();
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'mobile-native-short-preview');
  await page.locator('.tpl-preview__close').click();

  await page.getByRole('button', { name: 'Planner', exact: true }).click();
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await expect(page.locator('.modal')).toHaveCSS('overscroll-behavior-y', 'contain');
  await expect(page.locator('.template-picker__list')).toHaveCSS('overscroll-behavior-y', 'contain');
  await expect(page.getByPlaceholder('Search templates...')).toBeInViewport();
  await expect(page.locator('.template-picker__close')).toBeInViewport();
  await page.getByRole('button', { name: /Pull Day\s+4 exercises/ }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: /Pull Day\s+4 exercises/ })).toBeInViewport();
  await captureVisualEvidence(page, testInfo, 'mobile-native-short-template-picker');
  await page.locator('.template-picker__close').click();

  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.locator('.tpl-list__swipe-content').first()).toHaveCSS('touch-action', 'pan-y pinch-zoom');
  await expectBottomNavVisible(page);
  await expectNoDocumentHorizontalOverflow(page);
});

test('cancelled template swipes settle instead of leaving a partially shifted row @visual', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  const row = page.locator('.tpl-list__swipe-content').first();
  const initial = await row.evaluate((el) => getComputedStyle(el).transform);
  async function touch(type, clientX) {
    await row.evaluate((el, { type, clientX }) => {
      const point = new Touch({ identifier: 1, target: el, clientX, clientY: 200 });
      el.dispatchEvent(new TouchEvent(type, {
        bubbles: true,
        touches: type === 'touchmove' || type === 'touchstart' ? [point] : [],
        changedTouches: [point],
      }));
    }, { type, clientX });
  }
  await touch('touchstart', 240);
  await touch('touchmove', 210);
  await expect(row).not.toHaveCSS('transform', initial);
  await touch('touchcancel', 210);
  await expect(row).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await captureVisualEvidence(page, testInfo, 'mobile-native-template-swipe-cancelled-closed');

  await touch('touchstart', 240);
  await touch('touchmove', 140);
  await touch('touchend', 140);
  await expect(row).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -80, 0)');
  await touch('touchstart', 140);
  await touch('touchmove', 165);
  await touch('touchcancel', 165);
  await expect(row).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -80, 0)');
  await captureVisualEvidence(page, testInfo, 'mobile-native-template-swipe-cancelled-open');
});

test('paints the mobile home-indicator region as part of navigation @visual', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Home-indicator canvas belongs to the mobile shell.');
  await gotoCleanApp(page);
  await importSampleCsv(page);

  const colors = await page.locator('.navbar').evaluate((nav) => ({
    navigation: getComputedStyle(nav).backgroundColor,
    canvas: getComputedStyle(document.documentElement).backgroundColor,
  }));
  expect(colors.canvas, 'The exposed canvas beneath navigation must not form a separate black strip')
    .toBe(colors.navigation);

  for (const height of [851, 640]) {
    await page.setViewportSize({ width: 393, height });
    const nav = await page.locator('.navbar').boundingBox();
    expect(Math.abs(nav.y + nav.height - height)).toBeLessThanOrEqual(1);
    await expectBottomNavVisible(page);
    await expectNoDocumentHorizontalOverflow(page);
  }
  await captureVisualEvidence(page, testInfo, 'mobile-navigation-short-viewport');
});

test('restores an active workout after reload', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);
  await completeNextSet(page);

  await page.evaluate(() => sessionStorage.setItem('skipSync', '1'));
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Resume Workout?' })).toBeVisible();
  const resumeModal = page.locator('.modal');
  await expect(resumeModal.getByText('Lower Body B')).toBeVisible();
  await expect(resumeModal.getByText('1 of 7 sets completed')).toBeVisible();

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('button', { name: 'Finish (1/7 sets)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark incomplete' })).toBeVisible();
});

test('keeps key mobile screens within the viewport width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile layout guard runs once on the mobile project.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);

  for (const label of ['Planner', 'Library', 'Settings']) {
    await page.getByRole('button', { name: label }).click();
    await expectNoDocumentHorizontalOverflow(page);
    await expectBottomNavVisible(page);
  }

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByLabel('4 templates')).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);

  await page.getByRole('button', { name: /Lower Body B/ }).click();
  await expect(page.getByRole('button', { name: 'Save Template' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cancel/ })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
});

test('keeps primary mobile navigation and planning controls thumb-sized', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Touch target guard runs once on the mobile project.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  for (const tab of await page.locator('.navbar__tab').all()) {
    const box = await tab.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
  }

  await page.getByRole('button', { name: 'Planner' }).click();
  for (const assignButton of await page.locator('.planner-day__assign').all()) {
    const box = await assignButton.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
  }

  await page.getByRole('button', { name: 'Library' }).click();
  for (const libraryTab of await page.getByRole('tab').all()) {
    const box = await libraryTab.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(47.99);
  }
});

test('keeps template editing and exercise history controls thumb-sized', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Touch target guard runs once on the mobile project.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Lower Body B/ }).click();

  for (const control of await page.locator('.tpl-editor .btn-icon, .tpl-editor .rest-picker__trigger, .tpl-editor .bar-weight-picker__trigger').all()) {
    const box = await control.boundingBox();
    const className = await control.getAttribute('class');
    expect(box.width, className).toBeGreaterThanOrEqual(47.99);
    expect(box.height, className).toBeGreaterThanOrEqual(47.99);
  }

  await page.getByRole('button', { name: /Cancel/ }).click();
  await page.getByRole('tab', { name: 'Exercises' }).click();
  await page.locator('.library-row__header').first().click();
  await page.getByRole('button', { name: 'View exercise history' }).click();

  const backBox = await page.locator('.exercise-history-view__back').boundingBox();
  expect(backBox.height).toBeGreaterThanOrEqual(48);
});
