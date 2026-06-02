import { writable } from 'svelte/store';
import type { Settings } from '../types';
import { storageError } from './storageError';
import { getDB, loadWithFallback, persistToDB } from '../db';

const DB_KEY = 'settings';
const LS_KEY = 'starlog_settings';

export const defaults: Settings = { apiKey: '', consentGiven: false, geminiModel: 'gemini-3.5-flash' };

async function persist(value: Settings): Promise<void> {
  try {
    const db = await getDB();
    await persistToDB(db, DB_KEY, value);
  } catch (err) {
    storageError.set('Could not save settings. Your changes may be lost after reload.');
    console.error('[starlog] settings persist failed:', err);
  }
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>({ ...defaults });

  async function init(): Promise<void> {
    const stored = await loadWithFallback<Settings | null>(DB_KEY, LS_KEY, null, { removeAfterMigration: true });
    set(stored ? { ...defaults, ...stored } : { ...defaults });
  }

  return {
    subscribe,
    init,
    update(fn: (s: Settings) => Settings) {
      update(s => {
        const next = fn(s);
        persist(next);
        return next;
      });
    },
    set(value: Settings): Promise<void> {
      set(value);
      return persist(value);
    },
    reset() {
      set({ ...defaults });
      persist({ ...defaults });
    },
  };
}

export const settingsStore = createSettingsStore();
