import { test, expect } from '@playwright/test';
import { clearStorage, readDB } from './helpers';

test('stories persist in IndexedDB across page reload', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);

  await page.evaluate(() => {
    const story = {
      id: 'test-story-1',
      title: 'Test Story',
      original_language: 'en',
      competency_tags: ['Leadership'],
      star: { situation: 'S', task: 'T', action: ['A1'], result: 'R' },
      quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: '' },
      notes: '',
      rank: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('starlog_stories', JSON.stringify([story]));
  });

  await page.reload();

  const stories = await readDB(page, 'stories', []);

  expect(stories).toHaveLength(1);
  expect((stories as { id: string; title: string }[])[0].id).toBe('test-story-1');
  expect((stories as { id: string; title: string }[])[0].title).toBe('Test Story');
});

test('job profiles persist in IndexedDB across page reload', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);

  await page.evaluate(() => {
    const profile = {
      id: 'test-profile-1',
      company: 'Acme',
      role: 'Engineering Manager',
      jobDescription: 'We need a leader.',
      extractedCompetencies: ['Leadership', 'Delivery'],
      competencyMap: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem('starlog_job_profiles', JSON.stringify([profile]));
  });

  await page.reload();

  const profiles = await readDB(page, 'jobProfiles', []);

  expect(profiles).toHaveLength(1);
  expect((profiles as { company: string }[])[0].company).toBe('Acme');
});
