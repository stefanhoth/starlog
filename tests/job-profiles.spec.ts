import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const COMPETENCY_FIXTURE = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/competencies.json'), 'utf8')
);

function mockGeminiCompetencies(page: import('@playwright/test').Page) {
  return page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(COMPETENCY_FIXTURE) }] } }],
      }),
    })
  );
}

async function goToProfiles(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Base mock for validation; individual tests add extraction mock after (LIFO takes priority)
  await mockGeminiCompetencies(page);
  await page.getByTestId('api-key-input').fill('AIzaTestKey123');
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
  await page.getByTestId('nav-job-profiles').click();
  await expect(page.getByTestId('job-profiles-view')).toBeVisible();
}

test('empty state shown with no profiles', async ({ page }) => {
  await goToProfiles(page);
  await expect(page.getByTestId('profiles-empty')).toBeVisible();
});

test('creating a profile shows competency chips', async ({ page }) => {
  await goToProfiles(page);
  await mockGeminiCompetencies(page);
  await page.getByTestId('new-profile-btn').click();
  await page.getByTestId('profile-company').fill('Acme Corp');
  await page.getByTestId('profile-role').fill('Engineering Manager');
  await page.getByTestId('profile-jd').fill('We need a leader who can deliver under ambiguity...');
  await page.getByTestId('profile-submit').click();
  await expect(page.getByTestId('job-profile-card')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Acme Corp')).toBeVisible();
  await expect(page.getByText('Leadership')).toBeVisible();
});

test('created profile persists in localStorage', async ({ page }) => {
  await goToProfiles(page);
  await mockGeminiCompetencies(page);
  await page.getByTestId('new-profile-btn').click();
  await page.getByTestId('profile-company').fill('TestCo');
  await page.getByTestId('profile-role').fill('Head of Engineering');
  await page.getByTestId('profile-jd').fill('Looking for a strong leader...');
  await page.getByTestId('profile-submit').click();
  await expect(page.getByTestId('job-profile-card')).toBeVisible({ timeout: 10000 });
  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem('starlog_job_profiles') ?? '[]'));
  expect(profiles[0].company).toBe('TestCo');
  expect(profiles[0].extractedCompetencies).toContain('Leadership');
});

test('clicking profile card navigates to detail view', async ({ page }) => {
  await goToProfiles(page);
  await mockGeminiCompetencies(page);
  await page.getByTestId('new-profile-btn').click();
  await page.getByTestId('profile-company').fill('Acme');
  await page.getByTestId('profile-role').fill('EM');
  await page.getByTestId('profile-jd').fill('Job description here');
  await page.getByTestId('profile-submit').click();
  await expect(page.getByTestId('job-profile-card')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('job-profile-card').click();
  await expect(page.getByTestId('job-profile-detail-view')).toBeVisible();
});
