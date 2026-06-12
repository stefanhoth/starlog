import type { StoryDraft, LocalModelCapabilities } from './types';
import { GeminiError, parseJson, assertStoryDraft } from './gemini-utils';

// Prompts are simplified versions tuned for smaller local models.
// Per-provider prompt tuning (few-shot examples, quality constraints) is deferred to M6.
const LOCAL_STAR_PROMPT = `You are a career coach helping a job applicant structure their interview stories.

Your job: rewrite the following transcript as a concise, polished STAR story IN ENGLISH.
Output ONLY valid JSON — no preamble, no markdown fences, no explanation.

Use this exact JSON structure:
{
  "title": "Short story title in English (5-8 words)",
  "original_language": "en",
  "competency_tags": ["1-3 tags from: Leadership, Delivery, Conflict, Ambiguity, Influence, Technical Depth, Customer Focus, Growth/Learning, Hiring, Stakeholder Management, Cross-functional Collaboration, Manager of Managers"],
  "star": {
    "situation": "string",
    "task": "string",
    "action": ["step 1", "step 2", "step 3"],
    "result": "string"
  },
  "quality": {
    "situation": "high | medium | low",
    "task": "high | medium | low",
    "action": "high | medium | low",
    "result": "high | medium | low",
    "notes": "Honest 1-2 sentence assessment."
  }
}`;

const LOCAL_COMPETENCY_PROMPT = `You are a career coach analysing a job description.

Extract the 5-7 behavioural competencies this role is most likely to assess in interviews.
Focus on interpersonal and leadership behaviours, not technical skills.

Output ONLY a JSON array of strings — no preamble, no markdown fences.
Example: ["Leadership", "Delivery", "Conflict", "Ambiguity", "Stakeholder Management"]

Choose from or rephrase into terms from this list where applicable:
Leadership, Delivery, Conflict, Ambiguity, Influence, Technical Depth, Customer Focus,
Growth/Learning, Hiring, Stakeholder Management, Cross-functional Collaboration, Manager of Managers`;

const LOCAL_INSPIRATION_PROMPT = (competency: string) =>
  `You are helping a professional recall real work experiences for job interviews.
Generate exactly 3 short, punchy questions for the competency: "${competency}".

Rules:
- Max 12 words per question
- Start with "When", "What", "How", or an action verb — never "Tell me about a time"
- Vary the angle: one about people/team dynamics, one about a challenge or failure, one about outcome or impact
- Plain conversational language, no corporate jargon

Respond with a JSON array of exactly 3 strings. No markdown, no extra keys.`;

// ── Engine singleton ──────────────────────────────────────────────────────────

// Dynamically typed to avoid a top-level static import of @litert-lm/core
// (which is WASM-only and must never load in cloud mode or CI).
type LiteRTEngine = Awaited<ReturnType<typeof import('@litert-lm/core').Engine.create>>;

const DEFAULT_CAPABILITIES: LocalModelCapabilities = {
  supportsAudio: false,
  maxContextTokens: 8192,
  streamingSupported: true,
};

let _engine: LiteRTEngine | null = null;
let _capabilities: LocalModelCapabilities = { ...DEFAULT_CAPABILITIES };

/** Test seam — resets the cached engine and capabilities so each test starts fresh. */
export function _resetEngine(): void {
  _engine = null;
  _capabilities = { ...DEFAULT_CAPABILITIES };
}

export function isEngineReady(): boolean {
  return _engine !== null;
}

export function getCapabilities(): LocalModelCapabilities {
  return _capabilities;
}

/**
 * Loads and initialises the local LiteRT LM engine.
 * Pass a URL string for remote models, or a ReadableStream for local files.
 * The M3 Settings UI handles progress tracking and calls this once the stream is ready.
 * Subsequent calls return the cached engine immediately.
 */
export async function initEngine(
  modelSource: string | ReadableStream<Uint8Array>,
): Promise<LocalModelCapabilities> {
  if (_engine) return _capabilities;

  const { Engine } = await import('@litert-lm/core');
  _engine = await Engine.create({ model: modelSource });

  // Read actual context window from engine settings after init.
  const maxTokens = _engine.settings.mainExecutorSettings.maxNumTokens;
  if (maxTokens > 0) {
    _capabilities = { ..._capabilities, maxContextTokens: maxTokens };
  }

  return _capabilities;
}

// ── Streaming helper ──────────────────────────────────────────────────────────

async function streamToString(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.2,
): Promise<string> {
  if (!_engine) {
    throw new GeminiError('Local model not loaded. Please load a model in Settings first.', false);
  }

  const conversation = await _engine.createConversation({
    preface: { messages: [{ role: 'system', content: systemPrompt }] },
    enableConstrainedDecoding: true,
    sessionConfig: { samplerParams: { temperature } },
  });

  const stream = conversation.sendMessageStreaming(userMessage);
  const reader = stream.getReader();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text =
      typeof value.content === 'string'
        ? value.content
        : Array.isArray(value.content)
          ? value.content.map((c: { text?: string }) => c.text ?? '').join('')
          : '';
    result += text;
  }

  return result;
}

// ── Public API — matches signatures in gemini.ts ──────────────────────────────

export async function extractSTAR(input: string): Promise<StoryDraft> {
  const raw = await streamToString(LOCAL_STAR_PROMPT, `Transcript:\n${input}`);
  const parsed = parseJson<unknown>(raw);
  assertStoryDraft(parsed);
  return parsed;
}

export async function extractCompetencies(jobDescription: string): Promise<string[]> {
  // Respect the engine's context window; use 3 chars/token as a conservative estimate.
  const maxChars = Math.min(_capabilities.maxContextTokens * 3, 8000);
  const trimmed =
    jobDescription.length > maxChars
      ? jobDescription.slice(0, maxChars) + '\n[truncated]'
      : jobDescription;

  const raw = await streamToString(LOCAL_COMPETENCY_PROMPT, `Job description:\n${trimmed}`);
  const parsed = parseJson<unknown>(raw);

  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => typeof x === 'string')) {
    return parsed as string[];
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'competencies' in parsed &&
    Array.isArray((parsed as { competencies: unknown }).competencies) &&
    (parsed as { competencies: unknown[] }).competencies.length > 0 &&
    (parsed as { competencies: unknown[] }).competencies.every((x) => typeof x === 'string')
  ) {
    return (parsed as { competencies: string[] }).competencies;
  }

  throw new GeminiError('Incomplete competencies response. Please try again.', true);
}

export async function generateInspirationQuestions(competency: string): Promise<string[]> {
  const safeComp = competency.slice(0, 100).replace(/[`"]/g, '');
  const raw = await streamToString(
    LOCAL_INSPIRATION_PROMPT(safeComp),
    'Generate the questions now.',
    0.8,
  );
  return parseJson<string[]>(raw);
}
