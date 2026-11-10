import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { freshStart } from './helpers';

/**
 * README media. Skipped unless CAPTURE=1:
 *   CAPTURE=1 pnpm e2e:emulated --project desktop --grep capture
 */
const OUT = resolve(import.meta.dirname, '../../docs/media');
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
const pause = (page: Page, ms = 600) => page.waitForTimeout(ms);

test.use({
  viewport: { width: 1280, height: 800 },
  video: { mode: 'on', size: { width: 1280, height: 800 } },
});

test.describe('capture', () => {
  test.skip(() => !process.env.CAPTURE, 'set CAPTURE=1 to record README media');

  test('capture: wizard to health score to simulator', async ({ page, isMobile }) => {
    test.skip(isMobile);
    await freshStart(page);
    await shot(page, 'landing');
    await page.getByRole('button', { name: 'Start from scratch as a guest' }).click();
    await expect(page.getByRole('heading', { name: "What's your main currency?" })).toBeVisible({
      timeout: 30_000,
    });
    await pause(page);
    await page.getByText('US Dollar').click();
    await pause(page, 400);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Name').pressSequentially('Salary', { delay: 40 });
    await page.getByLabel('Monthly amount').pressSequentially('4200', { delay: 60 });
    await shot(page, 'wizard');
    await pause(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Monthly amount').first().pressSequentially('1450', { delay: 60 });
    await page.getByLabel('Monthly amount').nth(1).pressSequentially('180', { delay: 60 });
    await pause(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Add a debt' }).click();
    await page.getByLabel('Name').pressSequentially('Credit card', { delay: 30 });
    await page.getByLabel('Balance owed').pressSequentially('3200', { delay: 50 });
    await page.getByLabel('Interest rate (% per year)').pressSequentially('24.99', { delay: 50 });
    await page.getByLabel('Minimum monthly payment').pressSequentially('96', { delay: 50 });
    await pause(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Savings and cash').pressSequentially('4800', { delay: 50 });
    await page.getByLabel('Emergency fund').pressSequentially('3000', { delay: 50 });
    await pause(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Add a goal' }).click();
    await page
      .getByLabel('Goal', { exact: true })
      .pressSequentially('Trip to Japan', { delay: 30 });
    await page.getByLabel('Target amount').pressSequentially('4000', { delay: 50 });
    await pause(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await pause(page, 1200);
    await page.getByRole('button', { name: 'See my health score' }).click();
    await expect(page.getByRole('heading', { name: 'Financial health' })).toBeVisible({
      timeout: 30_000,
    });
    await pause(page, 2500);
    await shot(page, 'health');
    await page.mouse.wheel(0, 500);
    await pause(page, 1500);
    await page.getByRole('link', { name: 'Plan' }).first().click();
    await page.getByRole('link', { name: 'What-if' }).click();
    await expect(page.getByText('Left each month')).toBeVisible();
    await pause(page, 800);
    const saveMore = page.getByLabel('Save more per month');
    await saveMore.focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowRight');
      await pause(page, 180);
    }
    await page.getByLabel('Cut by').focus();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
      await pause(page, 180);
    }
    await pause(page, 1500);
    await shot(page, 'simulator');
  });

  test('capture: demo screens', async ({ page, isMobile }) => {
    test.skip(isMobile);
    await freshStart(page);
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible({
      timeout: 60_000,
    });
    await pause(page, 1500);
    await shot(page, 'dashboard');
    await page.getByRole('link', { name: 'Plan' }).first().click();
    await expect(page.getByRole('heading', { name: /Budget for/ })).toBeVisible();
    await pause(page);
    await shot(page, 'budget');
    await page.getByRole('link', { name: 'Goals' }).click();
    await pause(page, 1200);
    await shot(page, 'goals');
    await page.getByRole('link', { name: 'Debts' }).click();
    await pause(page, 1200);
    await shot(page, 'debts');
    await page.getByRole('link', { name: 'Subscriptions' }).first().click();
    await pause(page, 1200);
    await shot(page, 'subscriptions');
    await page.getByRole('combobox', { name: 'Language' }).selectOption('ar');
    await page.getByRole('link', { name: 'الرئيسية' }).first().click();
    await pause(page, 1500);
    await shot(page, 'dashboard-ar');
  });
});
