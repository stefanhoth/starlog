import { writable, get } from 'svelte/store';
import type { Story, StoryDraft } from '../types';

const KEY = 'starlog_stories';

function load(): Story[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(stories: Story[]) {
  localStorage.setItem(KEY, JSON.stringify(stories));
}

function createStoriesStore() {
  const { subscribe, set, update } = writable<Story[]>(load());

  return {
    subscribe,
    addStory(draft: StoryDraft): Story {
      const story: Story = {
        ...draft,
        id: crypto.randomUUID(),
        notes: '',
        rank: 3,
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
  };
}

export const storiesStore = createStoriesStore();
