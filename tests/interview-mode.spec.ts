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
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.evaluate(
    ({ s, p }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify(s));
      if (p) {
        localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
        sessionStorage.setItem('starlog_active_profile', p.id);
      }
    },
    { s: stories, p: profile ?? null }
  );
  await page.reload();

  if (mode === 'library') {
    // Navigate to story bank and click the review button
    await page.getByTestId('nav-story-bank').click();
    await expect(page.getByTestId('story-bank-view')).toBeVisible();
    await page.getByTestId('interview-btn').click();
    // Library mode sets submode=read directly → interview view in read mode
  } else {
    // Navigate to job-hub (auto-selects seeded profile) and start interview
    await expect(page.getByTestId('job-hub-view')).toBeVisible();
    await page.getByTestId('start-interview-btn').click();
    // Profile mode opens launch pad first; select Flash cards (read submode)
    await expect(page.getByTestId('interview-view')).toBeVisible();
    await page.getByTestId('mode-read').click();
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

test('library entry: ESC exits to story bank', async ({ page }) => {
  const story = makeStory();
  await seedAndOpenInterview(page, { stories: [story], mode: 'library' });

  await expect(page.getByTestId('interview-view')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
});

test('library entry: exit button returns to story bank', async ({ page }) => {
  const story = makeStory();
  await seedAndOpenInterview(page, { stories: [story], mode: 'library' });

  await page.getByTestId('exit-btn').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
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

test('profile entry: launch pad offers exactly three modes, no Live', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['story-1'] });
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate(
    ({ s, p }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify(s));
      localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
      sessionStorage.setItem('starlog_active_profile', p.id);
    },
    { s: [story], p: profile }
  );
  await page.reload();

  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await page.getByTestId('start-interview-btn').click();
  await expect(page.getByTestId('interview-view')).toBeVisible();

  // The three supported modes are present…
  await expect(page.getByTestId('mode-read')).toBeVisible();
  await expect(page.getByTestId('mode-train-question')).toBeVisible();
  await expect(page.getByTestId('mode-train-timer')).toBeVisible();
  // …and Live is gone for good.
  await expect(page.getByTestId('mode-live')).toHaveCount(0);
});

test('profile entry: ESC exits to job hub', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['story-1'] });
  await seedAndOpenInterview(page, { stories: [story], profile, mode: 'profile' });

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
});

test('launch pad (profile mode): ESC exits to job hub', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['story-1'] });
  // Seed and navigate to the launch pad but do NOT click a mode card
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.evaluate(
    ({ s, p }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify([s]));
      localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
      sessionStorage.setItem('starlog_active_profile', p.id);
    },
    { s: story, p: profile }
  );
  await page.reload();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await page.getByTestId('start-interview-btn').click();
  // Now on the launch pad (submode=launch), do NOT pick a mode
  await expect(page.getByTestId('interview-view')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
});

test('launch pad (library mode): ESC exits to story bank', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  // Seed and navigate to the launch pad via library mode
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.evaluate(
    ({ s }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify([s]));
    },
    { s: story }
  );
  await page.reload();
  await page.getByTestId('nav-story-bank').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
  await page.getByTestId('interview-btn').click();
  // Library mode goes directly to read submode, not launch pad — so ESC should exit to story bank
  await expect(page.getByTestId('interview-view')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
});

// ─── Drill: rating persistence ────────────────────────────────────────────────

async function seedAndOpenDrill(
  page: import('@playwright/test').Page,
  story: Story,
  profile: JobProfile
) {
  const { clearStorage, readDB } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.evaluate(
    ({ s, p }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify([s]));
      localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
      sessionStorage.setItem('starlog_active_profile', p.id);
    },
    { s: story, p: profile }
  );
  await page.reload();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await page.getByTestId('start-interview-btn').click();
  await expect(page.getByTestId('interview-view')).toBeVisible();
  await page.getByTestId('mode-train-timer').click();
  await expect(page.getByTestId('interview-view')).toBeVisible();
  return { readDB };
}

test('drill: clicking a rating button persists rank to story', async ({ page }) => {
  const story = makeStory({ id: 'rated-story', rank: null });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['rated-story'] });
  const { readDB } = await seedAndOpenDrill(page, story, profile);

  // Button exists and is clickable
  await expect(page.getByTestId('rating-4')).toBeVisible();
  await page.getByTestId('rating-4').click();

  // Selected style applied immediately
  await expect(page.getByTestId('rating-4')).toHaveClass(/border-primary/);

  // Persisted to DB
  const stories = await readDB(page, 'stories', []) as Story[];
  const saved = stories.find(s => s.id === 'rated-story');
  expect(saved?.rank).toBe(4);
});

