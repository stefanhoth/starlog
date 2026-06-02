import { test, expect } from '@playwright/test';
import type { Story } from '../src/lib/types';
import { clearStorage } from './helpers';

function makeStory(index: number): Story {
  return {
    id: `scroll-reset-story-${index}`,
    title: `Story Number ${index}`,
    original_language: 'en',
    competency_tags: ['Technical Depth'],
    star: {
      situation: `Situation for story ${index}`,
      task: `Task for story ${index}`,
      action: [`Action step one for story ${index}`, `Action step two for story ${index}`],
      result: `Result for story ${index}`,
    },
    quality: { situation: 'high', task: 'medium', action: 'high', result: 'low', notes: '' },
    notes: '',
    rank: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test('scroll position resets to 0 when navigating from Story Bank to Story Detail', async ({ page }) => {
  // Use a small viewport to guarantee the Story Bank overflows
  await page.setViewportSize({ width: 800, height: 400 });

  await page.goto('/');
  await clearStorage(page);

  // Seed 20 stories to guarantee overflow at height 400
  const stories = Array.from({ length: 20 }, (_, i) => makeStory(i));

  await page.evaluate((storiesData) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
    localStorage.setItem('starlog_stories', JSON.stringify(storiesData));
    sessionStorage.setItem('starlog_active_story', storiesData[0].id);
  }, stories);

  await page.reload();

  // Navigate to Story Bank
  await page.getByTestId('nav-story-bank').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();

  // Scroll to the bottom of main-content to simulate a user who has scrolled down
  await page.locator('[data-testid="main-content"]').evaluate(el => {
    el.scrollTop = el.scrollHeight;
  });

  // Verify we actually scrolled (the list should overflow at height 400)
  const scrolledPos = await page.locator('[data-testid="main-content"]').evaluate(el => el.scrollTop);
  expect(scrolledPos).toBeGreaterThan(0);

  // Click the first story row to open Story Detail
  await page.getByTestId('story-row').first().click();
  await expect(page.getByTestId('story-detail-view')).toBeVisible({ timeout: 5000 });

  // Scroll position should be reset to 0 after view change
  await expect
    .poll(() => page.locator('[data-testid="main-content"]').evaluate(el => el.scrollTop))
    .toBe(0);
});
