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

/** Navigate to job-hub with a clean slate (no profiles). */
async function goToHub(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
  });
  await mockGeminiCompetencies(page);
  await page.reload();
  // Should be in job-hub showing the no-profile empty state
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
}

test('empty state shown with no profiles', async ({ page }) => {
  await goToHub(page);
  await expect(page.getByTestId('profiles-empty')).toBeVisible();
});

test('creating a profile shows competency list', async ({ page }) => {
  await goToHub(page);
  await page.getByTestId('nav-add-job').click();
  await page.getByTestId('profile-company').fill('Acme Corp');
  await page.getByTestId('profile-role').fill('Engineering Manager');
  await page.getByTestId('profile-jd').fill('We need a leader who can deliver under ambiguity...');
  await page.getByTestId('profile-submit').click();
  // Extraction runs → job-review step shows extracted competencies
  await expect(page.getByText('Leadership')).toBeVisible({ timeout: 10000 });
  // Save to open job hub
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await expect(page.getByTestId('job-hub-view').getByText('Acme Corp')).toBeVisible();
  await expect(page.getByTestId('job-hub-view').getByText('Leadership')).toBeVisible();
});

test('created profile persists in localStorage', async ({ page }) => {
  await goToHub(page);
  await page.getByTestId('nav-add-job').click();
  await page.getByTestId('profile-company').fill('TestCo');
  await page.getByTestId('profile-role').fill('Head of Engineering');
  await page.getByTestId('profile-jd').fill('Looking for a strong leader...');
  await page.getByTestId('profile-submit').click();
  await expect(page.getByText('Leadership')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  const profiles = await page.evaluate(() => JSON.parse(localStorage.getItem('starlog_job_profiles') ?? '[]'));
  expect(profiles[0].company).toBe('TestCo');
  expect(profiles[0].extractedCompetencies).toContain('Leadership');
});

test('clicking job in sidebar navigates to its job hub', async ({ page }) => {
  await goToHub(page);
  await page.getByTestId('nav-add-job').click();
  await page.getByTestId('profile-company').fill('Acme');
  await page.getByTestId('profile-role').fill('EM');
  await page.getByTestId('profile-jd').fill('Job description here');
  await page.getByTestId('profile-submit').click();
  await expect(page.getByText('Leadership')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  // Sidebar shows a nav button for the profile; clicking it stays on job-hub
  await page.getByRole('button', { name: /EM/ }).first().click();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await expect(page.getByText('Leadership')).toBeVisible();
});