test('drill: keyboard shortcut (1–5) persists rank to story', async ({ page }) => {
  const story = makeStory({ id: 'kb-story', rank: null });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['kb-story'] });
  const { readDB } = await seedAndOpenDrill(page, story, profile);

  await page.keyboard.press('2');
  await expect(page.getByTestId('rating-2')).toHaveClass(/border-primary/);

  const stories = await readDB(page, 'stories', []) as Story[];
  const saved = stories.find(s => s.id === 'kb-story');
  expect(saved?.rank).toBe(2);
});

test('drill: rating persists through reload (round-trip)', async ({ page }) => {
  const story = makeStory({ id: 'reload-story', rank: null });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['reload-story'] });
  await seedAndOpenDrill(page, story, profile);

  await page.getByTestId('rating-5').click();
  await expect(page.getByTestId('rating-5')).toHaveClass(/border-primary/);

  // Navigate away and back to confirm persistence
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await page.getByTestId('nav-story-bank').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
  await page.locator('[data-testid="story-row"]').first().click();
  // The readiness stars in StoryDetail should reflect rank=5
  await expect(page.getByTestId('story-detail-view')).toBeVisible();
  const stars = page.getByTestId('readiness-star');
  await expect(stars.nth(4)).toHaveClass(/text-indigo/);
});

test('drill: rating on last card persists even when exiting via ESC', async ({ page }) => {
  const story = makeStory({ id: 'esc-story', rank: null });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['esc-story'] });
  const { readDB } = await seedAndOpenDrill(page, story, profile);

  await page.getByTestId('rating-3').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('job-hub-view')).toBeVisible();

  const stories = await readDB(page, 'stories', []) as Story[];
  const saved = stories.find(s => s.id === 'esc-story');
  expect(saved?.rank).toBe(3);
});

test('drill: advancing card does not clobber rank of unrated story', async ({ page }) => {
  const s1 = makeStory({ id: 's1', rank: 5, title: 'Story A' });
  const s2 = makeStory({ id: 's2', rank: null, title: 'Story B' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['s1', 's2'] });
  const { readDB } = await seedAndOpenDrill(page, s1, profile);
  // Override: need two stories — re-seed
  const { clearStorage } = await import('./helpers');
  await clearStorage(page);
  await page.evaluate(
    ({ stories, p }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify(stories));
      localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
      sessionStorage.setItem('starlog_active_profile', p.id);
    },
    { stories: [s1, s2], p: profile }
  );
  await page.reload();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await page.getByTestId('start-interview-btn').click();
  await page.getByTestId('mode-train-timer').click();
  await expect(page.getByTestId('interview-story-title')).toBeVisible();

  // Advance without rating — s2 rank should remain null
  await page.getByTestId('next-story-btn').click();
  await expect(page.getByTestId('interview-story-title')).toHaveText('Story B');

  await page.keyboard.press('Escape');
  const stories = await readDB(page, 'stories', []) as Story[];
  const saved1 = stories.find(s => s.id === 's1');
  const saved2 = stories.find(s => s.id === 's2');
  expect(saved1?.rank).toBe(5); // unchanged
  expect(saved2?.rank).toBeNull(); // not clobbered
});

test('drill: card with existing rank shows stored rating pre-selected', async ({ page }) => {
  const story = makeStory({ id: 'preseeded', rank: 4 });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['preseeded'] });
  await seedAndOpenDrill(page, story, profile);

  // Button 4 should appear selected on entry
  await expect(page.getByTestId('rating-4')).toHaveClass(/border-primary/);
});

// ─── Terminology ──────────────────────────────────────────────────────────────

test('terminology: launch pad header reads "Rehearse", not "Interview Prep"', async ({ page }) => {
  const story = makeStory({ id: 'term-story' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['term-story'] });
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate(
    ({ s, p }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify([s]));
      localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
      sessionStorage.setItem('starlog_active_profile', p.id);
    },
    { s: story, p: profile }
  );
  await page.reload();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await page.getByTestId('start-interview-btn').click();
  await expect(page.getByTestId('interview-view')).toBeVisible();

  await expect(page.getByText('StarLog · Rehearse')).toBeVisible();
  await expect(page.getByText('StarLog · Interview Prep')).toHaveCount(0);
});

test('terminology: flash-cards header reads "Flash cards", not "Review mode"', async ({ page }) => {
  const story = makeStory();
  await seedAndOpenInterview(page, { stories: [story], mode: 'library' });

  await expect(page.getByText('StarLog · Flash cards')).toBeVisible();
  await expect(page.getByText('StarLog · Review mode')).toHaveCount(0);
});

// ─── Job switcher ──────────────────────────────────────────────────────────────

