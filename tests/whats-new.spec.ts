import { test, expect } from '@playwright/test';
import { clearStorage } from './helpers';

/**
 * Helper: navigate to the app as a returning (authenticated) user so the
 * sidebar is visible.
 */
async function loadAppShell(page: Parameters<typeof clearStorage>[0]) {
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate(() => {
    localStorage.setItem(
      'starlog_settings',
      JSON.stringify({ apiKey: 'AIzaTestKey', consentGiven: true }),
    );
  });
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
}

test('clicking What\'s New button opens the panel', async ({ page }) => {
  await loadAppShell(page);

  // Panel must not be visible initially
  await expect(page.getByTestId('whats-new-panel')).not.toBeVisible();

  // Click the button
  await page.getByTestId('whats-new-btn').click();

  // Panel must become visible
  await expect(page.getByTestId('whats-new-panel')).toBeVisible();
});

test('What\'s New panel can be closed', async ({ page }) => {
  await loadAppShell(page);

  await page.getByTestId('whats-new-btn').click();
  await expect(page.getByTestId('whats-new-panel')).toBeVisible();

  // Close via the close button inside the panel
  await page.getByRole('button', { name: 'Close What\'s New panel' }).click();

  await expect(page.getByTestId('whats-new-panel')).not.toBeVisible();
});
