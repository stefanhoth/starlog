/**
 * Unit-style tests for parseBackup() hardening.
 *
 * These drive the Data view's import UI: upload a crafted .json file and
 * check whether it passes validation (shows confirm dialog) or fails with the
 * expected error message.  This is the closest we can get to unit-testing the
 * function without introducing a second test runner.
 */
import { test, expect } from '@playwright/test';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { clearStorage } from './helpers';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_STORY = {
  id: 's1',
  title: 'Led a migration',
  original_language: 'en',
  competency_tags: ['Leadership'],
  star: { situation: 'S', task: 'T', action: ['A1', 'A2'], result: 'R' },
  quality: { situation: 'high', task: 'medium', action: 'low', result: 'high', notes: '' },
  notes: '',
  rank: 3,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
};

const VALID_JOB_PROFILE = {
  id: 'p1',
  company: 'Acme',
  role: 'Engineering Manager',
  jobDescription: 'Lead a team.',
  extractedCompetencies: ['Leadership'],
  competencyMap: { Leadership: ['s1'] },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  archivedAt: null,
};

function validBundle(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '0.0.0',
    stories: [VALID_STORY],
    jobProfiles: [VALID_JOB_PROFILE],
    ...overrides,
  };
}

function writeTmp(name: string, content: string): string {
  const path = join(tmpdir(), name);
  writeFileSync(path, content);
  return path;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

async function openDataView(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey', consentGiven: true }));
  });
  await page.reload();
  await page.goto('/#/data');
}

async function importFile(page: import('@playwright/test').Page, filePath: string) {
  await page.getByTestId('import-input').setInputFiles(filePath);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);
});

test('valid bundle passes and shows confirmation dialog', async ({ page }) => {
  await openDataView(page);
  const path = writeTmp('valid.starlog.json', JSON.stringify(validBundle()));
  await importFile(page, path);
  await expect(page.getByTestId('import-confirm')).toBeVisible();
  await expect(page.getByTestId('import-error')).not.toBeVisible();
});

