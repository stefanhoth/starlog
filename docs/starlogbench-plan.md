# STARlogBench — Implementation Plan

A benchmark harness that runs the same inputs through multiple models and has a
neutral agent panel judge the results. Terminal-driven, independent of the web app,
outputs a PDF report with charts.

**Status:** plan only — nothing implemented yet.

## Table of Contents

- [Why](#why)
- [Decisions](#decisions)
- [Phase 0 — Close the prompt drift](#phase-0--close-the-prompt-drift)
- [Phase 1 — Scaffolding](#phase-1--scaffolding)
- [Phase 2 — Stage 1: generate candidates](#phase-2--stage-1-generate-candidates)
- [Phase 3 — Stage 2: deterministic checks](#phase-3--stage-2-deterministic-checks)
- [Phase 4 — Stage 3: the judge panel](#phase-4--stage-3-the-judge-panel)
- [Phase 5 — Stages 4+5: aggregation and report](#phase-5--stages-45-aggregation-and-report)
- [Phase 6 — Cost, safety, CI](#phase-6--cost-safety-ci)
- [Verification](#verification)

## Why

STARlog lets the user pick between three Gemini models (`GEMINI_MODELS` in
`src/lib/types.ts`), but there is no evidence for which one produces better STAR
stories. The default `gemini-3.5-flash` is an assumption, not a measurement.
`.claude/agents/ai-engineer.md` asks for exactly this: *"an evaluation method so prompt
changes are judged on evidence, not vibes."*

What exists today is `tests/prompts/eval.ts` — a shape validator against **one**
hardcoded model. It answers *"is the JSON malformed?"*, not *"is the story any good?"*.

It also copies the prompts out of `src/lib/gemini.ts`, and **has already drifted**:

| Source | `original_language` line |
|---|---|
| `src/lib/gemini.ts:63` | `use exactly "de" or "en" (2-character ISO 639-1 code),` |
| `tests/prompts/eval.ts:51` | `"de or en"` |

So the eval harness has been measuring a prompt the app no longer sends. Fixing that is
a prerequisite, not a nice-to-have — otherwise STARlogBench inherits the same bug on
day one.

STARlogBench should answer four questions:

1. Which Gemini model should be the default?
2. Which model **invents** action steps the applicant cannot back up in a real interview?
3. What does quality cost per 100 stories?
4. Is it worth integrating a non-Gemini provider at all? STARlog is Gemini-only today
   (plus the on-device LiteRT path); the bench should also cover current Chinese models
   (DeepSeek, Kimi/Moonshot, Qwen, …), Mistral, and Gemma — none of them wired into the
   app — so that decision is made on evidence rather than by never asking it. This is
   evaluation only: nothing in this plan adds a provider to the app itself.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Agent framework | **Mastra** | Neutrality requires judges from more than one provider family. Mastra is model-agnostic (via the Vercel AI SDK), has agents + workflows + a scorer concept, and runs standalone in a terminal. The Claude Agent SDK is mentally closer to `.claude/agents/` but is Claude-only — a pure Claude panel judging Gemini output is precisely the bias we are trying to measure. Fallback if Mastra's footprint proves too heavy: a plain AI SDK pipeline (stages 1–3 are deterministic anyway; only the arbiter is genuinely agentic). |
| Model matrix | **3 Gemini variants (the Settings dropdown) + a broad "is it worth it" roster** | The Gemini variants answer the product question. The rest answers the build/buy-in question: current Chinese models (DeepSeek, Kimi/Moonshot, Qwen, …), Mistral, Gemma, plus a couple of Western frontier references — all config-driven, so adding a candidate is one line in `bench/src/config.ts`, not a new SDK integration. |
| Model access | **OpenRouter for everything, including Gemini** (`@openrouter/ai-sdk-provider`) | One API key, one bill, one AI-SDK-compatible interface, one request/response shape, one retry and rate-limit surface — for every candidate in the matrix, Gemini included. Simplicity and uniform preconditions were chosen deliberately over per-provider native SDKs: a benchmark that calls each model through a different client (native Google SDK, Mistral's SDK, DeepSeek's OpenAI-compatible client, …) risks measuring integration differences as much as model differences. Routing Gemini through OpenRouter too removes that variable entirely — every row in the results table was produced by the same code path. **Trade-off, stated plainly:** the Gemini leg is no longer a byte-exact replay of `getModel()` in `gemini.ts` — it's OpenRouter's translation of the same prompt, `temperature: 0.2`, and JSON-mode request onto the same underlying Gemini model, not literally the `@google/generative-ai` SDK call the app makes. Close, not identical. See Phase 2 for what that means for the "which Gemini should be default" answer. |
| Scope | **STAR extraction + competency extraction** | STAR is the core loop and the only call where hallucination does real damage — the deep rubric goes there. Competency extraction yields cheap hard metrics (vocabulary hit rate against the 12 `COMPETENCIES`). `generateInspirationQuestions` is v2. |
| Location | **its own `bench/` package** | Own `package.json` + lockfile, not part of the root `npm ci`. Keeps the agent framework, chart and PDF dependencies out of the web app's dependency tree — and therefore out of `npm audit --audit-level=high` in CI. |
| PDF | **HTML → Playwright `page.pdf()`** | Playwright is already a root devDependency and Chromium lives at `/opt/pw-browsers` in cloud sessions. Charts as hand-written inline SVG — prints cleanly, no native canvas dependencies. The HTML is a useful artifact in its own right. |

## Phase 0 — Close the prompt drift

- **New `src/lib/prompts.ts`**: move `STAR_PROMPT` and `COMPETENCY_PROMPT` here (currently
  module-private in `src/lib/gemini.ts:47-92`) and export them. Plain strings, no SDK
  import, so they can be imported from Node.
  `src/lib/gemini.ts` itself **cannot** be imported from Node: `getModel()` calls
  `get(settingsStore)`, which pulls in `./stores/settings` → `./db` → `idb`/IndexedDB.
- **`src/lib/gemini.ts`**: delete the local constants, import from `./prompts`.
- **`tests/prompts/eval.ts`**: delete the duplicates at lines 35-78, import from
  `../../src/lib/prompts.ts` (the explicit `.ts` suffix is already the convention there,
  see line 14). This removes the existing drift.
- **New `src/lib/prompts.test.ts`** (drift guard, vitest, matches the `src/**/*.test.ts`
  glob): assert that every entry in `COMPETENCIES` (`src/lib/competencies.ts`) appears
  verbatim in both prompts. The prompts hardcode the 12-item vocabulary as a literal
  rather than interpolating it — this test catches the next divergence.
- **`.gitignore`**: add `.env`, `bench/node_modules/`, `bench/runs/`. There is currently
  no `.env` entry at all; `*.local` only covers `.env.local`.

> **Note:** this shares prompts between `gemini.ts`, `eval.ts` and the bench — i.e. the
> cloud path and the things that measure it. It does **not** merge the cloud and local
> STAR prompts. `docs/ai-use-cases.md` records that `LOCAL_STAR_PROMPT` is deliberately
> kept separate and tuned for smaller models; that decision stands.

## Phase 1 — Scaffolding

```
bench/
├── package.json          # own package: mastra, ai, @openrouter/ai-sdk-provider, zod, playwright
├── tsconfig.json         # strict, ESM, NodeNext
├── .env.example          # OPENROUTER_API_KEY (the only key the bench needs)
├── README.md
├── src/
│   ├── cli.ts            # flags: --models --cases --repeats --judges --extended --dry-run --skip-generate
│   ├── config.ts         # model matrix (OpenRouter slug, family, tier), judge panel, rubric weights
│   ├── types.ts
│   ├── generate.ts       # stage 1
│   ├── checks.ts         # stage 2
│   ├── judge/{panel,rubric,grounding,pairwise,arbiter}.ts   # stage 3
│   ├── aggregate.ts      # stage 4
│   └── report/{html,charts,pdf}.ts                          # stage 5
├── fixtures/
│   ├── star-cases.json   # the existing 5 + new adversarial ones
│   ├── jd-cases.json
│   ├── golden/           # hand-written reference stories (subset)
│   └── tripwires.json    # deliberately corrupted candidates
└── runs/<timestamp>/     # gitignored: raw/, results.json, report.html, report.pdf
```

Root `package.json`: `"bench": "npm --prefix bench run bench"`.

Follow the repo's conventions: ESM (`type: module`), relative imports with no path
aliases, 2-space indent, single quotes, no linter (only `tsc`). The bench deliberately
does **not** live under `tests/` — `playwright.config.ts` sets `testDir: './tests'` and
would scan the tree.

## Phase 2 — Stage 1: generate candidates

For every `(model × fixture × repeat n)` combination, produce a candidate and write it
to disk raw (`runs/<ts>/raw/<model>__<case>__<n>.json`) — including the raw string before
parsing, token usage, and wall-clock latency.

**One access path, one prompt contract.** Every candidate — Gemini included — goes
through the same `@openrouter/ai-sdk-provider` model instance in `generate.ts`, receives
the exact same `STAR_PROMPT` / `COMPETENCY_PROMPT` from `src/lib/prompts.ts` (Phase 0)
and the same transcript concatenation, and is called with the same `temperature: 0.2`
and JSON-mode request (`response_format: { type: 'json_object' }` where the underlying
model supports it — flagged per-model in `config.ts`; a model that doesn't is a hard-check
failure to report, not something to silently work around). No `responseSchema` by
default, matching what STARlog actually ships today. One retry/backoff implementation,
one error shape, one rate-limit surface, for every row in the results table — that
uniformity is the point: the benchmark should measure model differences, not client
differences.

- **What this costs on the Gemini leg.** OpenRouter's Gemini endpoint proxies to the same
  underlying model, but it is not the `@google/generative-ai` SDK call `gemini.ts:39-44`
  makes — it's an OpenAI-compatible chat-completions translation of an equivalent
  request. So "which Gemini should be default" is answered under near-identical
  conditions to production, not a byte-exact replay of it. Worth restating if the report
  ever surprises someone: a gap between the bench's Gemini ranking and something observed
  in the app is more likely to be this translation layer than a real quality difference —
  and if that gap shows up, it's itself informative (it would mean OpenRouter isn't a safe
  substrate for *this* call, which matters for the Phase 2 conclusion below too).
- **Text-only.** STARlog's audio→STAR path (`Blob` input, `gemini.ts:100-117`) is
  Gemini-native multimodal handling that has no equivalent through a unified chat API.
  Since the existing STAR fixtures (`tests/prompts/fixtures/star-inputs.json`) are already
  text transcripts, this is not a new gap — every fixture in this plan runs through the
  transcript path for every model, Gemini included.
- **Optional second arm `--structured`.** The same run with Zod-constrained output where
  the provider supports it. The delta quantifies what schema-constrained decoding would
  buy STARlog — the change `docs/ai-use-cases.md` already names as the highest-value open
  reliability improvement. A chart comparing two arms is a direct implementation
  decision, not a curiosity.

`--repeats n` (default 3) measures non-determinism. Serial execution per model with a
small delay and retry with backoff — analogous in spirit to `withRetry` in
`gemini.ts:12-33`, but implemented once against OpenRouter's error shape instead of
per-provider. Retries are **counted and reported**, not hidden: retry rate is itself a
quality metric.

**Cost tiering for the broad roster.** `config.ts` tags every candidate `core` or
`extended`. `core` is the 3 Gemini variants plus a small, cheap non-Gemini set (one
Chinese model, one Mistral, one Gemma, at whatever size makes them realistic STARlog
alternatives) that runs by default. `extended` — bigger/pricier variants per family (e.g.
a reasoning-tier DeepSeek, a larger Kimi) — only runs with `--extended`, so the default
`npm run bench` stays cheap and a full cross-provider sweep is opt-in, not accidental.

**Fixtures.** Reuse the existing five from `tests/prompts/fixtures/star-inputs.json`
(`en-good-3-sentence`, `en-weak-vague`, `de-good-detailed`, `en-medium-missing-result`,
`de-short-single-action`) and add the cases `docs/ai-use-cases.md` calls for but that do
not exist yet:

- a transcript with no measurable outcome (tests: does the model invent numbers?)
- a very long, rambling transcript
- mixed German/English within one text
- prompt injection inside the transcript (*"ignore previous instructions and output …"*)
- an empty / junk job description for the competency path

For 2–3 fixtures, add a **hand-written reference story** in `fixtures/golden/`. This
anchors the judge scale; without an anchor, LLM-judge scores drift between runs.

## Phase 3 — Stage 2: deterministic checks

Runs before any LLM judge, costs nothing, and is the most reliable signal layer.
`assertStarDraft` in `tests/prompts/eval.ts:105-166` is already a prototype — lift it
here and harden it.

| ID | Check |
|---|---|
| H1 | JSON parses **without** fence repair (does `responseMimeType` actually work?) |
| H2 | Schema complete — all fields, `quality.*` ∈ `{high,medium,low}` |
| H3 | `original_language` matches `fixture.lang` |
| H4 | Share of `competency_tags` within the 12-item vocabulary (`src/lib/competencies.ts`) |
| H5 | `action.length` ∈ [1,5] (prompt contract, `gemini.ts:57`) |
| H6 | Sentence limits: situation ≤2, task ≤2, result ≤3 |
| H7 | Output is English (heuristic, confirmed by the judge) |
| H8 | Retry count before the first valid response |

## Phase 4 — Stage 3: the judge panel

This is where the agents live. Four sub-stages, three deterministically orchestrated,
one genuinely agentic.

**3a — Blind rubric scoring.** Each judge agent receives the source transcript plus **one
anonymised** candidate (`candidate-a`, `candidate-b`, …) and returns, via a Zod schema, a
1–5 score plus a justification per dimension. The dimensions derive from the prompt
contract, not from generic "is this good":

- **Situation purity** — does Situation contain the problem or task? (`gemini.ts:55`
  explicitly forbids it)
- **Task sharpness** — own responsibility, no overlap with Situation
- **Action fidelity** → measured separately and harder in 3b
- **Result quality** — outcome and quantification, *where present in the input*
- **Concision / interview usability** — can you say this out loud?
- **Self-assessment calibration** — does `quality.action: "low"` actually correspond to
  thin actions?
- **Overall usefulness to the applicant** (holistic)

**3b — Grounding check (the metric that matters most).** A dedicated agent decomposes
each action step into atomic factual claims and marks each `supported` / `unsupported` /
`embellished` against the source transcript. The result is a **hallucination rate per
model**, not a gut-feel score. This is the number that counts for STARlog: one invented
action step embarrasses the user in a real interview.

**3c — Pairwise comparison.** Every candidate pair per fixture is judged twice — once
A/B, once B/A. The difference between the two runs *is* the position bias, and is
reported rather than averaged away. Aggregated into a ranking via Bradley–Terry.

**3d — Arbiter (agentic).** Where judges disagree (score spread ≥ 2, or a pairwise
contradiction), an arbiter agent receives all judge justifications plus the raw text and
decides with reasons. It also writes the qualitative synthesis for the report (*"model X
systematically truncates Result"*). This is the only stage with open-ended reasoning —
deliberately, because a measuring instrument otherwise stops being reproducible.

### Neutrality guarantees

Without these an LLM-judge benchmark is worthless, so they are part of the requirement,
not a bonus:

1. **Blind** — candidates are named `candidate-a…`; model names never appear in a judge prompt.
2. **Randomised** — order shuffled per judge and per pair.
3. **Panel of ≥ 3 judges from ≥ 2 provider families.** OpenRouter makes this cheap to
   satisfy — the same `family` tag in `config.ts` that drives the model matrix (Gemini,
   DeepSeek, Mistral, Anthropic, OpenAI, …) picks the judge roster too, so the panel
   naturally spans providers without separate native keys per judge.
4. **Self-preference audit** — a judge never scores candidates from its own model family
   (checked against that same `family` tag, so it also covers a Gemini judge scoring a
   Gemini candidate, not just cross-provider pairs). Where unavoidable, the delta ("does
   judge X rate its own family higher?") is reported as its own number.
5. **Median rather than mean** across judges — robust against a single outlier judge.
6. **Inter-judge agreement** (Krippendorff's α) per dimension. α < 0.4 ⇒ the dimension is
   flagged *unreliable* in the report instead of being silently folded into a total.
7. **Tripwires** — `fixtures/tripwires.json` holds deliberately corrupted candidates: a
   fabricated action step, a Situation with a problem leak, German instead of English
   output, a competency tag outside the vocabulary. If the panel does not catch these
   reliably (target ≥ 90%), the run is not trustworthy — and the report says so at the
   top, not in a footnote.

## Phase 5 — Stages 4+5: aggregation and report

`aggregate.ts` produces `results.json` (machine-readable, diffable between runs):
Bradley–Terry ranking with confidence intervals, median rubric scores, hallucination
rate, hard-check pass rate, latency p50/p95, cost per 100 stories (read straight from
OpenRouter's per-generation cost metadata for every candidate — no price table to
maintain, see Phase 6), variance across repeats, judge agreement, tripwire hit rate.

**Load the `dataviz` skill before writing `report/charts.ts`** — required by the skill
trigger, before the first line of chart code. Planned charts:

1. **Radar** — rubric profile per model (shows character, not just rank)
2. **Bar + confidence interval** — Bradley–Terry ranking
3. **Scatter with Pareto front** — quality vs. € per 100 stories *(the chart that carries
   the default-model decision)*
4. **Bar with error bars** — hallucination rate, lower is better
5. **Heatmap** — model × fixture (shows *where* models break, e.g. the `en-weak-vague` case)
6. **Latency** p50/p95
7. **Variance** across n repeats (determinism)
8. **Benchmark health** — judge agreement matrix + tripwire hit rate

`report/pdf.ts`: render HTML → Playwright Chromium → `page.pdf({ format: 'A4',
printBackground: true })`. In cloud sessions set `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`,
as `test:e2e:cloud` does. Terminal output stays alongside it: a compact table in the style
of `printTable()` (`eval.ts:198-226`), so a run says something useful without opening the PDF.

## Phase 6 — Cost, safety, CI

- **`--dry-run`** estimates call count and cost with no API access — for the full
  `--extended` roster (generation + judge panel) this multiplies fast, so the estimate is
  the first thing the CLI prints, before anything else. Above a threshold the CLI asks
  for confirmation. **`--skip-generate`** re-judges cached raw output without
  regenerating — judge iteration then costs almost nothing.
- **Keys** from `process.env` (repo convention, see `eval.ts:20` and
  `scripts/check-gemini-models.mjs:19`): a single `OPENROUTER_API_KEY` covers every
  candidate and every judge, generation and grading alike — there is no second key to
  provision. Hard exit with an instructional message when it's missing. `bench/.env`
  optional and gitignored.
- **Pricing.** OpenRouter reports per-generation cost in its response metadata for every
  candidate, Gemini included, so `aggregate.ts` reads actual spend directly. No
  hand-written price table anywhere in `config.ts` — one less thing to keep in sync with
  a roster that changes often.
- **No real user data.** All fixtures are synthetic; the bench never reads IndexedDB. The
  `security-advisor` agent should review the key handling and `.gitignore` before the PR.
- **CI**: new workflow `.github/workflows/bench.yml`, `workflow_dispatch` only — no cron,
  no PR trigger. The run costs money and produces a report for a human to read, not a
  gate; nothing should fire it automatically. Modelled on `check-gemini-models.yml` for
  the Node/secrets plumbing (Node from `.nvmrc`, a single `OPENROUTER_API_KEY` secret,
  plus a `workflow_dispatch` input for `--extended` so the expensive roster stays an
  explicit choice per run) but without its
  schedule trigger. Upload `report.pdf` (and `results.json`) via
  `actions/upload-artifact` so every manual run leaves the report attached to the run,
  retrievable without re-running the bench.
- Reference `bench/` from `tsconfig.node.json` or type-check it via its own `tsconfig.json`;
  `npm run check` currently covers neither `tests/` nor `scripts/`.
- No changelog entry (`src/lib/changelog.ts`): developer tooling, not a user-facing change.

## Verification

**Phase 0 (checkable immediately, no API key):**

```bash
npm run check        # must stay green after the prompt refactor
npm run test:unit    # includes the new prompts.test.ts drift guard
```

Additionally: `git diff` on `src/lib/gemini.ts` should show only the import change — the
prompt strings must remain byte-identical, or the refactor has changed app behaviour.

**Bench:**

```bash
cd bench && npm install
npm run bench -- --dry-run                                    # cost estimate, no API calls
npm run bench -- --models google/gemini-2.5-flash --cases en-good-3-sentence --repeats 1 --judges 1
npm run bench                                                 # full run
```

**Acceptance criteria**, in this order, before the PR:

1. The smoke run produces `runs/<ts>/report.pdf` with legible charts.
2. **Tripwire hit rate ≥ 90%** — otherwise the panel is not fit for purpose and the rubric
   prompts must be sharpened before any model ranking is claimed.
3. Inter-judge α is reported for every dimension; dimensions below 0.4 are flagged
   unreliable in the report.
4. Two runs with identical config produce the same ranking (top-1 stable) — otherwise
   `--repeats` is too low.
5. `results.json` contains the raw output for every candidate, so every number in the PDF
   traces back to a concrete model response.

Finally, fan out to `ai-engineer` (rubric and grounding prompts), `senior-engineer`
(package separation) and `security-advisor` (keys), as CLAUDE.md prescribes for
non-trivial changes.
