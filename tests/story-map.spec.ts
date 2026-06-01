import { test, expect } from '@playwright/test';
import type { Story, JobProfile } from '../src/lib/types';
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
    star: { situation: 'Led a major turnaround of a struggling project.', task: 'T', action: ['A'], result: 'R' },
    quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: '' },
    notes: '', rank: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProfile(extraMap: Record<string, string[]> = {}): JobProfile {
  return {
    id: 'test-profile',
    company: 'Acme',
    role: 'EM',
    jobDescription: 'A great job',
    extractedCompetencies: COMPETENCY_FIXTURE,
    competencyMap: extraMap,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

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

test('clicking map-existing-btn opens StoryMapModal', async ({ page }) => {
  const story = makeStory();
  await openJobHub(page, makeProfile(), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await expect(page.getByTestId('story-map-modal')).toBeVisible();
});

test('clicking edit-mapping-btn opens StoryMapModal for covered competency', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  const comp = COMPETENCY_FIXTURE[0];
  await openJobHub(page, makeProfile({ [comp]: ['story-1'] }), [story]);
  await page.getByTestId('edit-mapping-btn').first().click();
  await expect(page.getByTestId('story-map-modal')).toBeVisible();
});

test('story library shows situation excerpt', async ({ page }) => {
  const story = makeStory({ star: { situation: 'Led a major turnaround of a struggling project.', task: 'T', action: ['A'], result: 'R' } });
  await openJobHub(page, makeProfile(), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await expect(page.getByTestId('story-library-panel')).toContainText('Led a major turnaround');
});

test('search input filters story library', async ({ page }) => {
  const storyA = makeStory({ id: 'a', title: 'Alpha Story' });
  const storyB = makeStory({ id: 'b', title: 'Beta Story' });
  await openJobHub(page, makeProfile(), [storyA, storyB]);
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-search').fill('Alpha');
  await expect(page.getByTestId('library-story-card')).toHaveCount(1);
  await expect(page.getByTestId('story-library-panel')).toContainText('Alpha Story');
});

test('first selected story is labelled Primary', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openJobHub(page, makeProfile(), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await expect(page.getByTestId('story-selection-panel')).toContainText('Primary');
});

test('second selected story is labelled Backup', async ({ page }) => {
  const storyA = makeStory({ id: 'a', title: 'Alpha' });
  const storyB = makeStory({ id: 'b', title: 'Beta' });
  await openJobHub(page, makeProfile(), [storyA, storyB]);
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await expect(page.getByTestId('story-selection-panel')).toContainText('Backup');
});

test('already-selected stories show added state instead of add button', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openJobHub(page, makeProfile(), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  const card = page.getByTestId('library-story-card').first();
  await expect(card).toContainText('added');
  await expect(card.getByTestId('story-add-btn')).toHaveCount(0);
});

test('move-up button promotes backup to primary', async ({ page }) => {
  const storyA = makeStory({ id: 'a', title: 'Alpha' });
  const storyB = makeStory({ id: 'b', title: 'Beta' });
  await openJobHub(page, makeProfile(), [storyA, storyB]);
  await page.getByTestId('map-existing-btn').first().click();
  // Add both; Alpha is primary, Beta is backup
  await page.getByTestId('story-add-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  // Move Beta up to primary position
  await page.getByTestId('story-move-up-btn').first().click();
  const selectionPanel = page.getByTestId('story-selection-panel');
  const cards = selectionPanel.getByTestId('selected-story-card');
  await expect(cards.first()).toContainText('Beta');
});

test('Escape key closes modal without saving', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openJobHub(page, makeProfile(), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('story-map-modal')).not.toBeVisible();
  // Competency should still be uncovered
  await expect(page.getByTestId('competency-row').first().getByTestId('map-existing-btn')).toBeVisible();
});

test('save button persists mapping and closes modal', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openJobHub(page, makeProfile(), [story]);
  await page.getByTestId('map-existing-btn').first().click();
  await page.getByTestId('story-add-btn').first().click();
  await page.getByTestId('story-map-save-btn').click();
  await expect(page.getByTestId('story-map-modal')).not.toBeVisible();
  // Competency row should now show edit-mapping-btn (covered state)
  await expect(page.getByTestId('competency-row').first().getByTestId('edit-mapping-btn')).toBeVisible();
});
