import { writable } from 'svelte/store';
import type { JobProfile } from '../types';
import { storageError } from './storageError';
import { getDB, loadWithFallback, persistToDB } from '../db';

const DB_KEY = 'jobProfiles';
const LS_KEY = 'starlog_job_profiles';

async function persist(profiles: JobProfile[]): Promise<void> {
  try {
    const db = await getDB();
    await persistToDB(db, DB_KEY, profiles);
  } catch (err) {
    storageError.set('Could not save data. Your changes may be lost after reload.');
    console.error('[starlog] jobProfiles persist failed:', err);
  }
}

function createJobProfilesStore() {
  const { subscribe, set, update } = writable<JobProfile[]>([]);

  async function init(): Promise<void> {
    const profiles = await loadWithFallback<JobProfile[]>(DB_KEY, LS_KEY, []);
    set(profiles);
  }

  return {
    subscribe,
    init,
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
      set([]);
      persist([]);
    },
    restore(profiles: JobProfile[]) {
      set(profiles);
      persist(profiles);
    },
  };
}

export const jobProfilesStore = createJobProfilesStore();
