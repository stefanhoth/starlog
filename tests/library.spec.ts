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
  // Seed consent so we skip onboarding entirely
  await page.evaluate((s) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
    localStorage.setItem('starlog_stories', JSON.stringify(s));
  }, stories);
  await page.reload();
  // Navigate to story bank
  await page.getByTestId('nav-story-bank').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
}

test('empty library shows empty state', async ({ page }) => {
  await seedLibrary(page, []);
  await expect(page.getByTestId('empty-state')).toBeVisible();
});

test('library shows all story rows', async ({ page }) => {
  const stories = [
    makeStory({ id: '1', title: 'Story One' }),
    makeStory({ id: '2', title: 'Story Two' }),
    makeStory({ id: '3', title: 'Story Three' }),
  ];
  await seedLibrary(page, stories);
  await expect(page.getByTestId('story-row')).toHaveCount(3);
});

test('keyword search by competency tag hides non-matching rows', async ({ page }) => {
  const stories = [
    makeStory({ id: '1', title: 'Alpha Story', competency_tags: ['Leadership'] }),
    makeStory({ id: '2', title: 'Beta Story', competency_tags: ['Delivery'] }),
    makeStory({ id: '3', title: 'Gamma Story', competency_tags: ['Leadership', 'Delivery'] }),
  ];
  await seedLibrary(page, stories);
  await page.getByTestId('search-input').fill('leadership');
  await expect(page.getByTestId('story-row')).toHaveCount(2);
  await page.getByTestId('search-input').fill('');
  await expect(page.getByTestId('story-row')).toHaveCount(3);
});

test('keyword search by title filters in real time', async ({ page }) => {
  const stories = [
    makeStory({ id: '1', title: 'Webpack Migration' }),
    makeStory({ id: '2', title: 'Team Hiring Process' }),
  ];
  await seedLibrary(page, stories);
  await page.getByTestId('search-input').fill('webpack');
  await expect(page.getByTestId('story-row')).toHaveCount(1);
  await page.getByTestId('search-input').fill('');
  await expect(page.getByTestId('story-row')).toHaveCount(2);
});

test('no results state shown when search matches nothing', async ({ page }) => {
  await seedLibrary(page, [makeStory({ competency_tags: ['Leadership'] })]);
  await page.getByTestId('search-input').fill('delivery');
  await expect(page.getByTestId('no-results')).toBeVisible();
});
