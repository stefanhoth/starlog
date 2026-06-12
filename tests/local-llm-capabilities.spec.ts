import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clearStorage } from './helpers';

/** Seeds minimal settings so the app skips onboarding and shows the main UI. */
async function seedSettings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('starlog', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('data')) db.createObjectStore('data');
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('data', 'readwrite');
        tx.objectStore('data').put(
          JSON.stringify({
            apiKey: 'AIzaTestKey123',
            consentGiven: true,
            geminiModel: 'gemini-2.5-flash',
            aiProvider: 'cloud',
          }),
          'settings',
        );
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/** Opens Settings and switches to the Local provider tab. */
async function openLocalTab(page: Page): Promise<void> {
  await page.getByTestId('settings-cog').click();
  await expect(page.getByTestId('provider-toggle')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('provider-local').click();
}

test.describe('LocalModelLoader capability states', () => {
  test('unsupported: shows browser teaser when WebGPU is absent', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true });
      delete (window.WebAssembly as Record<string, unknown>).Suspending;
    });

    await page.goto('/');
    await clearStorage(page);
    await seedSettings(page);
    await page.reload();

    await openLocalTab(page);

    await expect(page.getByLabel('Local AI unavailable')).toBeVisible();
    await expect(page.getByText(/Chrome 137\+/)).toBeVisible();
    await expect(page.getByText(/Edge 137\+/)).toBeVisible();
  });

  test('needs-flag: shows flag instructions when WebGPU present but JSPI absent', async ({ page }) => {
    await page.addInitScript(() => {
      if (!('gpu' in navigator)) {
        Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
      }
      delete (window.WebAssembly as Record<string, unknown>).Suspending;
    });

    await page.goto('/');
    await clearStorage(page);
    await seedSettings(page);
    await page.reload();

    await openLocalTab(page);

    await expect(page.getByLabel('Local AI needs flag')).toBeVisible();
    await expect(page.getByText(/enable-experimental-webassembly-jspi/)).toBeVisible();
    await expect(page.getByTestId('local-recheck')).toBeVisible();
  });

  test('ready: shows model loader when both WebGPU and JSPI are present', async ({ page }) => {
    await page.addInitScript(() => {
      if (!('gpu' in navigator)) {
        Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
      }
      (window.WebAssembly as Record<string, unknown>).Suspending = function () {};
    });

    await page.goto('/');
    await clearStorage(page);
    await seedSettings(page);
    await page.reload();

    await openLocalTab(page);

    await expect(page.getByTestId('local-load-url')).toBeVisible();
    await expect(page.getByLabel('Local AI unavailable')).not.toBeVisible();
    await expect(page.getByLabel('Local AI needs flag')).not.toBeVisible();
  });

  test('recheck: injecting JSPI after load updates state without page reload', async ({ page }) => {
    await page.addInitScript(() => {
      if (!('gpu' in navigator)) {
        Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
      }
      delete (window.WebAssembly as Record<string, unknown>).Suspending;
    });

    await page.goto('/');
    await clearStorage(page);
    await seedSettings(page);
    await page.reload();

    await openLocalTab(page);
    await expect(page.getByLabel('Local AI needs flag')).toBeVisible();

    // Simulate JSPI becoming available (e.g. after flag change + relaunch), then click Recheck
    await page.evaluate(() => {
      (window.WebAssembly as Record<string, unknown>).Suspending = function () {};
    });
    await page.getByTestId('local-recheck').click();

    await expect(page.getByLabel('Local AI needs flag')).not.toBeVisible();
    await expect(page.getByTestId('local-load-url')).toBeVisible();
  });
});
