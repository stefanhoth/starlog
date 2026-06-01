import { test, expect } from '@playwright/test';
import { clearStorage } from './helpers';

test('new user sees the landing page', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);
  await page.reload();
  // Landing page: no shell, just the API key form
  await expect(page.getByTestId('api-key-input')).toBeVisible();
});

test('returning user sees the app shell', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate(() => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey', consentGiven: true }));
  });
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('nav')).toBeVisible();
  await expect(page.getByTestId('nav').getByText('StarLog')).toBeVisible();
});
