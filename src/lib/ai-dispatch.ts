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
  if (input instanceof Blob || get(settingsStore).aiProvider === 'cloud') {
    return cloud.extractSTAR(input);
  }
  // M2: return local.extractSTAR(input as string);
  return cloud.extractSTAR(input);
}

/**
 * Routes competency extraction to the active AI provider.
 */
export async function dispatchExtractCompetencies(jobDescription: string): Promise<string[]> {
  if (get(settingsStore).aiProvider === 'cloud') {
    return cloud.extractCompetencies(jobDescription);
  }
  // M2: return local.extractCompetencies(jobDescription);
  return cloud.extractCompetencies(jobDescription);
}

/**
 * Routes inspiration question generation to the active AI provider.
 */
export async function dispatchGenerateInspirationQuestions(competency: string): Promise<string[]> {
  if (get(settingsStore).aiProvider === 'cloud') {
    return cloud.generateInspirationQuestions(competency);
  }
  // M2: return local.generateInspirationQuestions(competency);
  return cloud.generateInspirationQuestions(competency);
}
