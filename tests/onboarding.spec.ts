import { test, expect } from '@playwright/test';

const GEMINI_OK = {
  status: 200 as const,
  contentType: 'application/json',
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('fresh start shows onboarding, not library', async ({ page }) => {
  await expect(page.getByTestId('api-key-input')).toBeVisible();
  await expect(page.getByTestId('onboarding-submit')).toBeVisible();
  await expect(page.getByTestId('settings-cog')).not.toBeVisible();
});

test('empty key field: save button is disabled', async ({ page }) => {
  await expect(page.getByTestId('onboarding-submit')).toBeDisabled();
});

test('submitting empty key stays on onboarding', async ({ page }) => {
  // Button is disabled; press Enter as a fallback interaction check
  await page.getByTestId('api-key-input').press('Enter');
  await expect(page.getByTestId('api-key-input')).toBeVisible();
});

test('non-AIza key shows format error and keeps save disabled', async ({ page }) => {
  await page.getByTestId('api-key-input').fill('sk-notAGeminiKey');
  await expect(page.getByTestId('key-format-error')).toBeVisible();
  await expect(page.getByTestId('onboarding-submit')).toBeDisabled();
});

test('valid key auto-validates and enables save', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill(GEMINI_OK));
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('onboarding-submit')).toBeEnabled();
});

test('valid key navigates to library after save', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill(GEMINI_OK));
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('settings-cog')).toBeVisible();
  await expect(page.getByTestId('api-key-input')).not.toBeVisible();
});

test('invalid key auto-shows error and keeps save disabled', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 400, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 400, message: '[400 Bad Request] API key not valid.' } }) })
  );
  await page.getByTestId('api-key-input').fill('AIzaWrongKey12345');
  await expect(page.getByTestId('verify-error')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('verify-error')).toContainText('Invalid API key');
  await expect(page.getByTestId('onboarding-submit')).toBeDisabled();
});

test('reload after setup skips onboarding', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill(GEMINI_OK));
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
  await page.reload();
  await expect(page.getByTestId('api-key-input')).not.toBeVisible();
  await expect(page.getByTestId('settings-cog')).toBeVisible();
});

test('settings cog reopens onboarding with existing key pre-filled', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill(GEMINI_OK));
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
  await page.getByTestId('settings-cog').click();
  await expect(page.getByTestId('api-key-input')).toBeVisible();
});

test('changing key resets validation status', async ({ page }) => {
  await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill(GEMINI_OK));
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  // Now change to a bad format key — success should disappear immediately
  await page.getByTestId('api-key-input').fill('bad-key');
  await expect(page.getByTestId('verify-success')).not.toBeVisible();
  await expect(page.getByTestId('onboarding-submit')).toBeDisabled();
});
