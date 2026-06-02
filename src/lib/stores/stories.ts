import { writable, get } from 'svelte/store';
import type { Story, StoryDraft } from '../types';
import { storageError } from './storageError';
import { getDB, loadWithFallback, persistToDB } from '../db';

const DB_KEY = 'stories';
const LS_KEY = 'starlog_stories';

/**
 * Resets rank === 3 (the pre-#103 auto-default) to null (unrated).
 *
 * The IDB upgrade in db.ts handles this for stories already in IndexedDB.
 * This function covers the edge case where data arrives via localStorage
 * (the one-time migration path in loadWithFallback) and never passed through
 * the IDB versionchange transaction.
 */
export function normalizeRanks(stories: Story[]): Story[] {
  return stories.map(s => (s.rank === 3 ? { ...s, rank: null } : s));
}

async function persist(stories: Story[]): Promise<void> {
  try {
    const db = await getDB();
    await persistToDB(db, DB_KEY, stories);
  } catch (err) {
    storageError.set('Could not save data. Your changes may be lost after reload.');
    console.error('[starlog] stories persist failed:', err);
  }
}

function createStoriesStore() {
  const { subscribe, set, update } = writable<Story[]>([]);

  async function init(): Promise<void> {
    const raw = await loadWithFallback<Story[]>(DB_KEY, LS_KEY, []);
    // Belt-and-suspenders normalisation: catches any rank:3 values that arrived
    // via the localStorage fallback path and therefore bypassed the IDB upgrade.
    const hasLegacyRank = raw.some(s => s.rank === 3);
    const stories = hasLegacyRank ? normalizeRanks(raw) : raw;
    set(stories);
    if (hasLegacyRank) {
      // Persist the normalised data so subsequent loads don't need to re-normalise.
      await persist(stories);
    }
  }

  return {
    subscribe,
    init,
    addStory(draft: StoryDraft, rank: number | null = null): Story {
      const story: Story = {
        ...draft,
        id: crypto.randomUUID(),
        notes: '',
        rank,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      update(stories => {
        const next = [story, ...stories];
        persist(next);
        return next;
      });
      return story;
    },
    updateStory(id: string, changes: Partial<Story>) {
      update(stories => {
        const next = stories.map(s =>
          s.id === id ? { ...s, ...changes, updatedAt: new Date().toISOString() } : s
        );
        persist(next);
        return next;
      });
    },
    deleteStory(id: string) {
      update(stories => {
        const next = stories.filter(s => s.id !== id);
        persist(next);
        return next;
      });
    },
    getById(id: string): Story | undefined {
      return get(this).find(s => s.id === id);
    },
    reset() {
      set([]);
      persist([]);
    },
    restore(stories: Story[]) {
      set(stories);
      persist(stories);
    },
  };
}

export const storiesStore = createStoriesStore();
