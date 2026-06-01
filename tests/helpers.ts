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
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>(resolve => {
      const req = indexedDB.open('starlog', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('data')) { resolve(); return; }
        const tx = db.transaction(['data', 'snapshots'], 'readwrite');
        tx.objectStore('data').clear();
        tx.objectStore('snapshots').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
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
      const req = indexedDB.open('starlog', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('data')) { resolve(fallback); return; }
        const getReq = db.transaction('data', 'readonly').objectStore('data').get(key);
        getReq.onsuccess = () => {
          const raw = getReq.result as string | undefined;
          resolve(raw ? JSON.parse(raw) : fallback);
        };
        getReq.onerror = () => resolve(fallback);
      };
      req.onerror = () => resolve(fallback);
    });
  }, { key, fallback } as { key: string; fallback: T });
}
