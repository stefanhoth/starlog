import { describe, it, expect } from 'vitest';
import { coverageCounts, coveragePct } from './coverage';
import type { JobProfile } from './types';

function makeProfile(
  extractedCompetencies: string[],
  competencyMap: Record<string, string[]> = {},
): JobProfile {
  return {
    id: 'p1',
    company: 'Acme',
    role: 'EM',
    jobDescription: '',
    extractedCompetencies,
    competencyMap,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
  };
}

describe('coverageCounts', () => {
  it('counts competencies with at least one mapped story', () => {
    const p = makeProfile(['A', 'B', 'C'], { A: ['s1'], B: [], C: ['s2', 's3'] });
    expect(coverageCounts(p)).toEqual({ covered: 2, total: 3 });
  });

  it('treats a missing map entry as uncovered', () => {
    const p = makeProfile(['A', 'B'], { A: ['s1'] }); // B absent from map
    expect(coverageCounts(p)).toEqual({ covered: 1, total: 2 });
  });

  it('handles a job with no competencies', () => {
    expect(coverageCounts(makeProfile([]))).toEqual({ covered: 0, total: 0 });
  });
});

describe('coveragePct', () => {
  it('rounds to a whole percentage', () => {
    expect(coveragePct(makeProfile(['A', 'B', 'C'], { A: ['s1'] }))).toBe(33);
  });

  it('is 100 when every competency is covered', () => {
    expect(coveragePct(makeProfile(['A', 'B'], { A: ['s1'], B: ['s2'] }))).toBe(100);
  });

  it('is 0 (not NaN) for a job with no competencies', () => {
    expect(coveragePct(makeProfile([]))).toBe(0);
  });
});
