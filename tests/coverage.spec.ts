import { test, expect } from '@playwright/test';
import type { Story } from '../src/lib/types';
import type { JobProfile } from '../src/lib/types';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const COMPETENCY_FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/competencies.json'), 'utf8')
);

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: crypto.randomUUID(),
    title: 'Test Story',
    original_language: 'en',
    competency_tags: ['Leadership'],
    star: { situation: 'S', task: 'T', action: ['A'], result: 'R' },
    quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: '' },
    notes: '', rank: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProfile(stories: Story[], competencyMap: Record<string, string[]> = {}): JobProfile {
  return {
    id: 'test-profile',
    company: 'Acme',
    role: 'EM',
    jobDescription: 'A great job',
    extractedCompetencies: COMPETENCY_FIXTURE,
    competencyMap,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Seed profile + stories and navigate to job-hub. */
async function openJobHub(
  page: import('@playwright/test').Page,
  profile: JobProfile,
  stories: Story[] = []
) {
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.evaluate(({ p, s }) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
    localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
    localStorage.setItem('starlog_stories', JSON.stringify(s));
    sessionStorage.setItem('starlog_active_profile', p.id);
  }, { p: profile, s: stories });
  await page.reload();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
}

test('competency list shows all extracted competencies', async ({ page }) => {
  await openJobHub(page, makeProfile([]));
  const rows = page.getByTestId('competency-row');
  await expect(rows).toHaveCount(COMPETENCY_FIXTURE.length);
});

test('unmapped competency shows draft button', async ({ page }) => {
  await openJobHub(page, makeProfile([]));
  const firstRow = page.getByTestId('competency-row').first();
  await expect(firstRow.getByTestId('draft-btn')).toBeVisible();
});

test('clicking map-existing-btn opens story map modal', async ({ page }) => {
  const story = makeStory();
  await openJobHub(page, makeProfile([story]), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await expect(page.getByTestId('story-map-modal')).toBeVisible();
});

test('selecting story in modal marks competency as covered', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openJobHub(page, makeProfile([story]), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await page.getByTestId('story-map-save-btn').click();
  // First competency row should now show edit-mapping-btn (covered state)
  await expect(page.getByTestId('competency-row').first().getByTestId('edit-mapping-btn')).toBeVisible();
});

test('same story can be mapped to two competencies', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openJobHub(page, makeProfile([story]), [story]);
  // Map to first competency
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await page.getByTestId('story-map-save-btn').click();
  // Map to second competency
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await page.getByTestId('story-map-save-btn').click();
  // Both first two rows should now be covered (show edit-mapping-btn)
  await expect(page.getByTestId('edit-mapping-btn')).toHaveCount(2);
});
