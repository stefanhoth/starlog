/**
 * Validates that every Gemini model ID configured in the codebase is still
 * available in the live Gemini API. Exits non-zero if any model is missing.
 *
 * Usage:
 *   GEMINI_API_KEY=<key> node scripts/check-gemini-models.mjs
 *
 * Sources checked:
 *   - GeminiModel union type in src/lib/types.ts  (user-selectable models)
 *   - Hardcoded model strings in src/lib/gemini.ts (e.g. verifyApiKey)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY env var is required.');
  process.exit(1);
}

// ── Parse configured model IDs from source ───────────────────────────────────

const typesSource = readFileSync(resolve(__dirname, '../src/lib/types.ts'), 'utf8');
const typeUnionMatch = typesSource.match(/GeminiModel\s*=\s*((?:'[^']+'\s*\|?\s*)+)/);
const configuredModels = typeUnionMatch
  ? [...typeUnionMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  : [];

const geminiSource = readFileSync(resolve(__dirname, '../src/lib/gemini.ts'), 'utf8');
const hardcodedMatches = [...geminiSource.matchAll(/model:\s*'(gemini-[^']+)'/g)];
const hardcodedModels = hardcodedMatches.map(m => m[1]);

const allModels = [...new Set([...configuredModels, ...hardcodedModels])];

if (allModels.length === 0) {
  console.error('Error: No model IDs found in source files — check the regex.');
  process.exit(1);
}

console.log('Configured models (types.ts):', configuredModels);
if (hardcodedModels.length) console.log('Hardcoded models (gemini.ts): ', hardcodedModels);
console.log('\nChecking against Gemini API…\n');

// ── Fetch available model IDs from the API ────────────────────────────────────

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`;
const res = await fetch(url);

if (!res.ok) {
  console.error(`Gemini API request failed: ${res.status} ${res.statusText}`);
  const body = await res.text().catch(() => '');
  if (body) console.error(body);
  process.exit(1);
}

const data = await res.json();
// Response shape: { models: [{ name: "models/gemini-2.5-flash", ... }] }
const availableIds = new Set(
  (data.models ?? []).map(m => m.name.replace(/^models\//, ''))
);

if (availableIds.size === 0) {
  console.error('Warning: API returned an empty model list — unexpected. Aborting check.');
  process.exit(1);
}

// ── Compare ───────────────────────────────────────────────────────────────────

let failed = false;
for (const id of allModels) {
  if (availableIds.has(id)) {
    console.log(`  ✅  ${id}`);
  } else {
    console.error(`  ❌  ${id}  — not found in API response`);
    failed = true;
  }
}

if (failed) {
  console.error(
    '\nOne or more model IDs are no longer available.' +
    '\nUpdate src/lib/types.ts and/or src/lib/gemini.ts to use current model names.' +
    '\nAvailable flash/pro models:'
  );
  for (const id of [...availableIds].filter(id => id.includes('flash') || id.includes('pro')).sort()) {
    console.error(`  - ${id}`);
  }
  process.exit(1);
}

console.log('\nAll configured model IDs are valid.');
