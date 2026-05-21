import { writable } from 'svelte/store';
import type { JobProfile } from '../types';

const KEY = 'starlog_job_profiles';

function load(): JobProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(profiles: JobProfile[]) {
  localStorage.setItem(KEY, JSON.stringify(profiles));
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
      persist(profiles);
      set(profiles);
    },
  };
}

export const jobProfilesStore = createJobProfilesStore();
