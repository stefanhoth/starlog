/**
 * Prompt eval harness — runs fixture inputs through Gemini and validates output shape.
 *
 * Usage: npm run test:prompts
 * Requires: GEMINI_API_KEY env var
 *
 * Intentionally NOT part of the standard test suite (requires a live API key).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { StoryDraft, QualityLevel } from '../../src/lib/types.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is not set.');
  console.error('Export it before running: export GEMINI_API_KEY=your_key_here');
  process.exit(1);
}

const MODEL = 'gemini-2.5-flash';
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Prompts (mirrors src/lib/gemini.ts — kept in sync manually)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: MODEL });

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleaned) as T;
}

async function callGemini(prompt: string): Promise<string> {
  const result = await model.generateContent([{ text: prompt }]);
  return result.response.text();
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

type AssertionError = string;

const QUALITY_LEVELS: QualityLevel[] = ['high', 'medium', 'low'];

function assertStarDraft(draft: unknown, id: string): AssertionError[] {
  const errors: AssertionError[] = [];
  const d = draft as Record<string, unknown>;

  const assertNonEmptyString = (val: unknown, field: string) => {
    if (typeof val !== 'string' || val.trim() === '') {
      errors.push(`[${id}] ${field}: expected non-empty string, got ${JSON.stringify(val)}`);
    }
  };

  assertNonEmptyString(d.title, 'title');

  if (typeof d.original_language !== 'string' || d.original_language.length !== 2) {
    errors.push(
      `[${id}] original_language: expected 2-char string, got ${JSON.stringify(d.original_language)}`
    );
  }

  if (!Array.isArray(d.competency_tags) || d.competency_tags.length === 0) {
    errors.push(`[${id}] competency_tags: expected non-empty array`);
  } else {
    d.competency_tags.forEach((tag, i) => {
      if (typeof tag !== 'string' || tag.trim() === '') {
        errors.push(`[${id}] competency_tags[${i}]: expected non-empty string`);
      }
    });
  }

  const star = d.star as Record<string, unknown> | undefined;
  if (!star || typeof star !== 'object') {
    errors.push(`[${id}] star: missing or not an object`);
  } else {
    assertNonEmptyString(star.situation, 'star.situation');
    assertNonEmptyString(star.task, 'star.task');
    assertNonEmptyString(star.result, 'star.result');
    if (!Array.isArray(star.action) || star.action.length === 0) {
      errors.push(`[${id}] star.action: expected non-empty array`);
    } else {
      star.action.forEach((step, i) => {
        if (typeof step !== 'string' || step.trim() === '') {
          errors.push(`[${id}] star.action[${i}]: expected non-empty string`);
        }
      });
    }
  }

  const quality = d.quality as Record<string, unknown> | undefined;
  if (!quality || typeof quality !== 'object') {
    errors.push(`[${id}] quality: missing or not an object`);
  } else {
    for (const field of ['situation', 'task', 'action', 'result'] as const) {
      if (!QUALITY_LEVELS.includes(quality[field] as QualityLevel)) {
        errors.push(
          `[${id}] quality.${field}: expected high|medium|low, got ${JSON.stringify(quality[field])}`
        );
      }
    }
    assertNonEmptyString(quality.notes, 'quality.notes');
  }

  return errors;
}

function assertCompetencies(data: unknown, id: string): AssertionError[] {
  const errors: AssertionError[] = [];

  if (!Array.isArray(data)) {
    errors.push(`[${id}] expected array, got ${typeof data}`);
    return errors;
  }
  if (data.length < 1) {
    errors.push(`[${id}] expected at least 1 competency, got 0`);
  }
  data.forEach((item, i) => {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`[${id}] [${i}]: expected non-empty string, got ${JSON.stringify(item)}`);
    }
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Result table
// ---------------------------------------------------------------------------

interface EvalResult {
  id: string;
  type: 'STAR' | 'competency';
  passed: boolean;
  errors: string[];
  durationMs: number;
}

function printTable(results: EvalResult[]): void {
  const colWidths = { id: 40, type: 12, status: 8, duration: 10 };
  const header = [
    'ID'.padEnd(colWidths.id),
    'Type'.padEnd(colWidths.type),
    'Status'.padEnd(colWidths.status),
    'Duration'.padEnd(colWidths.duration),
  ].join('  ');

  console.log('\n' + '-'.repeat(header.length));
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(
      [
        r.id.padEnd(colWidths.id),
        r.type.padEnd(colWidths.type),
        status.padEnd(colWidths.status),
        `${r.durationMs}ms`.padEnd(colWidths.duration),
      ].join('  ')
    );
    for (const err of r.errors) {
      console.log(`  ↳ ${err}`);
    }
  }
  console.log('-'.repeat(header.length));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface StarFixture {
  id: string;
  lang: string;
  description: string;
  input: string;
}

interface JdFixture {
  id: string;
  description: string;
  input: string;
}

async function runStarEvals(fixtures: StarFixture[]): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const fixture of fixtures) {
    console.log(`  Running STAR eval: ${fixture.id}...`);
    const start = Date.now();
    try {
      const raw = await callGemini(`${STAR_PROMPT}\n\nTranscript:\n${fixture.input}`);
      const draft = parseJson<StoryDraft>(raw);
      const errors = assertStarDraft(draft, fixture.id);
      results.push({ id: fixture.id, type: 'STAR', passed: errors.length === 0, errors, durationMs: Date.now() - start });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: fixture.id, type: 'STAR', passed: false, errors: [`Exception: ${msg}`], durationMs: Date.now() - start });
    }
  }
  return results;
}

async function runCompetencyEvals(fixtures: JdFixture[]): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const fixture of fixtures) {
    console.log(`  Running competency eval: ${fixture.id}...`);
    const start = Date.now();
    try {
      const raw = await callGemini(`${COMPETENCY_PROMPT}\n\nJob description:\n${fixture.input}`);
      const competencies = parseJson<string[]>(raw);
      const errors = assertCompetencies(competencies, fixture.id);
      results.push({ id: fixture.id, type: 'competency', passed: errors.length === 0, errors, durationMs: Date.now() - start });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: fixture.id, type: 'competency', passed: false, errors: [`Exception: ${msg}`], durationMs: Date.now() - start });
    }
  }
  return results;
}

async function main(): Promise<void> {
  console.log(`Prompt eval harness — model: ${MODEL}`);
  console.log('Running evals...\n');

  const starFixtures = JSON.parse(
    readFileSync(join(FIXTURES, 'star-inputs.json'), 'utf-8')
  ) as StarFixture[];

  const jdFixtures = JSON.parse(
    readFileSync(join(FIXTURES, 'jd-inputs.json'), 'utf-8')
  ) as JdFixture[];

  const [starResults, competencyResults] = await Promise.all([
    runStarEvals(starFixtures),
    runCompetencyEvals(jdFixtures),
  ]);

  const allResults = [...starResults, ...competencyResults];
  printTable(allResults);

  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;
  console.log(`\nTotal: ${allResults.length}  Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