async function openLaunchPad(
  page: import('@playwright/test').Page,
  { stories, profiles }: { stories: Story[]; profiles: JobProfile[] }
) {
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  const firstProfile = profiles[0];
  await page.evaluate(
    ({ s, ps, pid }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_stories', JSON.stringify(s));
      localStorage.setItem('starlog_job_profiles', JSON.stringify(ps));
      if (pid) sessionStorage.setItem('starlog_active_profile', pid);
    },
    { s: stories, ps: profiles, pid: firstProfile?.id ?? null }
  );
  await page.reload();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await page.getByTestId('start-interview-btn').click();
  await expect(page.getByTestId('interview-view')).toBeVisible();
}

test('job switcher: single profile — select present and pre-selected', async ({ page }) => {
  const story = makeStory({ id: 'sw-story-1' });
  const profile = makeProfile({ [COMPETENCY_FIXTURE[0]]: ['sw-story-1'] });
  await openLaunchPad(page, { stories: [story], profiles: [profile] });

  const select = page.getByTestId('rehearse-job-select');
  await expect(select).toBeVisible();
  // The selected option should contain the profile's role
  await expect(select).toHaveValue(profile.id);
});

test('job switcher: switching to profile 2 updates competency list', async ({ page }) => {
  const storyA = makeStory({ id: 'sw-a', title: 'Story A', competency_tags: [COMPETENCY_FIXTURE[0]] });
  const storyB = makeStory({ id: 'sw-b', title: 'Story B', competency_tags: [COMPETENCY_FIXTURE[1]] });

  const profile1: JobProfile = {
    id: 'p1',
    company: 'Alpha Corp',
    role: 'EM',
    jobDescription: 'Job 1',
    extractedCompetencies: [COMPETENCY_FIXTURE[0]],
    competencyMap: { [COMPETENCY_FIXTURE[0]]: ['sw-a'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  };
  const profile2: JobProfile = {
    id: 'p2',
    company: 'Beta Inc',
    role: 'PM',
    jobDescription: 'Job 2',
    extractedCompetencies: [COMPETENCY_FIXTURE[1]],
    competencyMap: { [COMPETENCY_FIXTURE[1]]: ['sw-b'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  };

  await openLaunchPad(page, { stories: [storyA, storyB], profiles: [profile1, profile2] });

  // Profile 1 competencies visible initially
  await expect(page.getByText(COMPETENCY_FIXTURE[0])).toBeVisible();

  // Switch to profile 2
  await page.getByTestId('rehearse-job-select').selectOption('p2');

  // Profile 2 competencies now visible
  await expect(page.getByText(COMPETENCY_FIXTURE[1])).toBeVisible();
  // Profile 1 competency gone
  await expect(page.getByText(COMPETENCY_FIXTURE[0])).toHaveCount(0);
});

test('job switcher: switching to "All stories" shows all stories', async ({ page }) => {
  const storyA = makeStory({ id: 'all-a', title: 'Alpha Story' });
  const storyB = makeStory({ id: 'all-b', title: 'Beta Story' });

  const profile: JobProfile = {
    id: 'p-all',
    company: 'Corp',
    role: 'Dev',
    jobDescription: 'Job',
    extractedCompetencies: [COMPETENCY_FIXTURE[0]],
    competencyMap: { [COMPETENCY_FIXTURE[0]]: ['all-a'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  };

  await openLaunchPad(page, { stories: [storyA, storyB], profiles: [profile] });

  // Initially only 1 story mapped
  await expect(page.getByTestId('rehearse-subtitle')).toContainText('1 story');

  // Switch to "All stories"
  await page.getByTestId('rehearse-job-select').selectOption('');

  // Should now show both stories (2 stories total)
  await expect(page.getByTestId('rehearse-subtitle')).toContainText('2 stories');
});

test('job switcher: sessionStorage updated after switching to profile 2', async ({ page }) => {
  const storyA = makeStory({ id: 'ss-a' });
  const storyB = makeStory({ id: 'ss-b' });

  const profile1: JobProfile = {
    id: 'ss-p1',
    company: 'CorpA',
    role: 'Dev',
    jobDescription: 'J1',
    extractedCompetencies: [COMPETENCY_FIXTURE[0]],
    competencyMap: { [COMPETENCY_FIXTURE[0]]: ['ss-a'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  };
  const profile2: JobProfile = {
    id: 'ss-p2',
    company: 'CorpB',
    role: 'Lead',
    jobDescription: 'J2',
    extractedCompetencies: [COMPETENCY_FIXTURE[1]],
    competencyMap: { [COMPETENCY_FIXTURE[1]]: ['ss-b'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  };

  await openLaunchPad(page, { stories: [storyA, storyB], profiles: [profile1, profile2] });

  // Switch to profile 2
  await page.getByTestId('rehearse-job-select').selectOption('ss-p2');

  // Check sessionStorage updated
  const storedId = await page.evaluate(() => sessionStorage.getItem('starlog_active_profile'));
  expect(storedId).toBe('ss-p2');
});
