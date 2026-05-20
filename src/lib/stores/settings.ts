import { writable } from 'svelte/store';
import type { Settings } from '../types';

const KEY = 'starlog_settings';

const defaults: Settings = { apiKey: '', consentGiven: false };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(load());

  return {
    subscribe,
    update(fn: (s: Settings) => Settings) {
      update(s => {
        const next = fn(s);
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      });
    },
    set(value: Settings) {
      localStorage.setItem(KEY, JSON.stringify(value));
      set(value);
    },
  };
}

export const settingsStore = createSettingsStore();
