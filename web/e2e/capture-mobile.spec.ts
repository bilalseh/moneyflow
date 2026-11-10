import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { freshStart } from './helpers';

/** Mobile README screenshots. Skipped unless CAPTURE=1. */
const OUT = resolve(import.meta.dirname, '../../docs/media');
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });
const pause = (page: Page, ms = 600) => page.waitForTimeout(ms);

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe('capture mobile', () => {
  test.skip(() => !process.env.CAPTURE, 'set CAPTURE=1 to record README media');

  test('capture: mobile dashboard and quick entry', async ({ page }) => {
    await freshStart(page);
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible({
      timeout: 60_000,
    });
    await pause(page, 1500);
    await shot(page, 'mobile-dashboard');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.keyboard.type('12.50');
    await pause(page);
    await shot(page, 'mobile-quick-entry');
  });
});
