import type { JobProfile } from './types';

/**
 * Coverage = how many of a job's extracted competencies have at least one mapped
 * story. Single source of truth shared by the sidebar (App.svelte) and the Jobs
 * Overview dashboard — do not reimplement the formula elsewhere.
 */
export function coverageCounts(profile: JobProfile): { covered: number; total: number } {
  const total = profile.extractedCompetencies.length;
  const covered = profile.extractedCompetencies.filter(
    c => (profile.competencyMap[c] ?? []).length > 0,
  ).length;
  return { covered, total };
}

/** Coverage as a 0–100 percentage (0 when the job has no competencies yet). */
export function coveragePct(profile: JobProfile): number {
  const { covered, total } = coverageCounts(profile);
  if (total === 0) return 0;
  return Math.round((covered / total) * 100);
}
