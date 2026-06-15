import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writable } from 'svelte/store';

// Mock the Gemini SDK and the settings store before importing gemini.ts, so we can
// capture the exact prompt the cloud path sends without making a network call.
const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

vi.mock('./stores/settings', () => ({
  settingsStore: writable({
    apiKey: 'test-key',
    geminiModel: 'gemini-3.5-flash',
    consentGiven: true,
    aiProvider: 'cloud',
  }),
}));

import { generateInspirationQuestions } from './gemini';

/** Returns the prompt text the cloud path passed to the model on its first call. */
function sentPrompt(): string {
  const parts = mockGenerateContent.mock.calls[0][0] as { text: string }[];
  return parts[0].text;
}

describe('generateInspirationQuestions (cloud path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(['Q1', 'Q2', 'Q3']) },
    });
  });

  it('parses and returns the model JSON array', async () => {
    const result = await generateInspirationQuestions('Leadership');
    expect(result).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('sends the behavioural-interview prompt (issue #226 — cloud now matches local)', async () => {
    await generateInspirationQuestions('Leadership');
    const prompt = sentPrompt();
    expect(prompt).toContain('behavioural job interviews');
    expect(prompt).toContain('Tell me about a time when');
    expect(prompt).toContain('"Leadership"');
    // The old short/generic framing must be gone.
    expect(prompt).not.toContain('Max 12 words');
    expect(prompt).not.toContain('never "Tell me about a time"');
  });

  it('threads previously-shown questions into the avoid-repeats clause on regenerate', async () => {
    const previous = ['Tell me about a time when you led a reluctant team.'];
    await generateInspirationQuestions('Leadership', previous);
    const prompt = sentPrompt();
    expect(prompt).toContain('Do NOT repeat or closely paraphrase');
    expect(prompt).toContain(`  • ${previous[0]}`);
  });

  it('omits the avoid-repeats clause on the first generation', async () => {
    await generateInspirationQuestions('Leadership');
    expect(sentPrompt()).not.toContain('Do NOT repeat');
  });
});
