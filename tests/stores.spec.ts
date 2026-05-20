import { test, expect } from '@playwright/test';

test('stories persist across page reload', async ({ page }) => {
  await page.goto('/');

  // Seed a story directly into localStorage
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

  const stories = await page.evaluate(() => {
    const raw = localStorage.getItem('starlog_stories');
    return raw ? JSON.parse(raw) : [];
  });

  expect(stories).toHaveLength(1);
  expect(stories[0].id).toBe('test-story-1');
  expect(stories[0].title).toBe('Test Story');
});

test('job profiles persist across page reload', async ({ page }) => {
  await page.goto('/');

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

  const profiles = await page.evaluate(() => {
    const raw = localStorage.getItem('starlog_job_profiles');
    return raw ? JSON.parse(raw) : [];
  });

  expect(profiles).toHaveLength(1);
  expect(profiles[0].company).toBe('Acme');
});
