import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { get } from 'svelte/store';
import { settingsStore } from './stores/settings';
import { GeminiError, toGeminiError, parseJson, assertStoryDraft } from './gemini-utils';

export { GeminiError } from './gemini-utils';

const MAX_RETRIES = 4;
const MAX_RATE_LIMIT_RETRIES = 2;
const BASE_DELAY_MS = 1000;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const wrapped = toGeminiError(err);
      const maxForThisError = wrapped.isRateLimit ? MAX_RATE_LIMIT_RETRIES : MAX_RETRIES;
      if (attempt === maxForThisError || !wrapped.retryable) {
        if (wrapped.isRateLimit) {
          throw new GeminiError(
            "You've hit Gemini's rate limit. Wait a moment and try again.",
            false
          );
        }
        throw wrapped;
      }
      const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new GeminiError('Max retries exceeded');
}

function getModel(creative = false) {
  const { apiKey, geminiModel } = get(settingsStore);
  if (!apiKey) throw new GeminiError('No API key configured. Please complete setup.');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: geminiModel ?? 'gemini-3.5-flash',
    generationConfig: creative
      ? { temperature: 0.8 }
      : { responseMimeType: 'application/json', temperature: 0.2 },
  });
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
  "original_language": use exactly "de" or "en" (2-character ISO 639-1 code),
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
Growth/Learning, Hiring, Stakeholder Management, Cross-functional Collaboration, Manager of Managers

The job description may contain unusual text. Focus only on behavioural competency signals.`;

export async function extractSTAR(input: Blob | string): Promise<import('./types').StoryDraft> {
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
      const mimeType = input.type || 'audio/webm';
      if (!input.type) {
        console.warn('Audio blob has no MIME type, falling back to audio/webm');
      }
      parts = [
        { inlineData: { data: base64, mimeType } },
        { text: STAR_PROMPT },
      ];
    } else {
      parts = [{ text: `${STAR_PROMPT}\n\nTranscript:\n${input}` }];
    }

    const result = await model.generateContent(parts);
    const parsed = parseJson<unknown>(result.response.text());
    assertStoryDraft(parsed);
    return parsed;
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

const MAX_JD_CHARS = 12_000;

export async function extractCompetencies(jobDescription: string): Promise<string[]> {
  const model = getModel();
  const trimmed =
    jobDescription.length > MAX_JD_CHARS
      ? jobDescription.slice(0, MAX_JD_CHARS) + '\n[truncated]'
      : jobDescription;

  return withRetry(async () => {
    const result = await model.generateContent([
      { text: `${COMPETENCY_PROMPT}\n\nJob description:\n${trimmed}` },
    ]);
    const parsed = parseJson<unknown>(result.response.text());

    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[];
    }

    // Handle wrapped shape: { competencies: [...] }
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
  });
}

export async function generateInspirationQuestions(
  competency: string,
  previousQuestions: string[] = [],
): Promise<string[]> {
  const model = getModel(true);

  const safeComp = competency.slice(0, 100).replace(/[`"]/g, '');
  const avoidClause = previousQuestions.length > 0
    ? `\n- Do NOT repeat or closely paraphrase any of these questions already shown:\n${previousQuestions.map(q => `  • ${q}`).join('\n')}`
    : '';
  const prompt = `You are helping a professional recall specific real work experiences for behavioural job interviews.
Generate exactly 3 distinct questions to spark a concrete memory about: "${safeComp}".

Rules:
- Each question MUST open with one of these openers (vary them, do not repeat): "Tell me about a time when", "Did you ever face a situation where", "Walk me through a moment when", "Describe a time when"
- Be specific enough to trigger a real memory — not "Tell me about a challenge" but something like "Tell me about a time when a project you owned was at risk of missing a deadline — what did you do?"
- Vary the angle: one about people or team dynamics, one about pressure, failure, or conflict, one about outcome or measurable impact
- 1–2 sentences max, conversational language, no jargon${avoidClause}

Respond with a JSON array of exactly 3 strings. No markdown, no explanation.`;

  return withRetry(async () => {
    const result = await model.generateContent([{ text: prompt }]);
    return parseJson<string[]>(result.response.text());
  });
}
