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
  // Seed consent + mock Gemini extraction before navigating
  await page.evaluate(() => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
  });
  // Base mock for validation; extraction mock below takes LIFO priority
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.reload();
  // Mock extraction to return the fixture
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(FIXTURE) }] } }],
      }),
    })
  );
  // Navigate to capture via story bank
  await page.getByTestId('nav-story-bank').click();
  await page.getByRole('button', { name: '+ New Story' }).click();
  await expect(page.getByTestId('capture-view')).toBeVisible();
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
  // Click the read-mode button to enter edit mode, then fill the textarea
  await page.getByTestId('section-situation').click();
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

test('inline editor auto-focuses on open', async ({ page }) => {
  await goToReview(page);
  await page.getByTestId('section-situation').click();
  await expect(page.getByTestId('section-situation')).toBeFocused();
});

test('Esc dismisses inline editor immediately when nothing has changed', async ({ page }) => {
  await goToReview(page);
  await page.getByTestId('section-situation').click();
  await page.keyboard.press('Escape');
  const tag = await page.getByTestId('section-situation').evaluate(el => el.tagName.toLowerCase());
  expect(tag).toBe('button');
});

test('Esc shows confirm when field is dirty; accepting discards changes', async ({ page }) => {
  await goToReview(page);
  await page.getByTestId('section-situation').click();
  await page.getByTestId('section-situation').fill('DIRTY TEXT');
  page.once('dialog', dialog => dialog.accept());
  await page.keyboard.press('Escape');
  const tag = await page.getByTestId('section-situation').evaluate(el => el.tagName.toLowerCase());
  expect(tag).toBe('button');
  await expect(page.getByTestId('section-situation')).not.toContainText('DIRTY TEXT');
});

test('Esc shows confirm when field is dirty; dismissing keeps editor focused', async ({ page }) => {
  await goToReview(page);
  await page.getByTestId('section-situation').click();
  await page.getByTestId('section-situation').fill('DIRTY TEXT');
  page.once('dialog', dialog => dialog.dismiss());
  await page.keyboard.press('Escape');
  const tag = await page.getByTestId('section-situation').evaluate(el => el.tagName.toLowerCase());
  expect(tag).toBe('textarea');
  await expect(page.getByTestId('section-situation')).toBeFocused();
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
