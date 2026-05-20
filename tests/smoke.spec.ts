import { test, expect } from '@playwright/test';

test('app loads with shell layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('nav')).toBeVisible();
  await expect(page.getByTestId('nav').getByText('StarLog')).toBeVisible();
});
