import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { get } from 'svelte/store';
import { settingsStore } from './stores/settings';
import type { StoryDraft } from './types';

export class GeminiError extends Error {
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message);
    this.name = 'GeminiError';
  }
}

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

/** Convert any thrown value (including raw SDK errors) into a typed GeminiError. */
function toGeminiError(err: unknown): GeminiError {
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
    return new GeminiError('Rate limit reached. Please wait a moment and try again.', true);
  }
  if (status === 500 || status === 503) {
    return new GeminiError('Gemini is temporarily unavailable. Retrying…', true);
  }
  // Surface the raw SDK message rather than swallowing it
  return new GeminiError(msg.slice(0, 200) || 'Unexpected error from Gemini.', false);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const wrapped = toGeminiError(err);
      if (attempt === MAX_RETRIES || !wrapped.retryable) throw wrapped;
      const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new GeminiError('Max retries exceeded');
}

function getModel() {
  const { apiKey } = get(settingsStore);
  if (!apiKey) throw new GeminiError('No API key configured. Please complete setup.');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

const STAR_PROMPT = `You are a career coach helping a job applicant structure their interview stories.

The following is a raw audio recording of someone describing a past work experience. It may be in German or English.

Your job: transcribe and rewrite it as a concise, polished STAR story IN ENGLISH, regardless of the recording language.
Output ONLY valid JSON — no preamble, no markdown fences, no explanation.

STAR definitions (keep these strictly separate):
- Situation: Pure context. Where, when, what environment. 2 sentences max. Do NOT mention the problem, challenge, or what needed to be done.
- Task: YOUR specific responsibility or goal. What YOU were accountable for. 1-2 sentences max. No overlap with Situation.
- Action: What YOU did, step by step. Extract ONLY actions explicitly described — do NOT invent or infer steps that were not mentioned. Return 1-5 items depending on what was actually stated. If fewer than 3 concrete actions are present, return only what was explicitly described and set quality.action to "low".
- Result: Outcome and impact. Quantify where possible. 2-3 sentences max.

Use this exact JSON structure:
{
  "title": "Short story title in English (5-8 words)",
  "original_language": "de or en",
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
    "notes": "Honest 1-2 sentence assessment. If action steps were sparse, explain what was missing."
  }
}`;

const COMPETENCY_PROMPT = `You are a career coach analysing a job description.

Extract the 5-7 behavioural competencies this role is most likely to assess in interviews.
Focus on interpersonal and leadership behaviours, not technical skills.

Output ONLY a JSON array of strings — no preamble, no markdown fences.
Example: ["Leadership", "Delivery", "Conflict", "Ambiguity", "Stakeholder Management"]

Choose from or rephrase into terms from this list where applicable:
Leadership, Delivery, Conflict, Ambiguity, Influence, Technical Depth, Customer Focus,
Growth/Learning, Hiring, Stakeholder Management, Cross-functional Collaboration, Manager of Managers`;

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiError(`Non-JSON response: ${cleaned.slice(0, 120)}`, true);
  }
}

export async function extractSTAR(input: Blob | string): Promise<StoryDraft> {
  const model = getModel();

  return withRetry(async () => {
    let parts: Part[];

    if (input instanceof Blob) {
      const arrayBuffer = await input.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Chunk to avoid spreading millions of args onto the call stack
      const CHUNK = 8192;
      let binary = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);
      parts = [
        { inlineData: { data: base64, mimeType: input.type || 'audio/mp4' } },
        { text: STAR_PROMPT },
      ];
    } else {
      parts = [{ text: `${STAR_PROMPT}\n\nTranscript:\n${input}` }];
    }

    const result = await model.generateContent(parts);
    return parseJson<StoryDraft>(result.response.text());
  });
}

/**
 * Makes a minimal Gemini call to confirm the key is accepted.
 * Throws GeminiError with a user-friendly message on failure.
 */
export async function verifyApiKey(key: string): Promise<void> {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  try {
    await model.generateContent('Reply with the single word: ok');
  } catch (err) {
    throw toGeminiError(err);
  }
}

export async function extractCompetencies(jobDescription: string): Promise<string[]> {
  const model = getModel();

  return withRetry(async () => {
    const result = await model.generateContent([
      { text: `${COMPETENCY_PROMPT}\n\nJob description:\n${jobDescription}` },
    ]);
    return parseJson<string[]>(result.response.text());
  });
}
