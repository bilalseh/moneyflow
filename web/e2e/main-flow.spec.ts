import { expect, test } from '@playwright/test';

import { expectAccessible, freshStart } from './helpers';

test.describe('guest: wizard to health score to what-if', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop flow; mobile entry is covered below');

  test('sets up from scratch and explores a scenario', async ({ page }) => {
    await freshStart(page);
    await page.getByRole('button', { name: 'Start from scratch as a guest' }).click();

    await expect(page.getByRole('heading', { name: "What's your main currency?" })).toBeFocused({
      timeout: 30_000,
    });
    await page.getByText('US Dollar').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(
      page.getByRole('heading', { name: 'What money comes in each month?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Add at least one source of income.')).toBeVisible();
    await page.getByLabel('Name').fill('Salary');
    await page.getByLabel('Monthly amount').fill('3500');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(
      page.getByRole('heading', { name: 'What do you pay every month no matter what?' }),
    ).toBeVisible();
    await page.getByLabel('Monthly amount').first().fill('1200');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: "Skip, I'll add this later" }).click();

    await page.getByLabel('Savings and cash').fill('2000');
    await page.getByLabel('Emergency fund').fill('3000');
    // Forward and back again keeps answers.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByLabel('Savings and cash')).toHaveValue('2000');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'Add a goal' }).click();
    await page.getByLabel('Goal', { exact: true }).fill('New laptop');
    await page.getByLabel('Target amount').fill('1500');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('heading', { name: 'Does this look right?' })).toBeVisible();
    await expect(page.getByText('Salary: $3,500.00')).toBeVisible();
    await expect(page.getByText('Skipped')).toBeVisible();
    await page.getByRole('button', { name: 'See my health score' }).click();

    await expect(page.getByRole('heading', { name: 'Financial health' })).toBeVisible();
    await expect(page.getByText('Your plan is ready')).toBeVisible();
    await expect(page.getByRole('meter', { name: 'Health score' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Savings rate', level: 3 })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Try the simulator' }).click();
    const surplus = page.getByText('Left each month').locator('..').locator('p').nth(1);
    const before = await surplus.textContent();
    const slider = page.getByLabel('Income changes by');
    await slider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    await expect(surplus).not.toHaveText(before ?? '');
    await expectAccessible(page);
  });
});

test.describe('demo account', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop layout');

  test('opens a seeded dashboard and supports Arabic right-to-left', async ({ page }) => {
    await freshStart(page);
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'Spending by category' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monthly trend' })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Subscriptions' }).first().click();
    await expect(page.getByText('MasterClass')).toBeVisible();

    await page.getByRole('link', { name: 'Plan' }).first().click();
    await page.getByRole('link', { name: 'Debts' }).click();
    await expect(page.getByText('Least interest')).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('combobox', { name: 'Language' }).selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'خطتك' })).toBeVisible();
  });

  test('quick entry in a few keystrokes', async ({ page }) => {
    await freshStart(page);
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible({
      timeout: 60_000,
    });
    await page.keyboard.press('n');
    const dialog = page.getByRole('dialog', { name: 'Quick entry' });
    await expect(dialog.getByLabel('Amount')).toBeFocused();
    await page.keyboard.type('12.50');
    await dialog.getByRole('button', { name: 'Dining out' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  });
});

test('mobile: demo opens with the bottom bar and the menu', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await freshStart(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Quick entry' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Health' }).click();
  await expect(page.getByRole('heading', { name: 'Financial health' })).toBeVisible();
});
