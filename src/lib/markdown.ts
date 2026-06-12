import type { Story } from './types';

/**
 * Converts a story title to a safe, lowercase filename slug.
 * - NFKD accent-folds (é → e), allowlist a-z/0-9, collapses hyphens
 * - Caps at 60 chars; falls back to 'untitled-story' when result is empty
 */
export function slugifyTitle(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled-story'
  );
}

/**
 * Serialises a Story to Markdown for external sharing.
 * Intentionally excludes `notes` (private) and `quality` (internal AI metadata).
 */
export function storyToMarkdown(story: Story): string {
  const lines: string[] = [];

  lines.push(`# ${story.title || 'Untitled Story'}`);
  lines.push('');

  if (story.competency_tags.length > 0) {
    lines.push(`**Tags:** ${story.competency_tags.join(' · ')}`);
    lines.push('');
  }

  if (story.star.situation) {
    lines.push('## Situation');
    lines.push(story.star.situation);
    lines.push('');
  }

  if (story.star.task) {
    lines.push('## Task');
    lines.push(story.star.task);
    lines.push('');
  }

  const steps = story.star.action.filter(a => a.trim());
  if (steps.length > 0) {
    lines.push('## Action');
    for (const step of steps) lines.push(`- ${step}`);
    lines.push('');
  }

  if (story.star.result) {
    lines.push('## Result');
    lines.push(story.star.result);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Serialises the whole story library to a single Markdown document for sharing.
 * Display-only: NOT a backup and NOT re-importable — use JSON backup to restore.
 * Composes storyToMarkdown() so notes/quality are excluded for free.
 * `---` between stories is a visual rule only; `# {title}` is the structural boundary.
 *
 * @param exportedAt - injectable for deterministic/TZ-safe tests; defaults to now
 */
export function storiesToMarkdown(stories: Story[], exportedAt: Date = new Date()): string {
  if (stories.length === 0) return '';

  // Sort: rank desc, createdAt desc as tiebreak. null rank sorts last.
  // This deliberately inverts StoryBank's on-screen order (null = needs attention = shown first there).
  const sorted = [...stories].sort((a, b) => {
    if (a.rank === null && b.rank === null) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    if (b.rank !== a.rank) return b.rank - a.rank;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const n = sorted.length;
  const dateStr = exportedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const header = `# Story Library Export\n*${n} ${n === 1 ? 'story' : 'stories'} · exported ${dateStr}*`;

  const bodies = sorted.map(s => storyToMarkdown(s));
  return header + '\n\n' + bodies.join('\n---\n\n');
}

/**
 * Triggers a browser file download for a Markdown string.
 * Defers revokeObjectURL to avoid cancelling the download in some browsers.
 */
export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
