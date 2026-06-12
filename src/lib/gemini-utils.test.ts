import { describe, it, expect } from 'vitest';
import { GeminiError, toGeminiError, parseJson, assertStoryDraft } from './gemini-utils';

// ── toGeminiError ─────────────────────────────────────────────────────────────

describe('toGeminiError', () => {
  it('passes through an existing GeminiError unchanged', () => {
    const err = new GeminiError('already wrapped', false);
    expect(toGeminiError(err)).toBe(err);
  });

  it('maps status 400 to invalid API key message, non-retryable', () => {
    const result = toGeminiError(new Error('[400 Bad Request]'));
    expect(result).toBeInstanceOf(GeminiError);
    expect(result.message).toContain('Invalid API key');
    expect(result.retryable).toBe(false);
    expect(result.isRateLimit).toBe(false);
  });

  it('maps status 401 to invalid API key message', () => {
    expect(toGeminiError(new Error('[401 Unauthorized]')).message).toContain('Invalid API key');
  });

  it('maps status 403 to invalid API key message', () => {
    expect(toGeminiError(new Error('[403 Forbidden]')).message).toContain('Invalid API key');
  });

  it('maps status 429 to rate limit, retryable + isRateLimit', () => {
    const result = toGeminiError(new Error('[429 Too Many Requests]'));
    expect(result.message).toContain('Rate limit');
    expect(result.retryable).toBe(true);
    expect(result.isRateLimit).toBe(true);
  });

  it('maps status 500 to unavailable, retryable, not isRateLimit', () => {
    const result = toGeminiError(new Error('[500 Internal Server Error]'));
    expect(result.message).toContain('unavailable');
    expect(result.retryable).toBe(true);
    expect(result.isRateLimit).toBe(false);
  });

  it('maps status 503 to unavailable, retryable', () => {
    const result = toGeminiError(new Error('[503 Service Unavailable]'));
    expect(result.message).toContain('unavailable');
    expect(result.retryable).toBe(true);
  });

  it('surfaces raw message for unrecognised errors, non-retryable', () => {
    const result = toGeminiError(new Error('Something unexpected happened'));
    expect(result.message).toBe('Something unexpected happened');
    expect(result.retryable).toBe(false);
  });

  it('handles non-Error thrown values (strings)', () => {
    const result = toGeminiError('plain string error');
    expect(result).toBeInstanceOf(GeminiError);
    expect(result.message).toBe('plain string error');
  });

  it('handles non-Error thrown values (null)', () => {
    const result = toGeminiError(null);
    expect(result).toBeInstanceOf(GeminiError);
  });

  it('truncates very long messages to 200 characters', () => {
    const result = toGeminiError(new Error('A'.repeat(300)));
    expect(result.message.length).toBeLessThanOrEqual(200);
  });

  it('does not misfire on a bracketed year like [2024]', () => {
    // The regex matches any 3-digit number inside brackets; a 4-digit year must not map to a known status
    const result = toGeminiError(new Error('Error [2024] occurred'));
    expect(result.message).not.toContain('Invalid API key');
    expect(result.message).not.toContain('unavailable');
  });
});

// ── parseJson ─────────────────────────────────────────────────────────────────

describe('parseJson', () => {
  it('parses a clean JSON object', () => {
    expect(parseJson<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true });
  });

  it('parses a JSON array', () => {
    expect(parseJson<string[]>('["a","b"]')).toEqual(['a', 'b']);
  });

  it('parses a bare JSON number', () => {
    expect(parseJson<number>('42')).toBe(42);
  });

  it('strips leading and trailing whitespace', () => {
    expect(parseJson<{ x: number }>('  {"x":1}  ')).toEqual({ x: 1 });
  });

  it('strips ```json … ``` fences', () => {
    expect(parseJson<{ x: number }>('```json\n{"x":1}\n```')).toEqual({ x: 1 });
  });

  it('strips bare ``` … ``` fences', () => {
    expect(parseJson<{ x: number }>('```\n{"x":1}\n```')).toEqual({ x: 1 });
  });

  it('throws a retryable GeminiError for prose input', () => {
    let caught: unknown;
    try { parseJson('not json'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(GeminiError);
    expect((caught as GeminiError).retryable).toBe(true);
    expect((caught as GeminiError).message).toContain('Non-JSON response');
  });

  it('throws for an empty string after fence stripping', () => {
    expect(() => parseJson('')).toThrow(GeminiError);
  });
});

// ── assertStoryDraft ──────────────────────────────────────────────────────────

describe('assertStoryDraft', () => {
  const validDraft = {
    title: 'Led a migration',
    original_language: 'en',
    competency_tags: ['Leadership'],
    star: {
      situation: 'At a fast-growing startup.',
      task: 'Migrate our CI pipeline.',
      action: ['Audited existing jobs', 'Rewrote pipeline YAML'],
      result: 'Reduced build time by 40%.',
    },
    quality: { situation: 'high', task: 'high', action: 'medium', result: 'high', notes: '' },
  };

  it('does not throw for a valid draft', () => {
    expect(() => assertStoryDraft(validDraft)).not.toThrow();
  });

  it('throws GeminiError for null', () => {
    expect(() => assertStoryDraft(null)).toThrow(GeminiError);
  });

  it('throws for a non-object primitive', () => {
    expect(() => assertStoryDraft(42)).toThrow(GeminiError);
  });

  it('throws when star field is missing', () => {
    const { star: _s, ...noStar } = validDraft;
    expect(() => assertStoryDraft(noStar)).toThrow(GeminiError);
  });

  it('throws when star is null', () => {
    expect(() => assertStoryDraft({ ...validDraft, star: null })).toThrow(GeminiError);
  });

  it('throws when star.action is not an array', () => {
    expect(() =>
      assertStoryDraft({ ...validDraft, star: { ...validDraft.star, action: 'one step' } }),
    ).toThrow(GeminiError);
  });

  it('throws when star.action is an empty array', () => {
    expect(() =>
      assertStoryDraft({ ...validDraft, star: { ...validDraft.star, action: [] } }),
    ).toThrow(GeminiError);
  });

  it('throws when quality field is missing', () => {
    const { quality: _q, ...noQuality } = validDraft;
    expect(() => assertStoryDraft(noQuality)).toThrow(GeminiError);
  });

  it('GeminiError thrown is retryable', () => {
    let caught: unknown;
    try { assertStoryDraft(null); } catch (e) { caught = e; }
    expect((caught as GeminiError).retryable).toBe(true);
  });
});
