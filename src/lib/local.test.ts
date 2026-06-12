import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @litert-lm/core before any local.ts import so the dynamic import resolves to the mock.
const mockSendMessageStreaming = vi.fn();
const mockCreateConversation = vi.fn();
const mockEngineCreate = vi.fn();

vi.mock('@litert-lm/core', () => ({
  Engine: {
    create: mockEngineCreate,
  },
}));

// Import after mock is registered.
import { _resetEngine, initEngine, isEngineReady, extractSTAR, extractCompetencies, generateInspirationQuestions } from './local';
import { GeminiError } from './gemini-utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStream(text: string): ReadableStream<{ content: string }> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ content: text });
      controller.close();
    },
  });
}

function setupEngine(responseText: string) {
  mockSendMessageStreaming.mockReturnValue(makeStream(responseText));
  mockCreateConversation.mockResolvedValue({ sendMessageStreaming: mockSendMessageStreaming });
  mockEngineCreate.mockResolvedValue({
    createConversation: mockCreateConversation,
    settings: { mainExecutorSettings: { maxNumTokens: 4096 } },
  });
}

const validDraft = {
  title: 'Led a migration',
  original_language: 'en',
  competency_tags: ['Leadership'],
  star: {
    situation: 'At a startup.',
    task: 'Migrate CI.',
    action: ['Audited jobs', 'Rewrote YAML'],
    result: 'Build time down 40%.',
  },
  quality: { situation: 'high', task: 'high', action: 'medium', result: 'high', notes: '' },
};

// ── initEngine ────────────────────────────────────────────────────────────────

describe('initEngine', () => {
  beforeEach(() => {
    _resetEngine();
    vi.clearAllMocks();
  });

  it('creates the engine on first call', async () => {
    setupEngine('{}');
    await initEngine('https://example.com/model.litertlm');
    expect(mockEngineCreate).toHaveBeenCalledOnce();
  });

  it('returns cached engine on second call (does not re-create)', async () => {
    setupEngine('{}');
    await initEngine('https://example.com/model.litertlm');
    await initEngine('https://example.com/model.litertlm');
    expect(mockEngineCreate).toHaveBeenCalledOnce();
  });

  it('reports isEngineReady() correctly', async () => {
    expect(isEngineReady()).toBe(false);
    setupEngine('{}');
    await initEngine('https://example.com/model.litertlm');
    expect(isEngineReady()).toBe(true);
  });

  it('updates maxContextTokens from engine settings', async () => {
    setupEngine('{}');
    const caps = await initEngine('https://example.com/model.litertlm');
    expect(caps.maxContextTokens).toBe(4096);
  });

  it('keeps default maxContextTokens when engine reports 0', async () => {
    mockSendMessageStreaming.mockReturnValue(makeStream('{}'));
    mockCreateConversation.mockResolvedValue({ sendMessageStreaming: mockSendMessageStreaming });
    mockEngineCreate.mockResolvedValue({
      createConversation: mockCreateConversation,
      settings: { mainExecutorSettings: { maxNumTokens: 0 } },
    });
    const caps = await initEngine('https://example.com/model.litertlm');
    expect(caps.maxContextTokens).toBe(8192); // default
  });
});

// ── extractSTAR ───────────────────────────────────────────────────────────────

describe('extractSTAR', () => {
  beforeEach(() => {
    _resetEngine();
    vi.clearAllMocks();
    setupEngine(JSON.stringify(validDraft));
  });

  it('throws GeminiError when engine is not loaded', async () => {
    await expect(extractSTAR('some transcript')).rejects.toBeInstanceOf(GeminiError);
  });

  it('parses and returns a valid StoryDraft', async () => {
    await initEngine('url');
    const result = await extractSTAR('Some transcript');
    expect(result.title).toBe('Led a migration');
    expect(result.star.action).toHaveLength(2);
  });

  it('throws GeminiError for non-JSON response', async () => {
    mockSendMessageStreaming.mockReturnValue(makeStream('not json at all'));
    await initEngine('url');
    await expect(extractSTAR('transcript')).rejects.toBeInstanceOf(GeminiError);
  });

  it('throws GeminiError when star field is missing', async () => {
    const { star: _s, ...noStar } = validDraft;
    mockSendMessageStreaming.mockReturnValue(makeStream(JSON.stringify(noStar)));
    await initEngine('url');
    await expect(extractSTAR('transcript')).rejects.toBeInstanceOf(GeminiError);
  });

  it('uses constrained decoding', async () => {
    await initEngine('url');
    await extractSTAR('transcript');
    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({ enableConstrainedDecoding: true }),
    );
  });
});

// ── extractCompetencies ───────────────────────────────────────────────────────

describe('extractCompetencies', () => {
  beforeEach(() => {
    _resetEngine();
    vi.clearAllMocks();
    setupEngine(JSON.stringify(['Leadership', 'Delivery']));
  });

  it('throws when engine is not loaded', async () => {
    await expect(extractCompetencies('some JD')).rejects.toBeInstanceOf(GeminiError);
  });

  it('returns a bare array response', async () => {
    await initEngine('url');
    const result = await extractCompetencies('Job description here');
    expect(result).toEqual(['Leadership', 'Delivery']);
  });

  it('handles wrapped { competencies: [...] } shape', async () => {
    mockSendMessageStreaming.mockReturnValue(
      makeStream(JSON.stringify({ competencies: ['Conflict', 'Ambiguity'] })),
    );
    await initEngine('url');
    const result = await extractCompetencies('Job description here');
    expect(result).toEqual(['Conflict', 'Ambiguity']);
  });

  it('throws GeminiError for malformed response', async () => {
    mockSendMessageStreaming.mockReturnValue(makeStream(JSON.stringify({ bad: 'shape' })));
    await initEngine('url');
    await expect(extractCompetencies('JD')).rejects.toBeInstanceOf(GeminiError);
  });

  it('truncates input that exceeds maxContextTokens', async () => {
    await initEngine('url'); // sets maxContextTokens = 4096
    const longJD = 'x'.repeat(50_000);
    await extractCompetencies(longJD);
    const calledWith = mockSendMessageStreaming.mock.calls[0][0] as string;
    expect(calledWith).toContain('[truncated]');
    expect(calledWith.length).toBeLessThan(longJD.length);
  });
});

// ── generateInspirationQuestions ──────────────────────────────────────────────

describe('generateInspirationQuestions', () => {
  beforeEach(() => {
    _resetEngine();
    vi.clearAllMocks();
    setupEngine(JSON.stringify(['Q1', 'Q2', 'Q3']));
  });

  it('throws when engine is not loaded', async () => {
    await expect(generateInspirationQuestions('Leadership')).rejects.toBeInstanceOf(GeminiError);
  });

  it('returns parsed string array', async () => {
    await initEngine('url');
    const result = await generateInspirationQuestions('Leadership');
    expect(result).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('uses higher temperature for inspiration generation', async () => {
    await initEngine('url');
    await generateInspirationQuestions('Leadership');
    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionConfig: expect.objectContaining({
          samplerParams: expect.objectContaining({ temperature: 0.8 }),
        }),
      }),
    );
  });

  it('sanitises backticks and quotes from the competency before interpolation', async () => {
    await initEngine('url');
    await generateInspirationQuestions('`danger" injection`');
    const [systemMsg] = mockCreateConversation.mock.calls[0][0].preface.messages;
    // The competency literal chars should be stripped; the word itself should remain
    expect(systemMsg.content).toContain('danger injection');
    expect(systemMsg.content).not.toContain('`danger');
    expect(systemMsg.content).not.toContain('injection`');
  });
});
