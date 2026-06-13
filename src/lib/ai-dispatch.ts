import { get } from 'svelte/store';
import { settingsStore } from './stores/settings';
import * as cloud from './gemini';
import type { StoryDraft } from './types';

export { GeminiError } from './gemini-utils';

/**
 * Routes STAR extraction to the active AI provider.
 * Audio (Blob) input always routes to cloud — local models have no browser audio pipeline.
 */
export async function dispatchExtractSTAR(input: Blob | string): Promise<StoryDraft> {
  if (input instanceof Blob || get(settingsStore).aiProvider !== 'local') {
    return cloud.extractSTAR(input);
  }
  const { extractSTAR } = await import('./local');
  return extractSTAR(input);
}

/**
 * Routes competency extraction to the active AI provider.
 */
export async function dispatchExtractCompetencies(jobDescription: string): Promise<string[]> {
  if (get(settingsStore).aiProvider !== 'local') {
    return cloud.extractCompetencies(jobDescription);
  }
  const { extractCompetencies } = await import('./local');
  return extractCompetencies(jobDescription);
}

/**
 * Routes inspiration question generation to the active AI provider.
 */
export async function dispatchGenerateInspirationQuestions(
  competency: string,
  previousQuestions: string[] = [],
): Promise<string[]> {
  if (get(settingsStore).aiProvider !== 'local') {
    return cloud.generateInspirationQuestions(competency, previousQuestions);
  }
  const { generateInspirationQuestions } = await import('./local');
  return generateInspirationQuestions(competency, previousQuestions);
}
