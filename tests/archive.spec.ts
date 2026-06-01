import { test, expect } from '@playwright/test';
import { clearStorage, readDB } from './helpers';
import type { Page } from '@playwright/test';

interface SeedProfile {
  id: string;
  company: string;
  role: string;
  jobDescription: string;
  extractedCompetencies: string[];
  competencyMap: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** Set up auth + seed job profiles via localStorage (migration path). */
async function setupWithProfiles(page: Page, profiles: SeedProfile[]) {
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate(
    ({ profiles }) => {
      localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
      localStorage.setItem('starlog_job_profiles', JSON.stringify(profiles));
    },
    { profiles }
  );
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
}

function makeProfile(overrides: Partial<SeedProfile> = {}): SeedProfile {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    company: 'Acme Corp',
    role: 'Engineering Manager',
    jobDescription: 'We need a leader',
    extractedCompetencies: ['Leadership', 'Communication'],
    competencyMap: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    ...overrides,
  };
}

// ─── Test cases ───────────────────────────────────────────────────────────────

test('archive button visible in job hub, hides job from sidebar', async ({ page }) => {
  const profile = makeProfile();
  await setupWithProfiles(page, [profile]);

  // Sidebar shows the active job
  await expect(page.getByTestId(`nav-job-${profile.id}`)).toBeVisible();

  // Navigate to job hub for the profile and archive it
  await page.getByTestId(`nav-job-${profile.id}`).click();
  await expect(page.getByTestId('archive-job-btn')).toBeVisible();
  await page.getByTestId('archive-job-btn').click();

  // Sidebar no longer shows the job in the active list
  await expect(page.getByTestId(`nav-job-${profile.id}`)).not.toBeVisible();

  // Undo toast appears
  await expect(page.getByTestId('undo-toast')).toBeVisible();
});

test('archived state persists across reload', async ({ page }) => {
  const profile = makeProfile();
  await setupWithProfiles(page, [profile]);

  await page.getByTestId(`nav-job-${profile.id}`).click();
  await page.getByTestId('archive-job-btn').click();
  await expect(page.getByTestId('undo-toast')).toBeVisible();

  // Wait for the IndexedDB write to land before reloading (fire-and-forget persist)
  await expect.poll(
    async () => {
      const ps = await readDB(page, 'jobProfiles', []) as SeedProfile[];
      return ps.find(p => p.id === profile.id)?.archivedAt != null;
    },
    { timeout: 5000 }
  ).toBe(true);

  // Reload and verify the job is still gone from the active list
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId(`nav-job-${profile.id}`)).not.toBeVisible();

  // Verify archivedAt is set in IndexedDB
  const profiles = await readDB(page, 'jobProfiles', []) as SeedProfile[];
  const saved = profiles.find(p => p.id === profile.id);
  expect(saved).toBeDefined();
  expect(saved!.archivedAt).not.toBeNull();
});

test('undo toast revives the job', async ({ page }) => {
  const profile = makeProfile();
  await setupWithProfiles(page, [profile]);

  await page.getByTestId(`nav-job-${profile.id}`).click();
  await page.getByTestId('archive-job-btn').click();
  await expect(page.getByTestId('undo-toast')).toBeVisible();

  // Click Undo
  await page.getByTestId('undo-btn').click();

  // Toast gone, job back in sidebar
  await expect(page.getByTestId('undo-toast')).not.toBeVisible();
  await expect(page.getByTestId(`nav-job-${profile.id}`)).toBeVisible();
});

test('direct URL to archived job shows read-only banner with Revive', async ({ page }) => {
  const profile = makeProfile({ archivedAt: new Date().toISOString() });
  await setupWithProfiles(page, [profile]);

  // Navigate directly to the job hub URL for the archived profile
  await page.goto(`/#/job/${profile.id}`);
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('archived-banner')).toBeVisible({ timeout: 5000 });

  // Revive it
  await page.getByTestId('revive-job-btn').click();

  // Banner gone, job back in sidebar
  await expect(page.getByTestId('archived-banner')).not.toBeVisible();
  await expect(page.getByTestId(`nav-job-${profile.id}`)).toBeVisible();

  // DB: archivedAt is null
  const profiles = await readDB(page, 'jobProfiles', []) as SeedProfile[];
  const saved = profiles.find(p => p.id === profile.id);
  expect(saved!.archivedAt).toBeNull();
});

test('archiving preserves story mappings; revive restores them', async ({ page }) => {
  const storyId = 'story-abc';
  const profile = makeProfile({
    extractedCompetencies: ['Leadership'],
    competencyMap: { Leadership: [storyId] },
  });
  await setupWithProfiles(page, [profile]);

  // Archive
  await page.getByTestId(`nav-job-${profile.id}`).click();
  await page.getByTestId('archive-job-btn').click();

  // Check DB — mappings are preserved
  const archived = await readDB(page, 'jobProfiles', []) as SeedProfile[];
  const ap = archived.find(p => p.id === profile.id)!;
  expect(ap.competencyMap['Leadership']).toEqual([storyId]);

  // Revive via undo
  await page.getByTestId('undo-btn').click();

  // Mappings still intact after revive
  const revived = await readDB(page, 'jobProfiles', []) as SeedProfile[];
  const rp = revived.find(p => p.id === profile.id)!;
  expect(rp.competencyMap['Leadership']).toEqual([storyId]);
  expect(rp.archivedAt).toBeNull();
});

test('archived section hidden in sidebar when no archived jobs', async ({ page }) => {
  const profile = makeProfile();
  await setupWithProfiles(page, [profile]);

  await expect(page.getByTestId('sidebar-archived-section')).not.toBeVisible();
});

test('archived section appears in sidebar and revive works', async ({ page }) => {
  const active = makeProfile({ role: 'Active Role' });
  const archived = makeProfile({ role: 'Old Role', archivedAt: new Date().toISOString() });
  await setupWithProfiles(page, [active, archived]);

  // Active job shown in sidebar, archived one absent
  await expect(page.getByTestId(`nav-job-${active.id}`)).toBeVisible();
  await expect(page.getByTestId(`nav-job-${archived.id}`)).not.toBeVisible();

  // Archived section visible (collapsed by default)
  await expect(page.getByTestId('sidebar-archived-section')).toBeVisible();
  await page.getByTestId('sidebar-toggle-archived').click();

  // Archived job appears
  await expect(page.getByTestId(`nav-archived-job-${archived.id}`)).toBeVisible();

  // Revive via sidebar button
  await page.getByTestId('sidebar-revive-btn').click();

  // Archived section gone, job now in active list
  await expect(page.getByTestId('sidebar-archived-section')).not.toBeVisible();
  await expect(page.getByTestId(`nav-job-${archived.id}`)).toBeVisible();
});
