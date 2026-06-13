import { describe, it, expect } from 'vitest';
import { buildSettingsPatch } from './ai-settings';

describe('buildSettingsPatch', () => {
  it('trims and uses the cloud key when provider is cloud', () => {
    const result = buildSettingsPatch('cloud', '  AIzaTestKey  ', 'old-key', 'gemini-2.5-flash');
    expect(result.apiKey).toBe('AIzaTestKey');
    expect(result.aiProvider).toBe('cloud');
    expect(result.consentGiven).toBe(true);
    expect(result.geminiModel).toBe('gemini-2.5-flash');
  });

  it('preserves the existing key when provider is local', () => {
    const result = buildSettingsPatch('local', 'AIzaNewKey', 'AIzaExistingKey', 'gemini-2.5-flash');
    expect(result.apiKey).toBe('AIzaExistingKey');
    expect(result.aiProvider).toBe('local');
  });

  it('falls back to empty string when provider is local and there is no existing key', () => {
    const result = buildSettingsPatch('local', '', undefined, 'gemini-2.5-flash');
    expect(result.apiKey).toBe('');
  });

  it('always sets consentGiven to true regardless of provider', () => {
    expect(buildSettingsPatch('cloud', 'AIzaKey', undefined, 'gemini-2.5-flash').consentGiven).toBe(true);
    expect(buildSettingsPatch('local', '', undefined, 'gemini-2.5-flash').consentGiven).toBe(true);
  });

  it('ignores the cloud key input when provider is local', () => {
    const result = buildSettingsPatch('local', 'AIzaIgnoredKey', 'AIzaKept', 'gemini-2.5-flash');
    expect(result.apiKey).toBe('AIzaKept');
  });
});
