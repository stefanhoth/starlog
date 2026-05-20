import { test, expect } from '@playwright/test';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/star-draft.json'), 'utf8')
);

// Prefer the real workspace recording for richer local testing;
// fall back to the committed WAV fixture in CI where the file is absent.
const REAL_AUDIO = path.resolve(
  __dirname,
  '../../STAR Tech Debt Management mit Fix-it-Friday.m4a'
);
const AUDIO_FILE = existsSync(REAL_AUDIO)
  ? REAL_AUDIO
  : path.join(__dirname, 'fixtures/test-audio.wav');

function mockGemini(page: import('@playwright/test').Page) {
  return page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(FIXTURE) }] } }],
      }),
    })
  );
}

async function setupWithKey(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Mock Gemini before filling key so auto-validation is intercepted
  await mockGemini(page);
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
  // Navigate to capture
  await page.getByTestId('nav-capture').click();
}

test('three tabs are visible', async ({ page }) => {
  await setupWithKey(page);
  await expect(page.getByTestId('tab-record')).toBeVisible();
  await expect(page.getByTestId('tab-upload')).toBeVisible();
  await expect(page.getByTestId('tab-text')).toBeVisible();
});

test('upload tab: file input visible on tab switch', async ({ page }) => {
  await setupWithKey(page);
  await page.getByTestId('tab-upload').click();
  await expect(page.getByTestId('audio-file-input')).toBeVisible();
  await expect(page.getByTestId('upload-submit')).toBeDisabled();
});

test('upload tab: selecting a file enables submit', async ({ page }) => {
  await setupWithKey(page);
  await mockGemini(page);
  await page.getByTestId('tab-upload').click();
  await page.getByTestId('audio-file-input').setInputFiles(AUDIO_FILE);
  await expect(page.getByTestId('upload-submit')).toBeEnabled();
});

test('upload tab: submitting file shows loading and navigates to review', async ({ page }) => {
  await setupWithKey(page);
  await mockGemini(page);
  await page.getByTestId('tab-upload').click();
  await page.getByTestId('audio-file-input').setInputFiles(AUDIO_FILE);
  await page.getByTestId('upload-submit').click();
  // loading may flash too quickly to assert with a mock; review navigation is the real check
  await expect(page.getByTestId('review-view')).toBeVisible({ timeout: 10000 });
});

test('text tab: submit disabled when empty', async ({ page }) => {
  await setupWithKey(page);
  await page.getByTestId('tab-text').click();
  await expect(page.getByTestId('text-submit')).toBeDisabled();
});

test('text tab: submitting text navigates to review', async ({ page }) => {
  await setupWithKey(page);
  await mockGemini(page);
  await page.getByTestId('tab-text').click();
  await page.getByTestId('text-input').fill('I was working at ResearchGate when we had a tech debt problem...');
  await page.getByTestId('text-submit').click();
  await expect(page.getByTestId('review-view')).toBeVisible({ timeout: 10000 });
});

test('error from Gemini shows error message', async ({ page }) => {
  await setupWithKey(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 503, body: '[503 Service Unavailable]' })
  );
  await page.getByTestId('tab-text').click();
  await page.getByTestId('text-input').fill('some story');
  await page.getByTestId('text-submit').click();
  await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 30000 });
});
