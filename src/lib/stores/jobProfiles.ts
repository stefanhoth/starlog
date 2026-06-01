import { writable } from 'svelte/store';
import type { JobProfile } from '../types';
import { storageError } from './storageError';

const KEY = 'starlog_job_profiles';

let loadSucceeded = false;

function load(): JobProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    loadSucceeded = true;
    return raw ? JSON.parse(raw) : [];
  } catch {
    loadSucceeded = false;
    return [];
  }
}

function persist(profiles: JobProfile[]) {
  if (!loadSucceeded) {
    console.warn('[starlog] Skipping persist: initial load did not succeed. Data protected from overwrite.');
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(profiles));
  } catch (err) {
    const msg = err instanceof Error && err.name === 'QuotaExceededError'
      ? 'Storage is full. Your latest changes could not be saved. Free up space or export a backup.'
      : 'Could not save data. Your changes may be lost after reload.';
    storageError.set(msg);
    console.error('[starlog] persist failed:', err);
  }
}

function createJobProfilesStore() {
  const { subscribe, set, update } = writable<JobProfile[]>(load());

  return {
    subscribe,
    addJobProfile(data: Omit<JobProfile, 'id' | 'createdAt' | 'updatedAt'>): JobProfile {
      const profile: JobProfile = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      update(profiles => {
        const next = [profile, ...profiles];
        persist(next);
        return next;
      });
      return profile;
    },
    updateJobProfile(id: string, changes: Partial<JobProfile>) {
      update(profiles => {
        const next = profiles.map(p =>
          p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p
        );
        persist(next);
        return next;
      });
    },
    deleteJobProfile(id: string) {
      update(profiles => {
        const next = profiles.filter(p => p.id !== id);
        persist(next);
        return next;
      });
    },
    reset() {
      localStorage.removeItem(KEY);
      set([]);
    },
    restore(profiles: JobProfile[]) {
      loadSucceeded = true;
      persist(profiles);
      set(profiles);
    },
  };
}

export const jobProfilesStore = createJobProfilesStore();
