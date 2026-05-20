import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Fulfills ALL Gemini API calls with a valid 200 response containing `body`.
 * Call this BEFORE filling the API key so the auto-validation call is intercepted.
 *
 * Tests that need a specific Gemini response for extraction should call their own
 * page.route() AFTER this — Playwright's LIFO routing means the later route wins.
 */
export async function mockGeminiOk(page: Page, responseText = 'ok'): Promise<void> {
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: responseText }] } }],
      }),
    })
  );
}

/**
 * Complete the onboarding form end-to-end.
 * Assumes Gemini is already mocked (call mockGeminiOk first).
 */
export async function completeOnboarding(page: Page, key = 'AIzaTestKey123'): Promise<void> {
  await page.getByTestId('api-key-input').fill(key);
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
}
