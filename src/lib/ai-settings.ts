import type { AiProvider, GeminiModel } from './types';

/**
 * Builds the settings payload for both Landing and Settings views.
 * Keeping this logic in one place prevents the two views from drifting
 * apart on the "preserve existing key when switching to local" rule.
 */
export function buildSettingsPatch(
  provider: AiProvider,
  cloudKey: string,
  existingKey: string | undefined,
  model: GeminiModel,
) {
  return {
    apiKey: provider === 'cloud' ? cloudKey.trim() : (existingKey ?? ''),
    consentGiven: true as const,
    geminiModel: model,
    aiProvider: provider,
  };
}
