import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Fulfills ALL Gemini API calls with a valid 200 response containing `body`.
 * Call this BEFORE filling the API key so the auto-validation call is intercepted.
 *
 * Tests that need a specific Gemini response for extraction should call their own
 * page.route() AFTER this — Playwright's LIFO routing means the later route wins.
 */
export async function mockGeminiOk(page: Page, responseText = 'ok'): Promise<void> {
  await page.route('**/generativelanguage.googleapis.com/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: responseText }] } }],
      }),
    })
  );
}

/**
 * Complete the onboarding form end-to-end.
 * Assumes Gemini is already mocked (call mockGeminiOk first).
 */
export async function completeOnboarding(page: Page, key = 'AIzaTestKey123'): Promise<void> {
  await page.getByTestId('api-key-input').fill(key);
  await expect(page.getByTestId('verify-success')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('onboarding-submit').click();
}

/**
 * Clears all app storage: IndexedDB data + snapshots stores AND localStorage/sessionStorage.
 * Use this instead of `localStorage.clear()` to ensure full test isolation.
 *
 * Opens at the current DB version (2) so it works alongside the app's v2 schema.
 * Creates stores via onupgradeneeded in case the DB hasn't been initialised yet
 * (e.g. in migration tests that navigate to a blank stub first).
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>(resolve => {
      const req = indexedDB.open('starlog', 2);
      req.onupgradeneeded = () => {
        // Handles fresh browser contexts where the DB has never been opened.
        const db = req.result;
        if (!db.objectStoreNames.contains('data')) db.createObjectStore('data');
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots');
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('data')) { db.close(); resolve(); return; }
        const tx = db.transaction(['data', 'snapshots'], 'readwrite');
        tx.objectStore('data').clear();
        tx.objectStore('snapshots').clear();
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

/**
 * Reads a value from the IndexedDB 'data' store.
 * Key is the store key (e.g. 'stories', 'jobProfiles', 'settings').
 */
export async function readDB<T>(page: Page, key: string, fallback: T): Promise<T> {
  return page.evaluate(async ({ key, fallback }) => {
    return new Promise<typeof fallback>(resolve => {
      const req = indexedDB.open('starlog', 2);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('data')) { db.close(); resolve(fallback); return; }
        const getReq = db.transaction('data', 'readonly').objectStore('data').get(key);
        getReq.onsuccess = () => {
          const raw = getReq.result as string | undefined;
          db.close();
          resolve(raw ? JSON.parse(raw) : fallback);
        };
        getReq.onerror = () => { db.close(); resolve(fallback); };
      };
      req.onerror = () => resolve(fallback);
    });
  }, { key, fallback } as { key: string; fallback: T });
}
