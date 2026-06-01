import { test, expect } from '@playwright/test';
import type { Story } from '../src/lib/types';
import { clearStorage, readDB } from './helpers';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-detail-test',
    title: 'Webpack Migration Story',
    original_language: 'en',
    competency_tags: ['Technical Depth'],
    star: { situation: 'Original situation', task: 'Original task', action: ['Step one', 'Step two'], result: 'Original result' },
    quality: { situation: 'high', task: 'medium', action: 'high', result: 'low', notes: 'Result needs more specifics.' },
    notes: '',
    rank: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function openDetail(page: import('@playwright/test').Page, story: Story) {
  await page.goto('/');
  await clearStorage(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.evaluate((s) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
    localStorage.setItem('starlog_stories', JSON.stringify([s]));
    sessionStorage.setItem('starlog_active_story', s.id);
  }, story);
  await page.reload();
  // Navigate to story bank and click the story row
  await page.getByTestId('nav-story-bank').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
  await page.getByTestId('story-row').first().click();
  await expect(page.getByTestId('story-detail-view')).toBeVisible({ timeout: 5000 });
}

test('story detail shows all fields', async ({ page }) => {
  await openDetail(page, makeStory());
  await expect(page.getByTestId('detail-title')).toHaveText('Webpack Migration Story');
  await expect(page.getByTestId('detail-situation')).toHaveText('Original situation');
  await expect(page.getByTestId('detail-result')).toHaveText('Original result');
  await expect(page.getByTestId('detail-action-item')).toHaveCount(2);
});

test('editing result and saving persists on reload', async ({ page }) => {
  await openDetail(page, makeStory());
  // Click the read-mode button to enter edit mode, then fill the textarea
  await page.getByTestId('detail-result').click();
  await page.getByTestId('detail-result').fill('New result text');
  await page.getByTestId('save-btn').click();
  // persist() is fire-and-forget inside updateStory — wait for the IndexedDB
  // write to commit before reloading, otherwise the reload races the write.
  await expect.poll(async () => {
    const stories = await readDB(page, 'stories', []) as Story[];
    return stories.find((s: Story) => s.id === 'story-detail-test')?.star.result;
  }).toBe('New result text');
  await page.reload();
  await page.getByTestId('nav-story-bank').click();
  await page.getByTestId('story-row').first().click();
  // After reload, result is shown in a read-mode button
  await expect(page.getByTestId('detail-result')).toHaveText('New result text');
});

test('setting readiness to max persists', async ({ page }) => {
  await openDetail(page, makeStory());
  await page.getByTestId('readiness-star').nth(4).click(); // 5th star = rank 5, auto-saves
  const stories = await readDB(page, 'stories', []) as Story[];
  expect(stories[0].rank).toBe(5);
});

test('delete shows modal, cancel keeps story', async ({ page }) => {
  await openDetail(page, makeStory());
  await page.getByTestId('delete-btn').click();
  await expect(page.getByTestId('delete-confirm-modal')).toBeVisible();
  await page.getByTestId('delete-cancel').click();
  await expect(page.getByTestId('delete-confirm-modal')).not.toBeVisible();
  const stories = await readDB(page, 'stories', []);
  expect(stories).toHaveLength(1);
});

test('delete confirm removes story and returns to story bank', async ({ page }) => {
  await openDetail(page, makeStory());
  await page.getByTestId('delete-btn').click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
  const stories = await readDB(page, 'stories', []);
  expect(stories).toHaveLength(0);
});
