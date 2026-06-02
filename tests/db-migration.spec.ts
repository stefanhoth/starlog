/**
 * Tests for the DB v1 → v2 migration: rank:3 (pre-#103 auto-default) → null.
 *
 * Two paths are tested:
 *  1. localStorage seed → loadWithFallback → normalizeRanks in stories.ts init()
 *     (covers users whose data had not yet been migrated to IndexedDB)
 *  2. Direct IDB seed at v1 → app opens at v2 → upgrade callback in db.ts
 *     (covers users whose stories are already in IndexedDB)
 *
 * See: https://github.com/stefanhoth/starlog/issues/138
 */

import { test, expect } from '@playwright/test';
import type { Story } from '../src/lib/types';
import { clearStorage, readDB } from './helpers';

function makeStory(id: string, rank: number | null, title = 'Test Story'): Story {
  return {
    id,
    title,
    original_language: 'en',
    competency_tags: ['Leadership'],
    star: {
      situation: 'Situation',
      task: 'Task',
      action: ['Action step'],
      result: 'Result',
    },
    quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: '' },
    notes: '',
    rank,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Path 1: localStorage seed (normalizeRanks in stories.ts init())
// ---------------------------------------------------------------------------

test('migration: rank:3 from localStorage is reset to null on load', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);

  // Seed legacy stories via localStorage — this simulates the pre-#103 default.
  const stories = [
    makeStory('rank-3-a', 3, 'Old default A'),
    makeStory('rank-3-b', 3, 'Old default B'),
    makeStory('rank-5', 5, 'Deliberate 5-star'),
    makeStory('rank-1', 1, 'Deliberate 1-star'),
    makeStory('rank-null', null, 'Already unrated'),
  ];

  await page.evaluate((s) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
    localStorage.setItem('starlog_stories', JSON.stringify(s));
  }, stories);

  await page.reload();

  // Use expect.poll to handle the async IndexedDB write racing the read.
  const persisted = await expect.poll(
    () => readDB<Story[]>(page, 'stories', []),
    { timeout: 5000 }
  ).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'rank-3-a', rank: null }),
    expect.objectContaining({ id: 'rank-3-b', rank: null }),
  ]));

  const stored = await readDB<Story[]>(page, 'stories', []);
  // rank:3 → null
  expect(stored.find(s => s.id === 'rank-3-a')?.rank).toBeNull();
  expect(stored.find(s => s.id === 'rank-3-b')?.rank).toBeNull();
  // other ranks preserved
  expect(stored.find(s => s.id === 'rank-5')?.rank).toBe(5);
  expect(stored.find(s => s.id === 'rank-1')?.rank).toBe(1);
  expect(stored.find(s => s.id === 'rank-null')?.rank).toBeNull();
});

test('migration: stories without any rank:3 are not touched', async ({ page }) => {
  await page.goto('/');
  await clearStorage(page);

  const stories = [
    makeStory('s1', 4),
    makeStory('s2', 5),
    makeStory('s3', null),
  ];

  await page.evaluate((s) => {
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
    localStorage.setItem('starlog_stories', JSON.stringify(s));
  }, stories);

  await page.reload();

  // Allow time for init() to complete
  await expect.poll(
    () => readDB<Story[]>(page, 'stories', []),
    { timeout: 5000 }
  ).toHaveLength(3);

  const stored = await readDB<Story[]>(page, 'stories', []);
  expect(stored.find(s => s.id === 's1')?.rank).toBe(4);
  expect(stored.find(s => s.id === 's2')?.rank).toBe(5);
  expect(stored.find(s => s.id === 's3')?.rank).toBeNull();
});

// ---------------------------------------------------------------------------
// Path 2: IDB seed at v1 → upgrade to v2 (upgrade callback in db.ts)
// ---------------------------------------------------------------------------

test('migration: rank:3 in IDB v1 data store is reset to null on upgrade to v2', async ({ page }) => {
  // Intercept the first page load with a bare-bones stub so the app JS never runs
  // and no DB connection is opened. This lets us seed at v1 on the correct origin
  // without competing with the app's module-level _db singleton.
  await page.route('/', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><head></head><body></body></html>',
    })
  );
  await page.goto('/');
  await page.unroute('/'); // restore normal routing for the real load below

  // Seed at v1 with stories that have rank:3 (old pre-#103 auto-default).
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('starlog', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('data');
        req.result.createObjectStore('snapshots');
      };
      req.onsuccess = () => {
        const db = req.result;
        const stories = [
          { id: 'idb-rank-3', rank: 3, title: 'IDB legacy story' },
          { id: 'idb-rank-5', rank: 5, title: 'IDB deliberate 5-star' },
          { id: 'idb-rank-null', rank: null, title: 'IDB already unrated' },
        ];
        const blob = JSON.stringify(stories);
        const tx = db.transaction(['data', 'snapshots'], 'readwrite');
        tx.objectStore('data').put(blob, 'stories');
        tx.objectStore('snapshots').put(blob, 'stories');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(new Error('seed tx failed'));
      };
      req.onerror = () => reject(new Error('open v1 failed'));
    });

    // Auth so the app loads normally.
    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
  });

  // Navigate to the real app: getDB() opens at v2, versionchange upgrade runs, rank:3→null.
  await page.goto('/');

  // Wait for IDB to settle (stories.ts init() writes back after normalising).
  await expect.poll(
    () => readDB<Array<{ id: string; rank: number | null }>>(page, 'stories', []),
    { timeout: 5000 }
  ).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'idb-rank-3', rank: null }),
  ]));

  const all = await readDB<Array<{ id: string; rank: number | null }>>(page, 'stories', []);
  expect(all.find(s => s.id === 'idb-rank-3')?.rank).toBeNull();   // migrated
  expect(all.find(s => s.id === 'idb-rank-5')?.rank).toBe(5);      // preserved
  expect(all.find(s => s.id === 'idb-rank-null')?.rank).toBeNull(); // unchanged
});
