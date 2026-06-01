import { test, expect } from '@playwright/test';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';

async function openDataView(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey', consentGiven: true }));
  });
  await page.reload();
  await page.goto('/#/data');
}

test.beforeEach(async ({ page }) => {
  const { clearStorage } = await import('./helpers');
  await page.goto('/');
  await clearStorage(page);
});

test('Data view shows Export and Import controls, not "Coming soon"', async ({ page }) => {
  await openDataView(page);
  await expect(page.getByText('Coming soon')).not.toBeVisible();
  await expect(page.getByTestId('export-btn')).toBeVisible();
  await expect(page.getByTestId('import-label')).toBeVisible();
});

test('Export button triggers a download', async ({ page }) => {
  await openDataView(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/starlog-backup.*\.starlog\.json/);
});

test('Importing invalid JSON shows an error message', async ({ page }) => {
  await openDataView(page);
  const tmpFile = join(tmpdir(), 'bad.json');
  writeFileSync(tmpFile, 'not valid json');
  await page.getByTestId('import-input').setInputFiles(tmpFile);
  await expect(page.getByTestId('import-error')).toBeVisible();
});

test('Importing a valid backup shows confirmation dialog with counts', async ({ page }) => {
  await openDataView(page);
  const bundle = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '0.0.0',
    stories: [
      { id: 's1', title: 'A story', competency_tags: [], star: {}, quality: {}, createdAt: '', updatedAt: '', original_language: 'en', notes: '', rank: 3 },
    ],
    jobProfiles: [
      { id: 'p1', company: 'Acme', role: 'EM', jobDescription: '', extractedCompetencies: [], competencyMap: {}, createdAt: '', updatedAt: '' },
    ],
  });
  const tmpFile = join(tmpdir(), 'backup.starlog.json');
  writeFileSync(tmpFile, bundle);
  await page.getByTestId('import-input').setInputFiles(tmpFile);
  await expect(page.getByTestId('import-confirm')).toBeVisible();
  await expect(page.getByTestId('import-confirm')).toContainText('1 story');
  await expect(page.getByTestId('import-confirm')).toContainText('1 job profile');
});

test('Cancelling import dismisses the confirmation', async ({ page }) => {
  await openDataView(page);
  const bundle = JSON.stringify({
    version: 1, exportedAt: new Date().toISOString(), appVersion: '0.0.0',
    stories: [{ id: 's1', title: 'T', competency_tags: [], star: {}, quality: {}, createdAt: '', updatedAt: '', original_language: 'en', notes: '', rank: 3 }],
    jobProfiles: [],
  });
  const tmpFile = join(tmpdir(), 'cancel.starlog.json');
  writeFileSync(tmpFile, bundle);
  await page.getByTestId('import-input').setInputFiles(tmpFile);
  await expect(page.getByTestId('import-confirm')).toBeVisible();
  await page.getByTestId('import-cancel-btn').click();
  await expect(page.getByTestId('import-confirm')).not.toBeVisible();
});

test('Settings screen shows data hint, not export/import buttons', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey', consentGiven: true }));
  });
  await page.reload();
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) })
  );
  await page.getByTestId('settings-cog').click();
  await expect(page.getByTestId('export-btn')).not.toBeVisible();
  await expect(page.getByTestId('data-hint')).toBeVisible();
});

test('Data hint in settings navigates to Data view', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey', consentGiven: true }));
  });
  await page.reload();
  await page.getByTestId('settings-cog').click();
  await page.getByTestId('data-hint').click();
  await expect(page.getByTestId('export-btn')).toBeVisible();
});
