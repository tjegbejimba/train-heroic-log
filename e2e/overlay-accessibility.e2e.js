import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers';

for (const surface of ['preview', 'planner', 'discard', 'clear-data']) {
  test(`@visual ${surface} contains focus, dismisses safely and restores its trigger`, async ({ page }, testInfo) => {
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: {} }));
    await gotoCleanApp(page);
    await importSampleCsv(page);

    let trigger;
    let title;
    if (surface === 'preview') {
      trigger = page.getByRole('button', { name: 'Preview Lower Body B' });
      title = 'Lower Body B';
    } else if (surface === 'planner') {
      await page.getByRole('button', { name: 'Planner', exact: true }).click();
      trigger = page.getByRole('button', { name: '+ Add', exact: true }).first();
      title = 'Pick a Template';
    } else if (surface === 'discard') {
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.getByRole('tab', { name: 'Templates' }).click();
      await page.getByRole('button', { name: /Lower Body B/ }).click();
      await page.getByLabel('Template name').fill('Unsaved synthetic workout');
      trigger = page.getByRole('button', { name: 'Cancel', exact: true });
      title = 'Unsaved changes will be lost';
    } else {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      trigger = page.getByRole('button', { name: 'Clear Data...' });
      title = 'Clear Data';
    }

    await trigger.focus();
    await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(':focus')).toHaveCount(1);
    const controls = dialog.locator('button:not(:disabled), input:not(:disabled)');
    await controls.last().focus();
    await page.keyboard.press('Tab');
    await expect(controls.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(controls.last()).toBeFocused();
    expect(await page.locator('#root').evaluate(el => el.inert)).toBe(true);
    if (surface === 'discard') {
      const button = dialog.getByRole('button', { name: 'Discard' });
      for (const state of ['default', 'hover']) {
      if (state === 'hover') await button.hover();
      const contrast = await button.evaluate(el => {
        const style = getComputedStyle(el);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.filter = style.filter;
        const luminance = color => {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const channels = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const a = luminance(style.color), b = luminance(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      await testInfo.attach(`destructive-contrast-${state}`, { body: String(contrast), contentType: 'text/plain' });
      }
    }
    await captureVisualEvidence(page, testInfo, `accessible-${surface}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.locator('#root').evaluate(el => el.inert)).toBe(false);
    if (surface === 'discard') {
      await expect(page.getByLabel('Template name')).toHaveValue('Unsaved synthetic workout');
    }
  });
}
