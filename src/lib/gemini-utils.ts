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

/**
 * Builds the inspiration-question prompt shared by BOTH AI providers (cloud Gemini
 * and the local model). Keeping a single source of truth here is deliberate: the
 * cloud and local prompts previously drifted apart (#216/#221/#226), so they must
 * never be duplicated again.
 *
 * Behavioural-interview framing: every question opens with a STAR-style opener and
 * is concrete enough to surface a real memory. When `previousQuestions` is provided
 * (on regenerate), the model is told to avoid repeating them.
 *
 * The competency is sanitised here (capped at 100 chars, backticks/quotes stripped)
 * so neither caller can forget to do it.
 */
export function buildInspirationPrompt(competency: string, previousQuestions: string[] = []): string {
  const safeComp = competency.slice(0, 100).replace(/[`"]/g, '');
  const avoidClause = previousQuestions.length > 0
    ? `\n- Do NOT repeat or closely paraphrase any of these questions already shown:\n${previousQuestions.map(q => `  • ${q}`).join('\n')}`
    : '';
  return `You are helping a professional recall specific real work experiences for behavioural job interviews.
Generate exactly 3 distinct questions to spark a concrete memory about: "${safeComp}".

Rules:
- Each question MUST open with one of these openers (vary them, do not repeat): "Tell me about a time when", "Did you ever face a situation where", "Walk me through a moment when", "Describe a time when"
- Be specific enough to trigger a real memory — not "Tell me about a challenge" but something like "Tell me about a time when a project you owned was at risk of missing a deadline — what did you do?"
- Vary the angle: one about people or team dynamics, one about pressure, failure, or conflict, one about outcome or measurable impact
- 1–2 sentences max, conversational language, no jargon${avoidClause}

Respond with a JSON array of exactly 3 strings. No markdown, no explanation.`;
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
