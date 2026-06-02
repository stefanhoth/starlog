/**
 * Tests for the DB v1 → v2 migration: rank:3 (pre-#103 auto-default) → null.
 *
 * Scope: users who already had data in IndexedDB at v1.
 * The upgrade callback in db.ts runs exactly once (IDB version gate) and
 * normalises rank:3 → null in the 'data' and 'snapshots' stores.
 *
 * The localStorage → IDB migration (loadWithFallback) is a separate concern
 * and is not part of this ticket.
 *
 * See: https://github.com/stefanhoth/starlog/issues/138
 */

import { test, expect } from '@playwright/test';
import { readDB } from './helpers';

/**
 * Navigates to a stub page on the app's origin (no app JS runs, so no DB
 * connection is made). Lets us seed IDB at v1 before the real app opens at v2.
 */
async function gotoStub(page: import('@playwright/test').Page) {
  await page.route('/', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><head></head><body></body></html>',
    })
  );
  await page.goto('/');
  await page.unroute('/');
}

// ---------------------------------------------------------------------------
// IDB seed at v1 → app opens at v2 → upgrade migrates IDB stores
// ---------------------------------------------------------------------------

test('migration: rank:3 in IDB v1 data store is reset to null on upgrade to v2', async ({ page }) => {
  // Stub page → no DB connection → seed at v1 → real app opens at v2 → upgrade
  await gotoStub(page);

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

    localStorage.setItem('starlog_settings', JSON.stringify({ apiKey: 'AIzaTestKey123', consentGiven: true }));
  });

  // Real app loads at v2 → versionchange upgrade runs → migrates IDB rank:3 → null
  await page.goto('/');

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
