import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { JobProfile } from '../src/lib/types';
import { clearStorage } from './helpers';

function makeProfile(overrides: Partial<JobProfile> = {}): JobProfile {
  return {
    id: crypto.randomUUID(),
    company: 'Acme',
    role: 'Engineering Manager',
    jobDescription: 'A great job',
    extractedCompetencies: ['Leadership', 'Delivery'],
    competencyMap: {},
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

/** Seed job profiles, then open the dashboard via the sidebar nav. */
async function openDashboard(page: Page, profiles: JobProfile[]) {
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate((p) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
    localStorage.setItem('starlog_job_profiles', JSON.stringify(p));
  }, profiles);
  await page.reload();
  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId('dashboard-view')).toBeVisible();
}

test('empty state funnels to adding the first job', async ({ page }) => {
  await openDashboard(page, []);
  await expect(page.getByTestId('dashboard-empty')).toBeVisible();
  await page.getByTestId('dashboard-add-job').click();
  await expect(page.getByTestId('profile-role')).toBeVisible(); // reached the Add Job form
});

test('lists jobs most-recently-edited first', async ({ page }) => {
  const older = makeProfile({ role: 'Older Job', updatedAt: '2026-06-01T00:00:00Z' });
  const newer = makeProfile({ role: 'Newer Job', updatedAt: '2026-06-10T00:00:00Z' });
  await openDashboard(page, [older, newer]); // seeded older-first on purpose

  const roles = page.getByTestId('dashboard-job-role');
  await expect(roles).toHaveCount(2);
  await expect(roles.nth(0)).toHaveText('Newer Job');
  await expect(roles.nth(1)).toHaveText('Older Job');
});

test('shows coverage counts matching the coverage formula', async ({ page }) => {
  const half = makeProfile({
    role: 'Half Done',
    extractedCompetencies: ['Leadership', 'Delivery'],
    competencyMap: { Leadership: ['s1'] }, // 1 of 2 covered
  });
  await openDashboard(page, [half]);
  await expect(page.getByTestId('dashboard-job-coverage')).toHaveText('1 / 2 covered (50%)');
});

test('"Continue mapping" appears only for incomplete jobs and opens that job', async ({ page }) => {
  const full = makeProfile({
    role: 'Fully Covered',
    updatedAt: '2026-06-09T00:00:00Z',
    extractedCompetencies: ['Leadership', 'Delivery'],
    competencyMap: { Leadership: ['s1'], Delivery: ['s2'] }, // 100%
  });
  const half = makeProfile({
    role: 'Half Done',
    updatedAt: '2026-06-10T00:00:00Z',
    extractedCompetencies: ['Leadership', 'Delivery'],
    competencyMap: { Leadership: ['s1'] }, // 50%
  });
  await openDashboard(page, [full, half]);

  const fullCard = page.getByTestId('dashboard-job-card').filter({ hasText: 'Fully Covered' });
  const halfCard = page.getByTestId('dashboard-job-card').filter({ hasText: 'Half Done' });

  // Complete job: no quick action. Incomplete job: quick action present.
  await expect(fullCard.getByTestId('dashboard-continue-mapping')).toHaveCount(0);
  await expect(halfCard.getByTestId('dashboard-continue-mapping')).toBeVisible();

  // Quick action deep-links into that job's hub.
  await halfCard.getByTestId('dashboard-continue-mapping').click();
  await expect(page.getByTestId('job-hub-view')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Half Done' })).toBeVisible();
});

test('coverage bar exposes an accessible progressbar', async ({ page }) => {
  await openDashboard(page, [makeProfile({ role: 'A11y Job' })]);
  const bar = page.getByRole('progressbar');
  await expect(bar).toHaveAttribute('value', '0');
  await expect(bar).toHaveAttribute('aria-label', /A11y Job.*covered/);
});
