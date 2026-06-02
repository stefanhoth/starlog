import { writable, get } from 'svelte/store';
import type { Story, StoryDraft } from '../types';
import { storageError } from './storageError';
import { getDB, loadWithFallback, persistToDB } from '../db';

const DB_KEY = 'stories';
const LS_KEY = 'starlog_stories';

async function persist(stories: Story[]): Promise<void> {
  try {
    const db = await getDB();
    await persistToDB(db, DB_KEY, stories, LS_KEY);
  } catch (err) {
    storageError.set('Could not save data. Your changes may be lost after reload.');
    console.error('[starlog] stories persist failed:', err);
  }
}

function createStoriesStore() {
  const { subscribe, set, update } = writable<Story[]>([]);

  async function init(): Promise<void> {
    const stories = await loadWithFallback<Story[]>(DB_KEY, LS_KEY, []);
    set(stories);
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
