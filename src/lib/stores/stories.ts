import { writable, get } from 'svelte/store';
import type { Story, StoryDraft } from '../types';
import { storageError } from './storageError';

const KEY = 'starlog_stories';

// Tracks whether the initial load from localStorage succeeded.
// If it failed (exception), we must NOT write back — that would overwrite
// potentially-intact data on disk with an empty in-memory state.
let loadSucceeded = false;

function load(): Story[] {
  try {
    const raw = localStorage.getItem(KEY);
    loadSucceeded = true;
    return raw ? JSON.parse(raw) : [];
  } catch {
    loadSucceeded = false;
    return [];
  }
}

function persist(stories: Story[]) {
  if (!loadSucceeded) {
    console.warn('[starlog] Skipping persist: initial load did not succeed. Data protected from overwrite.');
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(stories));
  } catch (err) {
    const msg = err instanceof Error && err.name === 'QuotaExceededError'
      ? 'Storage is full. Your latest changes could not be saved. Free up space or export a backup.'
      : 'Could not save data. Your changes may be lost after reload.';
    storageError.set(msg);
    console.error('[starlog] persist failed:', err);
  }
}

function createStoriesStore() {
  const { subscribe, set, update } = writable<Story[]>(load());

  return {
    subscribe,
    addStory(draft: StoryDraft, rank = 3): Story {
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
      localStorage.removeItem(KEY);
      set([]);
    },
    restore(stories: Story[]) {
      loadSucceeded = true;
      persist(stories);
      set(stories);
    },
  };
}

export const storiesStore = createStoriesStore();