test('bundle with version too new rejects with correct message', async ({ page }) => {
  await openDataView(page);
  const path = writeTmp('future.starlog.json', JSON.stringify(validBundle({ version: 99 })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
  await expect(page.getByTestId('import-error')).toContainText('newer version of StarLog');
});

test('bundle with version older than current is accepted', async ({ page }) => {
  // Version 0 is older than the known version 1 — must NOT be rejected
  await openDataView(page);
  // Version 0 bundles have the same shape; we just lower the version number
  const path = writeTmp('old.starlog.json', JSON.stringify(validBundle({ version: 0 })));
  await importFile(page, path);
  await expect(page.getByTestId('import-confirm')).toBeVisible();
});

test('missing exportedAt field rejects', async ({ page }) => {
  await openDataView(page);
  const bundle = validBundle();
  delete (bundle as Record<string, unknown>).exportedAt;
  const path = writeTmp('no-exported-at.starlog.json', JSON.stringify(bundle));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
  await expect(page.getByTestId('import-error')).toContainText('exportedAt');
});

test('invalid exportedAt date rejects', async ({ page }) => {
  await openDataView(page);
  const path = writeTmp('bad-date.starlog.json', JSON.stringify(validBundle({ exportedAt: 'not-a-date' })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
  await expect(page.getByTestId('import-error')).toContainText('exportedAt');
});

test('story with missing required field rejects', async ({ page }) => {
  await openDataView(page);
  const badStory = { ...VALID_STORY };
  delete (badStory as Record<string, unknown>).title;
  const path = writeTmp('missing-title.starlog.json', JSON.stringify(validBundle({ stories: [badStory] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('story with star: null rejects', async ({ page }) => {
  await openDataView(page);
  const badStory = { ...VALID_STORY, star: null };
  const path = writeTmp('null-star.starlog.json', JSON.stringify(validBundle({ stories: [badStory] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('story with rank as string "999" rejects', async ({ page }) => {
  await openDataView(page);
  const badStory = { ...VALID_STORY, rank: '999' };
  const path = writeTmp('string-rank.starlog.json', JSON.stringify(validBundle({ stories: [badStory] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('story with rank out of range rejects', async ({ page }) => {
  await openDataView(page);
  const badStory = { ...VALID_STORY, rank: 6 };
  const path = writeTmp('rank-out-of-range.starlog.json', JSON.stringify(validBundle({ stories: [badStory] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('story with rank: null is accepted', async ({ page }) => {
  await openDataView(page);
  const story = { ...VALID_STORY, rank: null };
  const path = writeTmp('null-rank.starlog.json', JSON.stringify(validBundle({ stories: [story] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-confirm')).toBeVisible();
});

test('job profile with __proto__ key in competencyMap rejects', async ({ page }) => {
  await openDataView(page);
  // JSON.stringify silently drops __proto__ as a key, so we embed it via a raw JSON string
  const rawBundle = `{
    "version": 1,
    "exportedAt": "${new Date().toISOString()}",
    "appVersion": "0.0.0",
    "stories": [${JSON.stringify(VALID_STORY)}],
    "jobProfiles": [{
      "id": "p1", "company": "Acme", "role": "EM", "jobDescription": "",
      "extractedCompetencies": [], "competencyMap": {"__proto__": ["s1"]},
      "createdAt": "2024-01-01T00:00:00.000Z", "updatedAt": "2024-01-01T00:00:00.000Z",
      "archivedAt": null
    }]
  }`;
  const path = writeTmp('proto-pollution.starlog.json', rawBundle);
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('job profile with constructor key in competencyMap rejects', async ({ page }) => {
  await openDataView(page);
  // JSON.stringify drops __proto__ as a key, so we embed it via a raw JSON string
  const rawBundle = `{
    "version": 1,
    "exportedAt": "${new Date().toISOString()}",
    "appVersion": "0.0.0",
    "stories": [${JSON.stringify(VALID_STORY)}],
    "jobProfiles": [{
      "id": "p1", "company": "Acme", "role": "EM", "jobDescription": "",
      "extractedCompetencies": [], "competencyMap": {"constructor": ["s1"]},
      "createdAt": "2024-01-01T00:00:00.000Z", "updatedAt": "2024-01-01T00:00:00.000Z",
      "archivedAt": null
    }]
  }`;
  const path = writeTmp('constructor-pollution.starlog.json', rawBundle);
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('oversized stories array (> 10000) rejects', async ({ page }) => {
  await openDataView(page);
  // Build a minimal valid story and repeat it 10_001 times (unique ids)
  const manyStories = Array.from({ length: 10_001 }, (_, i) => ({ ...VALID_STORY, id: `s${i}` }));
  const path = writeTmp('too-many-stories.starlog.json', JSON.stringify(validBundle({ stories: manyStories })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
  await expect(page.getByTestId('import-error')).toContainText('too many stories');
});

test('10000 stories exactly is accepted', async ({ page }) => {
  await openDataView(page);
  const manyStories = Array.from({ length: 10_000 }, (_, i) => ({ ...VALID_STORY, id: `s${i}` }));
  const path = writeTmp('max-stories.starlog.json', JSON.stringify(validBundle({ stories: manyStories })));
  await importFile(page, path);
  await expect(page.getByTestId('import-confirm')).toBeVisible({ timeout: 15000 });
});

test('oversized jobProfiles array (> 1000) rejects', async ({ page }) => {
  await openDataView(page);
  const manyProfiles = Array.from({ length: 1_001 }, (_, i) => ({ ...VALID_JOB_PROFILE, id: `p${i}` }));
  const path = writeTmp('too-many-profiles.starlog.json', JSON.stringify(validBundle({ jobProfiles: manyProfiles })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
  await expect(page.getByTestId('import-error')).toContainText('too many job profiles');
});

test('story title exceeding 500 chars rejects', async ({ page }) => {
  await openDataView(page);
  const longTitle = 'A'.repeat(501);
  const badStory = { ...VALID_STORY, title: longTitle };
  const path = writeTmp('long-title.starlog.json', JSON.stringify(validBundle({ stories: [badStory] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('jobDescription exceeding 100000 chars rejects', async ({ page }) => {
  await openDataView(page);
  const longDesc = 'A'.repeat(100_001);
  const badProfile = { ...VALID_JOB_PROFILE, jobDescription: longDesc };
  const path = writeTmp('long-jd.starlog.json', JSON.stringify(validBundle({ jobProfiles: [badProfile] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('story with non-array action in star rejects', async ({ page }) => {
  await openDataView(page);
  const badStory = { ...VALID_STORY, star: { ...VALID_STORY.star, action: 'not an array' } };
  const path = writeTmp('action-not-array.starlog.json', JSON.stringify(validBundle({ stories: [badStory] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('story with missing quality object rejects', async ({ page }) => {
  await openDataView(page);
  const badStory = { ...VALID_STORY, quality: null };
  const path = writeTmp('null-quality.starlog.json', JSON.stringify(validBundle({ stories: [badStory] })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
});
