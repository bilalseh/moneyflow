import { expect, test } from '@playwright/test';

test.describe('landing shell', () => {
  test('renders headline, disclaimer and entry buttons', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Moneyflow/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Understand your money');
    await expect(page.getByRole('note')).toContainText('Educational tool, not financial advice.');
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try the demo' })).toBeVisible();
  });

  test('switching to Arabic flips the document direction', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('combobox').selectOption('ar');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('unknown routes show the not-found page', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Page not found');
  });
});
