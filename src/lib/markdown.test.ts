import { describe, it, expect } from 'vitest';
import { slugifyTitle, storyToMarkdown, storiesToMarkdown } from './markdown';
import type { Story } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'test-id',
    title: 'Webpack Migration Story',
    original_language: 'en',
    competency_tags: ['Technical Depth', 'Leadership'],
    star: {
      situation: 'Original situation',
      task: 'Original task',
      action: ['Step one', 'Step two'],
      result: 'Original result',
    },
    quality: { situation: 'high', task: 'medium', action: 'high', result: 'low', notes: 'private ai note' },
    notes: 'private personal note',
    rank: 3,
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const EXPECTED_MARKDOWN =
  '# Webpack Migration Story\n\n' +
  '**Tags:** Technical Depth · Leadership\n\n' +
  '## Situation\nOriginal situation\n\n' +
  '## Task\nOriginal task\n\n' +
  '## Action\n- Step one\n- Step two\n\n' +
  '## Result\nOriginal result\n';

// ── slugifyTitle ──────────────────────────────────────────────────────────────

describe('slugifyTitle', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugifyTitle('Hello World')).toBe('hello-world');
  });

  it('accent-folds and strips punctuation', () => {
    expect(slugifyTitle('Léd Bäckend: Migration! (2024)')).toBe('led-backend-migration-2024');
  });

  it('collapses consecutive hyphens', () => {
    expect(slugifyTitle('Hello   World---Test')).toBe('hello-world-test');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugifyTitle('---hello---')).toBe('hello');
  });

  it('caps at 60 characters', () => {
    const long = 'a'.repeat(80);
    expect(slugifyTitle(long)).toHaveLength(60);
  });

  it('falls back to "untitled-story" for empty/non-alpha input', () => {
    expect(slugifyTitle('')).toBe('untitled-story');
    expect(slugifyTitle('---')).toBe('untitled-story');
  });
});

// ── storyToMarkdown ───────────────────────────────────────────────────────────

describe('storyToMarkdown', () => {
  it('produces the exact expected Markdown for a full story', () => {
    expect(storyToMarkdown(makeStory())).toBe(EXPECTED_MARKDOWN);
  });

  it('omits the Tags line when competency_tags is empty', () => {
    const md = storyToMarkdown(makeStory({ competency_tags: [] }));
    expect(md).not.toContain('**Tags:**');
    expect(md.startsWith('# Webpack Migration Story\n\n## Situation')).toBe(true);
  });

  it('omits sections that are empty strings', () => {
    const md = storyToMarkdown(makeStory({ star: { situation: '', task: 'Task', action: [], result: '' } }));
    expect(md).not.toContain('## Situation');
    expect(md).not.toContain('## Action');
    expect(md).not.toContain('## Result');
    expect(md).toContain('## Task');
  });

  it('excludes private notes field', () => {
    const md = storyToMarkdown(makeStory({ notes: 'secret' }));
    expect(md).not.toContain('secret');
  });

  it('excludes AI quality metadata', () => {
    const md = storyToMarkdown(makeStory());
    expect(md).not.toContain('private ai note');
    expect(md).not.toContain('high');  // quality level strings
  });

  it('falls back to "Untitled Story" when title is empty', () => {
    const md = storyToMarkdown(makeStory({ title: '' }));
    expect(md.startsWith('# Untitled Story\n')).toBe(true);
  });

  it('ends with exactly one newline', () => {
    const md = storyToMarkdown(makeStory());
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });
});

// ── storiesToMarkdown ─────────────────────────────────────────────────────────

