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

// ── Bulk Markdown export (issue #186) ────────────────────────────────────────

function makeBulkStory(overrides: Partial<Story> = {}): Story {
  return {
    id: `bulk-${Math.random().toString(36).slice(2)}`,
    title: 'Story',
    original_language: 'en',
    competency_tags: [],
    star: { situation: 'Situation', task: 'Task', action: ['Action step'], result: 'Result' },
    quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: 'private ai note' },
    notes: 'private personal note',
    rank: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function openDataWithStories(
  page: Page,
  stories: Story[],
  { apiKey = 'AIzaTestKey123' } = {}
) {
  await page.goto('/');
  await clearStorage(page);
  await page.evaluate(({ stories, apiKey }) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey, consentGiven: true }));
    localStorage.setItem('starlog_stories', JSON.stringify(stories));
  }, { stories, apiKey });
  await page.reload();
  await page.goto('/#/data');
}

test.describe('bulk export', () => {
  test('Export ▾ button is disabled when no stories exist', async ({ page }) => {
    await openDataWithStories(page, []);
    const btn = page.getByTestId('bulk-export-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('Export ▾ dropdown shows Download and Copy actions when stories exist', async ({ page }) => {
    await openDataWithStories(page, [makeBulkStory({ title: 'Alpha' })]);
    await page.getByTestId('bulk-export-btn').click();
    await expect(page.getByTestId('bulk-export-download-btn')).toBeVisible();
    await expect(page.getByTestId('bulk-export-copy-btn')).toBeVisible();
  });

  test('Download produces starlog-stories-YYYY-MM-DD.md with correct header', async ({ page }) => {
    const story = makeBulkStory({ title: 'Alpha', rank: 5 });
    await openDataWithStories(page, [story]);

    await page.getByTestId('bulk-export-btn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('bulk-export-download-btn').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^starlog-stories-\d{4}-\d{2}-\d{2}\.md$/);

    const path = await download.path();
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('# Story Library Export');
    expect(content).toContain('1 story ·');
    expect(content).toContain('# Alpha');
    expect(content).not.toContain('private personal note');
    expect(content).not.toContain('private ai note');
  });

  test('Copy to clipboard shows Copied N stories ✓ confirmation', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const stories = [
      makeBulkStory({ title: 'Alpha', rank: 5 }),
      makeBulkStory({ title: 'Beta', rank: 3 }),
    ];
    await openDataWithStories(page, stories);

    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();

    await expect(page.getByTestId('bulk-export-btn')).toHaveText(/Copied 2 stories ✓/);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('# Story Library Export');
    expect(clipboard).toContain('2 stories ·');
    expect(clipboard).not.toContain('private personal note');
    expect(clipboard).not.toContain('private ai note');
  });

  test('single story: header says "1 story" and no --- separator appears', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDataWithStories(page, [makeBulkStory({ title: 'Solo Story', rank: 2 })]);

    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();
    await expect(page.getByTestId('bulk-export-btn')).toHaveText(/Copied 1 story ✓/);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('1 story ·');
    expect(clipboard).not.toContain('\n---\n');
  });

  test('stories are sorted rank desc, then createdAt desc; null rank sorts last', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const stories = [
      makeBulkStory({ id: 'unranked', title: 'Unranked', rank: null, createdAt: '2024-01-03T00:00:00Z' }),
      makeBulkStory({ id: 'rank3',    title: 'Rank3',    rank: 3,    createdAt: '2024-01-01T00:00:00Z' }),
      makeBulkStory({ id: 'rank5',    title: 'Rank5',    rank: 5,    createdAt: '2024-01-02T00:00:00Z' }),
    ];
    await openDataWithStories(page, stories);

    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    const rank5Pos   = clipboard.indexOf('# Rank5');
    const rank3Pos   = clipboard.indexOf('# Rank3');
    const unrankedPos = clipboard.indexOf('# Unranked');
    expect(rank5Pos).toBeLessThan(rank3Pos);
    expect(rank3Pos).toBeLessThan(unrankedPos);
  });

  test('exactly N-1 separators for N stories', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const stories = [
      makeBulkStory({ title: 'A', rank: 3 }),
      makeBulkStory({ title: 'B', rank: 2 }),
      makeBulkStory({ title: 'C', rank: 1 }),
    ];
    await openDataWithStories(page, stories);

    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    const separators = (clipboard.match(/\n---\n/g) || []).length;
    expect(separators).toBe(2);
  });

  test('body containing literal --- does not corrupt story boundaries', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const tricky = makeBulkStory({
      title: 'Tricky',
      rank: 5,
      star: { situation: 'Before\n---\nAfter', task: 'Task', action: ['step'], result: 'Result' },
    });
    const other = makeBulkStory({ title: 'Other', rank: 3 });
    await openDataWithStories(page, [tricky, other]);

    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    const h1Matches = clipboard.match(/^# \S/gm) || [];
    // Header "# Story Library Export" + 2 story headings
    expect(h1Matches.length).toBe(3);
  });

  test('Download and Copy produce the same content', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const stories = [
      makeBulkStory({ title: 'Alpha', rank: 4 }),
      makeBulkStory({ title: 'Beta',  rank: 2 }),
    ];
    await openDataWithStories(page, stories);

    // Download
    await page.getByTestId('bulk-export-btn').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('bulk-export-download-btn').click();
    const download = await downloadPromise;
    const downloaded = await readFile(await download.path(), 'utf-8');

    // Copy — need to reopen the dropdown
    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();
    await expect(page.getByTestId('bulk-export-btn')).toHaveText(/Copied/);
    const copied = await page.evaluate(() => navigator.clipboard.readText());

    // Content must be identical except the date line can differ only if test crosses midnight
    expect(copied).toContain('# Alpha');
    expect(downloaded).toContain('# Alpha');
    // Strip the date line before comparing (download and copy both call storiesToMarkdown with new Date())
    const strip = (s: string) => s.replace(/\*\d+ stories? · exported .+\*/, '*DATE*');
    expect(strip(copied)).toBe(strip(downloaded));
  });

  test('bulk export works in manual mode (no API key)', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDataWithStories(page, [makeBulkStory({ title: 'Manual', rank: 1 })], { apiKey: '' });

    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();
    await expect(page.getByTestId('bulk-export-btn')).toHaveText(/Copied 1 story ✓/);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('# Manual');
  });

  test('Escape closes the dropdown and returns focus to the trigger', async ({ page }) => {
    await openDataWithStories(page, [makeBulkStory({ title: 'Alpha', rank: 1 })]);
    await page.getByTestId('bulk-export-btn').click();
    await expect(page.getByTestId('bulk-export-download-btn')).toBeVisible();
    // Use locator.press() to ensure focus is explicitly on the summary before firing
    // Escape — page.keyboard.press() targets ambient focus which differs across browsers.
    await page.getByTestId('bulk-export-btn').press('Escape');
    await expect(page.getByTestId('bulk-export-download-btn')).not.toBeVisible();
  });

  test('copy failure is announced to screen readers via aria-live', async ({ page }) => {
    // Force clipboard writes to reject so we exercise the error path. The shared
    // ExportMenu must announce failures, not just successes (the bulk view used to
    // announce success only).
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('blocked')) },
      });
    });
    await openDataWithStories(page, [makeBulkStory({ title: 'Alpha', rank: 1 })]);

    await page.getByTestId('bulk-export-btn').click();
    await page.getByTestId('bulk-export-copy-btn').click();

    await expect(page.getByTestId('bulk-export-btn')).toHaveText(/Copy failed/);
    await expect(page.locator('[aria-live="polite"]')).toContainText('Copy failed');
  });
});
