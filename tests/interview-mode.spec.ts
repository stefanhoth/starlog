import { test, expect } from '@playwright/test';
import type { Story } from '../src/lib/types';
import type { JobProfile } from '../src/lib/types';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const COMPETENCY_FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/competencies.json'), 'utf8')
) as string[];

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: crypto.randomUUID(),
    title: 'Test Story',
    original_language: 'en',
    competency_tags: ['Leadership'],
    star: {
      situation: 'Situation text',
      task: 'Task text',
      action: ['First action step', 'Second action step', 'Third action step'],
      result: 'Result text',
    },
    quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: '' },
    notes: '', rank: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProfile(competencyMap: Record<string, string[]> = {}): JobProfile {
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

async function seedAndOpenInterview(
  page: import('@playwright/test').Page,
  {
    stories,
    profile,
    mode,
  }: { stories: Story[]; profile?: JobProfile; mode: 'library' | 'profile' }
) {
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
  await page.evaluate(
    ({ s, p, m }) => {
      localStorage.setItem('starlog_stories', JSON.stringify(s));
      if (p) {
        localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
        sessionStorage.setItem('starlog_active_profile', p.id);
      }
      sessionStorage.setItem('starlog_interview_mode', m);
    },
    { s: stories, p: profile ?? null, m: mode }
  );
  // Reload so Svelte stores pick up the seeded localStorage/sessionStorage
  await page.reload();
  if (mode === 'library') {
    // Already on library after reload (consentGiven=true redirects there)
    await page.getByTestId('interview-btn').click();
  } else {
    await page.getByTestId('nav-job-profiles').click();
    await page.getByTestId('job-profile-card').click();
    await expect(page.getByTestId('job-profile-detail-view')).toBeVisible();
    await page.getByTestId('profile-interview-btn').click();
  }
  await expect(page.getByTestId('interview-view')).toBeVisible();
}

// ─── Library mode ─────────────────────────────────────────────────────────────

test('library entry: interview view visible, nav hidden', async ({ page }) => {
  const story = makeStory({ title: 'My Leadership Story' });
  await seedAndOpenInterview(page, { stories: [story], mode: 'library' });

  // Nav sidebar should not be visible
  await expect(page.getByTestId('nav')).not.toBeVisible();
  // Story title and crib visible
  await expect(page.getByTestId('interview-story-title')).toHaveText('My Leadership Story');
  await expect(page.getByTestId('action-crib')).toBeVisible();
});

test('library entry: click story card expands full STAR', async ({ page }) => {
  const story = makeStory({ title: 'Delivery Story' });
  await seedAndOpenInterview(page, { stories: [story], mode: 'library' });

  // Full STAR not visible initially
  await expect(page.getByTestId('full-star')).not.toBeVisible();

  // Click to expand
  await page.getByTestId('story-card-interview').click();
  await expect(page.getByTestId('full-star')).toBeVisible();
  await expect(page.getByText('Situation text')).toBeVisible();

  // Click again to collapse
  await page.getByTestId('story-card-interview').click();
  await expect(page.getByTestId('full-star')).not.toBeVisible();
});

test('library entry: arrow keys navigate between stories', async ({ page }) => {
  const s1 = makeStory({ title: 'Story One' });
  const s2 = makeStory({ title: 'Story Two' });
  const s3 = makeStory({ title: 'Story Three' });
  await seedAndOpenInterview(page, { stories: [s1, s2, s3], mode: 'library' });

  await expect(page.getByTestId('interview-story-title')).toHaveText('Story One');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('interview-story-title')).toHaveText('Story Two');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('interview-story-title')).toHaveText('Story Three');

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('interview-story-title')).toHaveText('Story Two');
});

test('library entry: ESC exits to library view', async ({ page }) => {
  const story = makeStory();
  await seedAndOpenInterview(page, { stories: [story], mode: 'library' });

  await expect(page.getByTestId('interview-view')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('library-view')).toBeVisible();
});

test('library entry: exit button returns to library', async ({ page }) => {
  const story = makeStory();
  await seedAndOpenInterview(page, { stories: [story], mode: 'library' });

  await page.getByTestId('exit-btn').click();
  await expect(page.getByTestId('library-view')).toBeVisible();
});

// ─── Profile mode ─────────────────────────────────────────────────────────────

test('profile entry: competency header visible', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['story-1'] });
  await seedAndOpenInterview(page, { stories: [story], profile, mode: 'profile' });

  await expect(page.getByTestId('competency-header')).toHaveText(COMPETENCY_FIXTURE[0]);
});

test('profile entry: arrow down/up navigates between competency groups', async ({ page }) => {
  const s1 = makeStory({ id: 'story-1', title: 'Story A' });
  const s2 = makeStory({ id: 'story-2', title: 'Story B' });
  const profile = makeProfile({
    [COMPETENCY_FIXTURE[0]]: ['story-1'],
    [COMPETENCY_FIXTURE[1]]: ['story-2'],
  });
  await seedAndOpenInterview(page, { stories: [s1, s2], profile, mode: 'profile' });

  await expect(page.getByTestId('competency-header')).toHaveText(COMPETENCY_FIXTURE[0]);
  await expect(page.getByTestId('interview-story-title')).toHaveText('Story A');

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('competency-header')).toHaveText(COMPETENCY_FIXTURE[1]);
  await expect(page.getByTestId('interview-story-title')).toHaveText('Story B');

  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('competency-header')).toHaveText(COMPETENCY_FIXTURE[0]);
});

test('profile entry: competencies with no mapped stories are skipped', async ({ page }) => {
  // Only map story to competency[0] and competency[2], skip [1], [3], [4]
  const s1 = makeStory({ id: 'story-1', title: 'Story Alpha' });
  const s2 = makeStory({ id: 'story-2', title: 'Story Gamma' });
  const profile = makeProfile({
    [COMPETENCY_FIXTURE[0]]: ['story-1'],
    // COMPETENCY_FIXTURE[1] intentionally unmapped
    [COMPETENCY_FIXTURE[2]]: ['story-2'],
  });
  await seedAndOpenInterview(page, { stories: [s1, s2], profile, mode: 'profile' });

  // First group
  await expect(page.getByTestId('competency-header')).toHaveText(COMPETENCY_FIXTURE[0]);
  // ArrowDown should jump straight to COMPETENCY_FIXTURE[2], skipping [1]
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('competency-header')).toHaveText(COMPETENCY_FIXTURE[2]);
});

test('profile entry: ESC exits to job-profile-detail', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['story-1'] });
  await seedAndOpenInterview(page, { stories: [story], profile, mode: 'profile' });

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('job-profile-detail-view')).toBeVisible();
});
