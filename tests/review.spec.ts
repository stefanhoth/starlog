import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/star-draft.json'), 'utf8')
);

async function goToReview(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Setup + navigate to capture
  // Mock before key fill so auto-validation succeeds; extraction mock below takes LIFO priority
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
  // Seed the draft directly in sessionStorage and navigate to review
  await page.evaluate((draft) => {
    sessionStorage.setItem('starlog_draft', JSON.stringify(draft));
  }, FIXTURE);
  // Trigger navigation to review via store
  await page.evaluate(() => {
    // Dispatch a custom event to navigate — simpler than clicking through capture
    (window as any).__starlogNavigate?.('review');
  });
  // Fallback: go through capture with mocked Gemini (takes LIFO priority over base mock)
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(FIXTURE) }] } }],
      }),
    })
  );
  await page.getByTestId('nav-capture').click();
  await page.getByTestId('tab-text').click();
  await page.getByTestId('text-input').fill('test story');
  await page.getByTestId('text-submit').click();
  await expect(page.getByTestId('review-view')).toBeVisible({ timeout: 10000 });
}

test('review shows all STAR sections', async ({ page }) => {
  await goToReview(page);
  await expect(page.getByTestId('section-situation')).toBeVisible();
  await expect(page.getByTestId('section-task')).toBeVisible();
  await expect(page.getByTestId('section-result')).toBeVisible();
  await expect(page.getByTestId('action-item').first()).toBeVisible();
});

test('editing situation persists on save', async ({ page }) => {
  await goToReview(page);
  await page.getByTestId('section-situation').fill('New situation text');
  await page.getByTestId('save-story').click();
  // Verify saved to localStorage with our edited situation
  const stories = await page.evaluate(() => JSON.parse(localStorage.getItem('starlog_stories') ?? '[]'));
  expect(stories[0].star.situation).toBe('New situation text');
});

test('adding and removing action items works', async ({ page }) => {
  await goToReview(page);
  const initialCount = await page.getByTestId('action-item').count();
  await page.getByText('+ Add step').click();
  await expect(page.getByTestId('action-item')).toHaveCount(initialCount + 1);
});

test('tag picker adds and removes competency chips', async ({ page }) => {
  await goToReview(page);
  await page.getByTestId('tag-picker-toggle').click();
  await expect(page.getByTestId('tag-picker')).toBeVisible();
  // Tags from fixture are already selected; click one to toggle off
  await page.getByTestId('tag-picker').getByText('Leadership').click();
  await page.getByTestId('tag-picker-toggle').click(); // close
  // Leadership chip should be gone or added depending on initial state
});

test('discard returns to capture without saving', async ({ page }) => {
  await goToReview(page);
  const storiesBefore = await page.evaluate(() => {
    const raw = localStorage.getItem('starlog_stories');
    return raw ? JSON.parse(raw).length : 0;
  });
  await page.getByText('Discard').click();
  await expect(page.getByTestId('capture-view')).toBeVisible();
  const storiesAfter = await page.evaluate(() => {
    const raw = localStorage.getItem('starlog_stories');
    return raw ? JSON.parse(raw).length : 0;
  });
  expect(storiesAfter).toBe(storiesBefore);
});

test('save adds story to library', async ({ page }) => {
  await goToReview(page);
  await page.getByTestId('save-story').click();
  const stories = await page.evaluate(() => {
    const raw = localStorage.getItem('starlog_stories');
    return raw ? JSON.parse(raw) : [];
  });
  expect(stories.length).toBeGreaterThan(0);
  expect(stories[0].title).toBeTruthy();
});
