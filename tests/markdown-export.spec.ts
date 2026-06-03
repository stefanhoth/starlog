/**
 * Unit-style tests for the single-story Markdown export (#185).
 *
 * These exercise storyToMarkdown() / slugifyTitle() / downloadMarkdown() through
 * the Story Detail export UI — reading the clipboard and intercepting the file
 * download. This is the closest we can get to unit-testing the helpers without
 * introducing a second test runner (mirrors tests/parse-backup.spec.ts).
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'fs/promises';
import type { Story } from '../src/lib/types';
import { clearStorage } from './helpers';

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'markdown-export-test',
    title: 'Webpack Migration Story',
    original_language: 'en',
    competency_tags: ['Technical Depth', 'Leadership'],
    star: {
      situation: 'Original situation',
      task: 'Original task',
      action: ['Step one', 'Step two'],
      result: 'Original result',
    },
    // notes + quality must NOT appear in the exported Markdown
    quality: { situation: 'high', task: 'medium', action: 'high', result: 'low', notes: 'private review note' },
    notes: 'private personal note',
    rank: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Seeds a story + settings, then opens its detail view. apiKey defaults to a value;
 *  pass `apiKey: ''` to simulate manual mode (no Gemini configured). */
async function openDetail(page: Page, story: Story, { apiKey = 'AIzaTestKey123' } = {}) {
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate(({ s, apiKey }) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey, consentGiven: true }));
    localStorage.setItem('starlog_stories', JSON.stringify([s]));
    sessionStorage.setItem('starlog_active_story', s.id);
  }, { s: story, apiKey });
  await page.reload();
  await page.getByTestId('nav-story-bank').click();
  await expect(page.getByTestId('story-bank-view')).toBeVisible();
  await page.getByTestId('story-row').first().click();
  await expect(page.getByTestId('story-detail-view')).toBeVisible({ timeout: 5000 });
}

const EXPECTED_MARKDOWN =
  '# Webpack Migration Story\n\n' +
  '**Tags:** Technical Depth · Leadership\n\n' +
  '## Situation\nOriginal situation\n\n' +
  '## Task\nOriginal task\n\n' +
  '## Action\n- Step one\n- Step two\n\n' +
  '## Result\nOriginal result\n';

test('export dropdown exposes Copy and Download actions', async ({ page }) => {
  await openDetail(page, makeStory());
  await page.getByTestId('export-btn').click();
  await expect(page.getByTestId('export-copy-btn')).toBeVisible();
  await expect(page.getByTestId('export-download-btn')).toBeVisible();
});

test('Copy to clipboard yields the exact Markdown, shows confirmation, does not navigate', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDetail(page, makeStory());

  await page.getByTestId('export-btn').click();
  await page.getByTestId('export-copy-btn').click();

  // Inline "Copied ✓" confirmation appears and we stay on the detail view.
  await expect(page.getByTestId('export-btn')).toHaveText(/Copied ✓/);
  await expect(page.getByTestId('story-detail-view')).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(EXPECTED_MARKDOWN);
  // Internal metadata must be excluded.
  expect(clipboard).not.toContain('private personal note');
  expect(clipboard).not.toContain('private review note');
});

test('Download produces a slugified {title}-star.md with the expected content', async ({ page }) => {
  await openDetail(page, makeStory());

  await page.getByTestId('export-btn').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-download-btn').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('webpack-migration-story-star.md');

  const path = await download.path();
  const content = await readFile(path, 'utf-8');
  expect(content).toBe(EXPECTED_MARKDOWN);

  // No navigation away from the detail view.
  await expect(page.getByTestId('story-detail-view')).toBeVisible();
});

test('Tags line is omitted when the story has no competency tags', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDetail(page, makeStory({ competency_tags: [] }));

  await page.getByTestId('export-btn').click();
  await page.getByTestId('export-copy-btn').click();
  await expect(page.getByTestId('export-btn')).toHaveText(/Copied ✓/);

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).not.toContain('**Tags:**');
  expect(clipboard.startsWith('# Webpack Migration Story\n\n## Situation')).toBe(true);
});

test('filename slug accent-folds, strips punctuation, and lowercases the title', async ({ page }) => {
  await openDetail(page, makeStory({ title: 'Léd Bäckend: Migration! (2024)' }));

  await page.getByTestId('export-btn').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-download-btn').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('led-backend-migration-2024-star.md');
});

test('export works in manual mode without an API key', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDetail(page, makeStory(), { apiKey: '' });

  await page.getByTestId('export-btn').click();
  await page.getByTestId('export-copy-btn').click();
  await expect(page.getByTestId('export-btn')).toHaveText(/Copied ✓/);

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(EXPECTED_MARKDOWN);
});
