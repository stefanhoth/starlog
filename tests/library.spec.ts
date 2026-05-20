import { test, expect } from '@playwright/test';
import type { Story } from '../src/lib/types';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: crypto.randomUUID(),
    title: 'Default Story',
    original_language: 'en',
    competency_tags: ['Leadership'],
    star: { situation: 'S', task: 'T', action: ['A'], result: 'R' },
    quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: '' },
    notes: '',
    rank: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function seedLibrary(page: import('@playwright/test').Page, stories: Story[]) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
  await page.evaluate((s) => localStorage.setItem('starlog_stories', JSON.stringify(s)), stories);
  await page.reload();
}

test('empty library shows empty state', async ({ page }) => {
  await seedLibrary(page, []);
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByTestId('story-grid')).not.toBeVisible();
});

test('library shows all story cards', async ({ page }) => {
  const stories = [
    makeStory({ id: '1', title: 'Story One' }),
    makeStory({ id: '2', title: 'Story Two' }),
    makeStory({ id: '3', title: 'Story Three' }),
  ];
  await seedLibrary(page, stories);
  await expect(page.getByTestId('story-card')).toHaveCount(3);
});

test('filter by competency tag hides non-matching cards', async ({ page }) => {
  const stories = [
    makeStory({ id: '1', title: 'Leadership Story', competency_tags: ['Leadership'] }),
    makeStory({ id: '2', title: 'Delivery Story', competency_tags: ['Delivery'] }),
    makeStory({ id: '3', title: 'Both Story', competency_tags: ['Leadership', 'Delivery'] }),
  ];
  await seedLibrary(page, stories);
  await page.getByTestId('filter-tag-leadership').click();
  await expect(page.getByTestId('story-card')).toHaveCount(2);
  await page.getByText('Clear').click();
  await expect(page.getByTestId('story-card')).toHaveCount(3);
});

test('keyword search filters in real time', async ({ page }) => {
  const stories = [
    makeStory({ id: '1', title: 'Webpack Migration' }),
    makeStory({ id: '2', title: 'Team Hiring Process' }),
  ];
  await seedLibrary(page, stories);
  await page.getByTestId('search-input').fill('webpack');
  await expect(page.getByTestId('story-card')).toHaveCount(1);
  await page.getByTestId('search-input').fill('');
  await expect(page.getByTestId('story-card')).toHaveCount(2);
});

test('no results state shown when filter matches nothing', async ({ page }) => {
  await seedLibrary(page, [makeStory({ competency_tags: ['Leadership'] })]);
  await page.getByTestId('filter-tag-delivery').click();
  await expect(page.getByTestId('no-results')).toBeVisible();
});