describe('storiesToMarkdown', () => {
  const FIXED_DATE = new Date('2026-06-01T12:00:00Z');

  it('returns empty string for an empty library', () => {
    expect(storiesToMarkdown([])).toBe('');
  });

  it('includes the # Story Library Export header', () => {
    const out = storiesToMarkdown([makeStory()], FIXED_DATE);
    expect(out).toContain('# Story Library Export');
  });

  it('uses singular "story" for a single story', () => {
    const out = storiesToMarkdown([makeStory()], FIXED_DATE);
    expect(out).toContain('*1 story ·');
  });

  it('uses plural "stories" for multiple stories', () => {
    const out = storiesToMarkdown([makeStory(), makeStory({ id: '2', title: 'B' })], FIXED_DATE);
    expect(out).toContain('*2 stories ·');
  });

  it('produces no --- separator for a single story', () => {
    const out = storiesToMarkdown([makeStory()], FIXED_DATE);
    expect(out).not.toContain('\n---\n');
  });

  it('produces exactly N-1 separators for N stories', () => {
    const stories = [
      makeStory({ id: '1', title: 'A', rank: 3 }),
      makeStory({ id: '2', title: 'B', rank: 2 }),
      makeStory({ id: '3', title: 'C', rank: 1 }),
    ];
    const out = storiesToMarkdown(stories, FIXED_DATE);
    expect((out.match(/\n---\n/g) || []).length).toBe(2);
  });

  it('does not mutate the input array', () => {
    const stories = [
      makeStory({ id: '1', rank: 1 }),
      makeStory({ id: '2', rank: 5 }),
    ];
    const originalOrder = stories.map(s => s.id);
    storiesToMarkdown(stories, FIXED_DATE);
    expect(stories.map(s => s.id)).toEqual(originalOrder);
  });

  it('sorts rank desc, createdAt desc tiebreak, null rank last', () => {
    const stories = [
      makeStory({ id: 'unranked', title: 'Unranked', rank: null,  createdAt: '2024-01-03T00:00:00Z' }),
      makeStory({ id: 'rank3',    title: 'Rank3',    rank: 3,     createdAt: '2024-01-01T00:00:00Z' }),
      makeStory({ id: 'rank5',    title: 'Rank5',    rank: 5,     createdAt: '2024-01-02T00:00:00Z' }),
    ];
    const out = storiesToMarkdown(stories, FIXED_DATE);
    expect(out.indexOf('# Rank5')).toBeLessThan(out.indexOf('# Rank3'));
    expect(out.indexOf('# Rank3')).toBeLessThan(out.indexOf('# Unranked'));
  });

  it('breaks rank ties by createdAt desc (newer first)', () => {
    const stories = [
      makeStory({ id: 'older', title: 'Older', rank: 3, createdAt: '2024-01-01T00:00:00Z' }),
      makeStory({ id: 'newer', title: 'Newer', rank: 3, createdAt: '2024-02-01T00:00:00Z' }),
    ];
    const out = storiesToMarkdown(stories, FIXED_DATE);
    expect(out.indexOf('# Newer')).toBeLessThan(out.indexOf('# Older'));
  });

  it('sorts multiple null-rank stories by createdAt desc among themselves', () => {
    const stories = [
      makeStory({ id: 'old-unranked',  title: 'OldUnranked',  rank: null, createdAt: '2024-01-01T00:00:00Z' }),
      makeStory({ id: 'new-unranked',  title: 'NewUnranked',  rank: null, createdAt: '2024-03-01T00:00:00Z' }),
    ];
    const out = storiesToMarkdown(stories, FIXED_DATE);
    expect(out.indexOf('# NewUnranked')).toBeLessThan(out.indexOf('# OldUnranked'));
  });

  it('a literal --- in a story body does not corrupt story boundaries', () => {
    const tricky = makeStory({ id: '1', title: 'Tricky', rank: 5,
      star: { situation: 'Before\n---\nAfter', task: 'T', action: ['step'], result: 'R' } });
    const other  = makeStory({ id: '2', title: 'Other',  rank: 3 });
    const out = storiesToMarkdown([tricky, other], FIXED_DATE);
    // Header + 2 story H1s = 3 lines starting with "# "
    const h1s = out.match(/^# .+/gm) || [];
    expect(h1s).toHaveLength(3);
  });

  it('excludes notes and quality from every story', () => {
    const stories = [
      makeStory({ id: '1', notes: 'secret note',  quality: { situation: 'high', task: 'high', action: 'high', result: 'high', notes: 'ai secret' } }),
    ];
    const out = storiesToMarkdown(stories, FIXED_DATE);
    expect(out).not.toContain('secret note');
    expect(out).not.toContain('ai secret');
  });
});
