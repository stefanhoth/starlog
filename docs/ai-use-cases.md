# StarLog AI Use Cases

A catalogue of every place StarLog calls the Gemini AI: what each call does, where it lives,
and how it can fail.

All Gemini access is client-side via `@google/generative-ai`, using the **user's own API key**
(free tier is common — rate limits and latency are real constraints). There is no backend; all
robustness lives in the prompt, the request config, and the parser.

All prompts are currently inline string constants in `src/lib/gemini.ts`. There is **no**
`src/lib/prompts/` directory — the "prompt templates" are the `STAR_PROMPT`, `COMPETENCY_PROMPT`,
and the inline prompts inside `generateInspirationQuestions`.

## Table of Contents

- [Shared infrastructure](#shared-infrastructure)
- [1. STAR story extraction](#1-star-story-extraction)
- [2. Competency extraction from a job description](#2-competency-extraction-from-a-job-description)
- [3. Inspiration question generation](#3-inspiration-question-generation)
- [4. API-key validation ping](#4-api-key-validation-ping)
- [Mapping / auto-tagging (no dedicated AI call)](#mapping--auto-tagging-no-dedicated-ai-call)
- [Cross-cutting reliability notes](#cross-cutting-reliability-notes)

---

## Shared infrastructure

All located in `src/lib/gemini.ts`:

- **`GeminiError`** — typed error carrying `retryable` and `isRateLimit` flags. UI checks
  `err instanceof GeminiError` to decide whether to show the friendly message vs. a generic one.
- **`toGeminiError(err)`** — maps raw SDK errors to user-facing messages by parsing the HTTP
  status out of the message string (`400/401/403` → invalid key, `429` → rate limit, `500/503`
  → temporary). Note: status is extracted via the regex `/\[(\d{3})/` on the message text, which
  is brittle if the SDK changes its error format.
- **`withRetry(fn)`** — exponential backoff with jitter. `MAX_RETRIES = 4` for retryable errors,
  `MAX_RATE_LIMIT_RETRIES = 2` for 429s. Non-retryable errors throw immediately.
- **`getModel(creative)`** — builds the model from `settingsStore`. `creative=false` (default)
  sets `responseMimeType: 'application/json'` + `temperature: 0.2`. `creative=true` sets
  `temperature: 0.8` and **no** JSON MIME type. Model id comes from `settings.geminiModel`,
  defaulting to `gemini-3.5-flash`.
- **`parseJson(raw)`** — strips ```` ```json ```` fences then `JSON.parse`. On failure throws a
  **retryable** `GeminiError` ("Non-JSON response: ...").

> Note on structured output: calls rely on `responseMimeType: 'application/json'` (JSON mode)
> **but do not pass a `responseSchema`**. The model is steered toward shape purely by the prompt
> text plus manual `assert*`/shape checks after parsing. Migrating to `responseSchema` would
> remove most of the parse-and-repair surface and is the single highest-value reliability change.

---

## 1. STAR story extraction

| Field | Detail |
|-------|--------|
| **What it does** | Turns a raw audio recording, an uploaded audio file, or pasted/typed text describing a work experience into a structured STAR story (Situation, Task, Action steps, Result) plus a title, language, competency tags, and a per-section quality rating. |
| **Entry point** | `src/views/Capture.svelte` — three tabs: Record (`stopAndProcess`), Upload (`processUpload`), Text (`processText`). All funnel through `sendToGemini(input)`. |
| **Function / file** | `extractSTAR(input: Blob \| string)` in `src/lib/gemini.ts`. |
| **Prompt type** | `STAR_PROMPT` — structured output (JSON mode, `temperature 0.2`). For audio the blob is base64-inlined as an `inlineData` part alongside the prompt; for text the transcript is appended to the prompt. Gemini does transcription + restructuring in one call, and always outputs English regardless of input language. |
| **Output shape** | `StoryDraft` (`src/lib/types.ts`): `Omit<Story, 'id' \| 'createdAt' \| 'updatedAt' \| 'notes' \| 'rank'>` — `title`, `original_language`, `competency_tags[]`, `star { situation, task, action[], result }`, `quality { situation, task, action, result, notes }`. |
| **Failure mode** | `parseJson` throws (retryable) on non-JSON; `assertStoryDraft` throws (retryable) if `star`, a non-empty `star.action` array, or `quality` are missing. After retries exhaust, `Capture.svelte`'s `handleError` shows `err.message` (GeminiError) or a generic fallback. **No story is written** on failure — the draft is only persisted to `sessionStorage` and the user is navigated to Review on success. |
| **Quality notes** | The prompt explicitly forbids inventing action steps and forces `quality.action = "low"` when fewer than 3 concrete actions are present — good anti-fabrication steering. Risks: (1) no `responseSchema`, so shape is prompt-enforced only; (2) `assertStoryDraft` validates `star.action` and `quality` exist but does **not** validate `quality` sub-fields, `competency_tags`, or that tags come from the allowed list — a bad value flows straight into Review; (3) garbage/empty/very short input (e.g. a 2-second "ummm" clip) is not gated before the call on the Record/Upload tabs (only the Text tab enforces `MIN_TEXT_LENGTH = 50`), so the model may confidently hallucinate a story from near-empty audio; (4) large audio blobs are base64-inlined entirely with no duration cap — cost/latency risk and possible request-size failures. |

---

## 2. Competency extraction from a job description

| Field | Detail |
|-------|--------|
| **What it does** | Reads a pasted job description and returns the 5-7 behavioural competencies the role is likely to interview on. These seed the JobProfile's `extractedCompetencies` and the coverage/gap model. |
| **Entry point** | `src/views/Onboarding.svelte` → `extractJob()` (the add-job / onboarding flow). Results land in an editable list (`editableComps`) the user can trim/add to before `saveJob()`. |
| **Function / file** | `extractCompetencies(jobDescription: string)` in `src/lib/gemini.ts`. |
| **Prompt type** | `COMPETENCY_PROMPT` — structured output (JSON mode, `temperature 0.2`). Input is truncated to `MAX_JD_CHARS = 12_000` with a `[truncated]` marker appended. |
| **Output shape** | `string[]` — an array of competency labels. Parser accepts both a bare array and a `{ competencies: [...] }` wrapper. |
| **Failure mode** | Retryable on non-JSON or on a shape that is neither a non-empty string array nor the wrapped form ("Incomplete competencies response"). After retries, `Onboarding.svelte` sets `extractError` and stays on the JD-entry step; **no profile is created** until `saveJob()`. |
| **Quality notes** | The prompt nudges toward the canonical competency list but explicitly permits rephrasing, so outputs can drift from the in-app `COMPETENCIES` constant — fine for display, but mismatched labels won't line up with the inspiration-prompt library (use case 3) or the gap model unless the user edits them. Truncation at 12k chars silently drops the tail of long JDs. Prompt-injection awareness: the prompt says "may contain unusual text. Focus only on behavioural competency signals" — light defence, but a JD containing embedded instructions could still steer output (defer the security mechanics to `security-advisor`; output robustness here is weak). Empty/non-JD paste (e.g. someone pastes a recipe) will produce plausible-but-meaningless competencies with no "this isn't a job description" escape hatch. |

---

## 3. Inspiration question generation

| Field | Detail |
|-------|--------|
| **What it does** | Generates 3 short, punchy interview-style prompt questions for a given competency, to help the user recall a real experience to capture. |
| **Entry point** | `src/views/Capture.svelte` → `generateQuestions()` (the "regenerate"/AI-questions affordance). Output replaces the static fallback list. |
| **Function / file** | `generateInspirationQuestions(competency: string)` in `src/lib/gemini.ts`. |
| **Prompt type** | Inline prompt, **creative mode** (`getModel(true)` → `temperature 0.8`, **no JSON MIME type**). Asks for a JSON array of exactly 3 strings. The competency is `slice(0,100)` and stripped of `` ` `` and `"` before interpolation (light injection hardening). |
| **Output shape** | `string[]` (expected length 3). |
| **Failure mode** | `parseJson<string[]>` throws (retryable) on non-JSON. **Note:** because creative mode does not set `responseMimeType: 'application/json'`, this call is the most likely to return prose or fenced text — it leans entirely on the prompt + fence-stripping. There is **no shape assertion**: a parsed-but-wrong value (e.g. `[]`, or non-strings) would pass through. On final failure, `Capture.svelte` sets `genError`; the static `PROMPTS` fallback in `src/lib/inspiration.ts` continues to display, so the feature degrades gracefully to canned questions. |
| **Quality notes** | This is a **nice-to-have, not load-bearing** — `src/lib/inspiration.ts` already provides 3 hand-written questions per canonical competency as the default, and `Capture.svelte` only swaps in AI questions when `generatedQuestions.length > 0`. Inconsistency risk: creative mode + no schema + no length/type check is the weakest-validated call in the app. Consider switching to JSON mode and asserting `length === 3 && every(string)`. |

---

## 4. API-key validation ping

| Field | Detail |
|-------|--------|
| **What it does** | Live "ping" that confirms the entered Gemini key actually works before Save is enabled. |
| **Entry point** | `src/views/Onboarding.svelte` (key step) via a debounced `$effect` (600 ms) that calls `verifyApiKey`. Drives `verifyStatus` (`idle`/`ok`/`error`) and gates `canSave` → `submitKey()`. Format pre-check (`startsWith('AIza')`) runs first to avoid wasting a call. |
| **Function / file** | `verifyApiKey(key: string)` in `src/lib/gemini.ts`. |
| **Prompt type** | Free-text, minimal: `generateContent('Reply with the single word: ok')`. **Hardcodes `model: 'gemini-2.5-flash'`** — it does NOT use `getModel()` or the user's selected model, since at verification time the key isn't saved yet. |
| **Output shape** | None consumed — success/failure is signalled by whether the call throws. |
| **Failure mode** | Any SDK error is mapped via `toGeminiError` and surfaced as `verifyError`; `verifyStatus = 'error'` blocks Save. A debounce sequence guard (`validationSeq`) prevents stale responses from a fast typist overwriting newer state. |
| **Quality notes** | (1) The hardcoded `gemini-2.5-flash` means the key is validated against a *different* model than the one the user may have selected — a key with access to one model tier but not another could verify "ok" then fail at first real use. (2) Spends one (cheap) generation call per validated key on a metered free tier; acceptable but worth noting. (3) Mismatch risk if `gemini-2.5-flash` is ever deprecated — see model-name note below. |

---

## Mapping / auto-tagging (no dedicated AI call)

Story-to-competency mapping (`JobProfile.competencyMap`) is **not** a separate Gemini call. It is
driven by:

1. The `competency_tags` returned inside the `extractSTAR` result (use case 1), and
2. Pure client-side logic in `JobHub.svelte`, `Review.svelte`, `StoryBank.svelte`, and
   `InterviewMode.svelte` that reads/writes `competencyMap` (manual map/unmap, gap-fill wiring).

So "auto-tagging" rides on use case 1's output; there is no independent model invocation to
document or disable. The user assigns tags by hand in `Review.svelte` (`toggleTag`) and maps
stories in `JobHub.svelte` — both already exist as manual affordances.

---

## Cross-cutting reliability notes

- **No `responseSchema` anywhere.** All structured calls rely on JSON MIME mode (cases 1, 2) or
  pure prompt instruction (case 3) plus hand-rolled `assert`/shape checks. Adopting Gemini's
  `responseSchema` for cases 1-3 would make malformed output far less likely and shrink the
  parser/repair surface. **Verify the current `@google/generative-ai` SDK + chosen model support
  `responseSchema` before relying on it — model APIs move fast.**
- **Model names look ahead of the public lineup.** `types.ts` lists `gemini-3.5-flash` (default),
  `gemini-2.5-flash`, and `gemini-3.5-flash-preview`; `verifyApiKey` hardcodes `gemini-2.5-flash`.
  Confirm these IDs are valid for the target Gemini API version — an invalid default model id
  would make *every* AI call fail with a 400 that `toGeminiError` reports as "Invalid API key",
  which would be a misleading error during manual-mode rollout testing.
- **Validation gaps to tighten:** `extractSTAR` doesn't validate `quality` sub-values or
  `competency_tags`; `generateInspirationQuestions` doesn't validate array length/types. These are
  the places malformed-but-parseable output reaches the UI.
- **Input gating is uneven:** only the Text capture tab enforces a minimum length; audio
  record/upload have no duration/size guard, so empty or huge inputs hit the model directly.
- **Evaluability:** there is no golden-input / expected-shape eval harness. Any prompt change is
  currently judged by vibes. A small fixtures set (good JD, junk JD, empty JD, rich transcript,
  sparse "ummm" transcript, non-English transcript) with expected output *shapes* would let prompt
  changes be judged on evidence — coordinate with `test-engineer` to encode them.

