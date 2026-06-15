/**
 * Formats an ISO timestamp as a short, human relative label
 * ("today", "yesterday", "3 days ago", "2 weeks ago", "1 month ago").
 *
 * Pure and clock-injectable so it's deterministic in unit tests. Locale is fixed
 * to 'en' to keep the labels (and tests) stable regardless of host locale.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const ms = now.getTime() - then;
  if (Number.isNaN(then) || ms < 0) return 'just now'; // future / clock skew

  const DAY = 86_400_000;
  const days = Math.floor(ms / DAY);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (days === 0) return 'today';
  if (days < 7) return rtf.format(-days, 'day'); // "yesterday", "3 days ago"
  if (days < 30) return rtf.format(-Math.floor(days / 7), 'week');
  if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
  return rtf.format(-Math.floor(days / 365), 'year');
}

/** Full, unambiguous date for a `<time title>` / hover tooltip. */
export function absoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
