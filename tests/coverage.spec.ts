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

async function openProfileDetail(
  page: import('@playwright/test').Page,
  profile: JobProfile,
  stories: Story[] = []
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
  await page.evaluate(({ p, s }) => {
    localStorage.setItem('starlog_job_profiles', JSON.stringify([p]));
    localStorage.setItem('starlog_stories', JSON.stringify(s));
    sessionStorage.setItem('starlog_active_profile', p.id);
  }, { p: profile, s: stories });
  await page.reload();
  await page.getByTestId('nav-job-profiles').click();
  await page.getByTestId('job-profile-card').click();
  await expect(page.getByTestId('job-profile-detail-view')).toBeVisible();
}

test('coverage matrix shows all extracted competencies', async ({ page }) => {
  await openProfileDetail(page, makeProfile([]));
  const rows = page.getByTestId('coverage-row');
  await expect(rows).toHaveCount(COMPETENCY_FIXTURE.length);
});

test('unmapped competency shows red indicator', async ({ page }) => {
  await openProfileDetail(page, makeProfile([]));
  const firstRow = page.getByTestId('coverage-row').first();
  await expect(firstRow.getByText('🔴')).toBeVisible();
});

test('clicking competency row opens story picker', async ({ page }) => {
  const story = makeStory();
  await openProfileDetail(page, makeProfile([story]), [story]);
  await page.getByTestId('coverage-competency-btn').first().click();
  await expect(page.getByTestId('story-picker')).toBeVisible();
});

test('selecting story in picker turns indicator green', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openProfileDetail(page, makeProfile([story]), [story]);
  await page.getByTestId('coverage-competency-btn').first().click();
  await page.getByTestId('story-picker').locator('input[type="checkbox"]').first().check();
  const firstRow = page.getByTestId('coverage-row').first();
  await expect(firstRow.getByText('🟢')).toBeVisible();
});

test('same story can be mapped to two competencies', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  await openProfileDetail(page, makeProfile([story]), [story]);
  // Map to first competency
  await page.getByTestId('coverage-competency-btn').first().click();
  await page.getByTestId('story-picker').locator('input[type="checkbox"]').first().check();
  await page.getByTestId('coverage-competency-btn').first().click(); // close
  // Map to second competency
  await page.getByTestId('coverage-competency-btn').nth(1).click();
  await page.getByTestId('story-picker').locator('input[type="checkbox"]').first().check();
  // Both should be green
  await expect(page.getByTestId('coverage-row').first().getByText('🟢')).toBeVisible();
  await expect(page.getByTestId('coverage-row').nth(1).getByText('🟢')).toBeVisible();
});

test('re-extract with removed competency shows reconciliation modal', async ({ page }) => {
  const story = makeStory({ id: 'story-1' });
  // Profile has "OldCompetency" mapped with a story
  const profile = makeProfile([story], { 'OldCompetency': ['story-1'] });
  profile.extractedCompetencies = [...COMPETENCY_FIXTURE, 'OldCompetency'];
  await openProfileDetail(page, profile, [story]);
  // Mock re-extract to return list WITHOUT OldCompetency
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(COMPETENCY_FIXTURE) }] } }] }),
    })
  );
  await page.getByTestId('reextract-btn').click();
  await expect(page.getByTestId('reconcile-modal')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('orphan-remove').click();
  await expect(page.getByTestId('reconcile-modal')).not.toBeVisible();
});
