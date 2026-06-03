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
