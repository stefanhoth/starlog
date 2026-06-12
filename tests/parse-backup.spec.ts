/**
 * E2E smoke tests for the backup import UI.
 *
 * These verify that the file-upload flow wires up correctly: the file picker
 * triggers parseBackupJson, errors surface in the import-error element, and a
 * valid bundle surfaces the import-confirm dialog.
 *
 * Pure validation logic (version, field shapes, size caps, prototype-pollution)
 * is covered exhaustively in src/lib/backup.test.ts (Vitest, no browser).
 * Only add tests here when you need a real browser, real IDB, or the full
 * multi-view user flow — not for every input permutation.
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

test('invalid bundle surfaces error in the UI', async ({ page }) => {
  await openDataView(page);
  const path = writeTmp('future.starlog.json', JSON.stringify(validBundle({ version: 99 })));
  await importFile(page, path);
  await expect(page.getByTestId('import-error')).toBeVisible();
  await expect(page.getByTestId('import-error')).toContainText('newer version of StarLog');
});
