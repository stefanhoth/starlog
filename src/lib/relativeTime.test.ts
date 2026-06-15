import { describe, it, expect } from 'vitest';
import { relativeTime, absoluteDate } from './relativeTime';

const NOW = new Date('2026-06-15T12:00:00Z');
const agoDays = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('relativeTime', () => {
  it('says "today" for the same day', () => {
    expect(relativeTime(agoDays(0), NOW)).toBe('today');
    expect(relativeTime(new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), NOW)).toBe('today');
  });

  it('says "yesterday" for one day ago', () => {
    expect(relativeTime(agoDays(1), NOW)).toBe('yesterday');
  });

  it('counts days within the week', () => {
    expect(relativeTime(agoDays(3), NOW)).toBe('3 days ago');
    expect(relativeTime(agoDays(6), NOW)).toBe('6 days ago');
  });

  it('rolls up to weeks', () => {
    expect(relativeTime(agoDays(7), NOW)).toBe('last week');
    expect(relativeTime(agoDays(14), NOW)).toBe('2 weeks ago');
  });

  it('rolls up to months', () => {
    expect(relativeTime(agoDays(30), NOW)).toBe('last month');
    expect(relativeTime(agoDays(90), NOW)).toBe('3 months ago');
  });

  it('rolls up to years', () => {
    expect(relativeTime(agoDays(365), NOW)).toBe('last year');
    expect(relativeTime(agoDays(800), NOW)).toBe('2 years ago');
  });

  it('treats future timestamps / clock skew as "just now"', () => {
    expect(relativeTime(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe('just now');
  });

  it('handles an unparseable date gracefully', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('just now');
  });
});

describe('absoluteDate', () => {
  it('renders a full, unambiguous date', () => {
    const out = absoluteDate('2026-05-04T09:00:00Z');
    expect(out).toContain('2026');
    expect(out).toMatch(/May|Mai/); // locale-dependent month name
  });
});
