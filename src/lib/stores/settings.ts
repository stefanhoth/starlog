import { writable } from 'svelte/store';
import type { Settings } from '../types';
import { storageError } from './storageError';

const KEY = 'starlog_settings';

const defaults: Settings = { apiKey: '', consentGiven: false, geminiModel: 'gemini-3.5-flash' };

let loadSucceeded = false;

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    loadSucceeded = true;
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    loadSucceeded = false;
    return { ...defaults };
  }
}

function persist(value: Settings) {
  if (!loadSucceeded) {
    console.warn('[starlog] Skipping persist: initial load did not succeed. Data protected from overwrite.');
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (err) {
    const msg = err instanceof Error && err.name === 'QuotaExceededError'
      ? 'Storage is full. Your latest changes could not be saved. Free up space or export a backup.'
      : 'Could not save data. Your changes may be lost after reload.';
    storageError.set(msg);
    console.error('[starlog] persist failed:', err);
  }
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(load());

  return {
    subscribe,
    update(fn: (s: Settings) => Settings) {
      update(s => {
        const next = fn(s);
        persist(next);
        return next;
      });
    },
    set(value: Settings) {
      persist(value);
      set(value);
    },
    reset() {
      localStorage.removeItem(KEY);
      set({ ...defaults });
    },
  };
}

export const settingsStore = createSettingsStore();
