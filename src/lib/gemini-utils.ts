import type { StoryDraft } from './types';

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    public readonly isRateLimit: boolean = false
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/** Convert any thrown value (including raw SDK errors) into a typed GeminiError. */
export function toGeminiError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/\[(\d{3})/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;

  if (status === 400 || status === 401 || status === 403) {
    return new GeminiError(
      'Invalid API key. Open ⚙️ Settings and enter a valid Gemini key.',
      false
    );
  }
  if (status === 429) {
    return new GeminiError('Rate limit reached. Please wait a moment and try again.', true, true);
  }
  if (status === 500 || status === 503) {
    return new GeminiError('Gemini is temporarily unavailable. Retrying…', true);
  }
  return new GeminiError(msg.slice(0, 200) || 'Unexpected error from Gemini.', false);
}

export function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiError(`Non-JSON response: ${cleaned.slice(0, 120)}`, true);
  }
}

export function assertStoryDraft(parsed: unknown): asserts parsed is StoryDraft {
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('star' in parsed) ||
    typeof (parsed as Record<string, unknown>).star !== 'object' ||
    (parsed as Record<string, unknown>).star === null ||
    !Array.isArray((parsed as { star: Record<string, unknown> }).star.action) ||
    (parsed as { star: { action: unknown[] } }).star.action.length === 0 ||
    !('quality' in parsed)
  ) {
    throw new GeminiError('Incomplete STAR response. Please try again.', true);
  }
}
