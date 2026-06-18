# STARlog — Vibe Instructions

> **I automatically respect this file.** Place it in any directory; I'll read it when working on files in that directory or below.

---

## 📌 Quick Reference

| What | Where |
|------|-------|
| **Core loop** | Capture → Structure → Map → Rehearse |
| **Tech stack** | Svelte 5 (runes) + Vite 8 + TypeScript 6 + Tailwind 3 + daisyUI 4 + shadcn |
| **Persistence** | IndexedDB via `idb` (`src/lib/db.ts`) — **no backend** |
| **AI** | Gemini via `@google/generative-ai` (`src/lib/gemini.ts`) — **user brings own key** |
| **Tests** | Playwright E2E (`tests/`); Vitest unit tests for pure logic |
| **Type check** | `npm run check` (`svelte-check` + `tsc`) |

---

## 🧪 Test Strategy

**Default to unit tests (Vitest, `npm run test:unit`)** for pure logic:
- Pure functions (parsing, validation, formatting, transformation)
- Importable in Node, no DOM/IDB/browser-API dependencies
- Many input permutations to test exhaustively

**Use E2E tests (Playwright) only when needed:**
- Real browser (DOM, CSS, focus behaviour)
- Real IndexedDB (persistence across page loads)
- Cross-view user flows
- File picker / clipboard / download interactions

**Environment commands:**
- Local (Docker, mirrors CI): `npm run test:e2e`
- Cloud session: `npm run test:e2e:cloud` (self-installs Chromium)

**Rule:** Don't duplicate pure-logic coverage in both layers. Unit tests are ~100× faster.

---

## 🔄 PR Workflow

For every ticket, follow this sequence **exactly**:

1. `git fetch origin main` — get latest before starting
2. Branch from fetched `origin/main`
3. Develop and run full test suite until green (`npm run check` + tests)
4. `git fetch origin main && git rebase origin/main` — **rebase immediately before pushing**
5. `git push -u origin <branch>` — push rebased branch
6. `gh pr create` — open PR
7. Ask Stefan: **"Manual review or auto-merge?"**

**Never stop after step 3 and ask "should I open a PR?"** — assume yes, always.

---

## 🏗️ Architecture & Platform

### Stack
- **Framework:** Svelte 5 (runes: `$state`, `$derived`, `$effect`)
- **Build:** Vite 8
- **Language:** TypeScript 6
- **UI:** Tailwind CSS 3 + daisyUI 4 + shadcn components
- **Storage:** IndexedDB via `idb` (`src/lib/db.ts`)
- **AI:** `@google/generative-ai` (Gemini) — isolated in `src/lib/gemini.ts`
- **PWA:** `vite-plugin-pwa` — installable, offline-capable

### Core Files
| Purpose | Location |
|---------|----------|
| Domain types | `src/lib/types.ts` |
| Database | `src/lib/db.ts` |
| Gemini integration | `src/lib/gemini.ts` |
| Stores | `src/lib/stores/` |
| Views | `src/views/` |
| Components | `src/lib/components/` |
| Backup/export | `src/lib/backup.ts` |
| Competencies | `src/lib/competencies.ts` |

### Philosophy
- **Client-only, no backend** — deliberate strength (privacy, zero infra, zero ops)
- **Privacy promise:** Nothing leaves the browser except user-initiated Gemini calls
- **Solo-dev reality:** Ruthless prioritisation, minimal dependencies
- **Simplicity:** Complexity must earn its keep; prefer boring, obvious solutions

---

## 🎯 Product Vision

**Mission:** Help a job seeker walk into any interview with the *right* story ready.

**Core promise:** "Your experience, shaped into powerful stories."

**Target user:** Individual job seeker prepping for behavioural interviews (experienced/leadership roles).

### Five Product Principles
1. **Privacy is a feature** — all data lives in browser; no account, no server
2. **Zero friction to start** — no sign-up; only setup is pasting a valid Gemini API key
3. **Solo-dev reality** — every feature carries maintenance cost
4. **Core loop is sacred** — Capture → Structure → Map → Rehearse
5. **Coverage-model integrity** — coverage and gaps must be trustworthy

### Core Loop
1. **Capture** (`Capture.svelte`) — record audio / upload / paste text
2. **Structure** (`gemini.ts` → `Review.svelte`) — Gemini transcribes and rewrites into STAR
3. **Map** (`JobHub.svelte`, `StoryMapModal.svelte`) — map stories to job competencies
4. **Rehearse** (`InterviewMode.svelte`) — flash cards, mock interview, drill with timer

---

## 👥 Specialist Roles & Lanes

Consult these perspectives **proactively** when work touches their domain.

### 🎨 Product Manager
**Lane:** Product vision, scope/prioritisation, UX consistency, focus

**Guards:**
- Scope creep — does this serve "right story, right interview"?
- Consistency — same concept, same name, same behaviour everywhere
- Activation — is the path from empty state to first value short and obvious?
- Coverage-model integrity — coverage and gaps must be trustworthy
- Privacy as product — is the local-only promise visible where it builds trust?
- Maintenance vs. value — weigh ongoing cost against user benefit

**Docs to consult:**
- `docs/product/product-overview.md` — feature inventory, principles
- `docs/product/user-flows.md` — all significant user journeys
- `docs/product/design-decisions.md` — constraints on storage, AI, state, navigation
- `docs/product/not-doing.md` — deliberately rejected features and why

---

### 🎨 Product Designer
**Lane:** UI/UX flows, interaction feedback, accessibility, perceived performance

**Guards:**
- **Honest feedback for slow AI** — clear `AiWorking` states; user stays oriented
- **Interview Mode** — calm, legible, keyboard-first; nothing adds anxiety
- **Empty states** — guide, never strand (no jobs, no stories, no coverage)
- **Forms** — clear inline validation; save disabled until valid
- **Accessibility (required):**
  - Modals: focus trap, ESC to close, focus returns to trigger
  - Visible focus rings; logical tab order
  - ARIA roles/labels for custom controls
  - Colour is never the only signal
  - `prefers-reduced-motion` honoured
- **Consistency** — spacing/type scale, button hierarchy, component usage
- **Perceived performance** — skeletons vs. spinners, optimistic UI where safe

---

### 🤖 AI Engineer
**Lane:** Gemini integration quality, reliability, cost, latency

**Guards:**
- **Structured output robustness** — JSON/`responseSchema` mode; failure paths defined
- **Garbage-in robustness** — empty input, huge pastes, non-English text
- **Output quality** — STAR stories specific and grounded; competencies relevant and non-redundant
- **Model & params** — right cost/latency/quality point for each task
- **Cost & latency** — flag unnecessary calls, oversized prompts
- **Prompt-injection awareness** — pasted text shouldn't derail output
- **Evaluability** — prompt changes judged against golden inputs/expected shapes

**AI-driven jobs:**
- STAR extraction (rough input → structured STAR story)
- Competency extraction (job description → 5–7 behavioural competencies)
- Mapping/auto-tagging (associate stories with competencies)
- Key validation (live ping to confirm key works)

---

### 🔒 Security Advisor
**Lane:** API key safety, user data protection, privacy promise

**Trust model:** Nothing leaves the browser except user-initiated Gemini calls.

**Crown jewels:**
1. User's Gemini API key
2. User's STAR stories and job data (IndexedDB)

**Guards:**
- **API-key handling** — never logged, sent only to Gemini, never in DOM/backups
- **XSS** — audit `{@html}`, `innerHTML`, dynamic `href`/`src`, rendered Gemini output
- **Gemini requests** — only necessary data; user aware their text is sent to Google
- **Backup/export** — export is plaintext personal data; import validates, no injection
- **CSP** — limit `connect-src` to self + Google; tighten `script-src`
- **Supply chain** — audit deps (`@google/generative-ai`, `idb`, `daisyui`)
- **No accidental egress** — no analytics, beacons, CDN calls
- **Prompt injection** — flag if model output is ever trusted/executed/rendered as HTML

---

### 🏗️ Senior Engineer
**Lane:** Architecture, maintainability, Svelte 5 idioms, IndexedDB, type safety

**Guards:**
- **Simplicity & file size** — large views are maintenance hazards; split them
- **Svelte 5 correctness** — proper `$state`/`$derived`/`$effect`; no overuse
- **IndexedDB safety** — schema versioning, non-destructive migrations; **data loss is worst-case**
- **Boundaries** — `gemini.ts` isolates AI; views use stores, not direct IDB access
- **Type safety** — `npm run check` clean; no `any` smuggling; `src/lib/types.ts` is source of truth
- **Dependencies** — minimal and justified; question new deps
- **Build & PWA** — service-worker update flow; cache invalidation

---

### 🧪 Test Engineer
**Lane:** Test strategy, coverage, edge cases — **writes and runs tests**

**Guards:**
- **High-value unguarded logic:**
  - Gemini response parsing (`src/lib/gemini.ts`)
  - Backup import/export (`src/lib/backup.ts`)
  - IndexedDB schema & migrations (`src/lib/db.ts`)
  - Coverage/gap and competency-mapping logic
- **Reproduce first** — write failing test before fix
- **Follow existing conventions** — match `tests/` structure
- **Run tests** — use right command for environment; verify, never assume
- **Watch for flake** — especially IndexedDB timing; prefer explicit waits over arbitrary timeouts
- **Scope discipline** — touch test files and minimum needed; flag hard-to-test code

**Note:** This is the **only** specialist that writes code.

---

## 📁 Canonical Documentation

Always consult these before making decisions:

| Document | Purpose |
|----------|---------|
| `docs/product/product-overview.md` | Feature inventory, product principles, core loop |
| `docs/product/user-flows.md` | All significant user journeys with branches/error paths |
| `docs/product/design-decisions.md` | Constraints on storage, AI, state, navigation, components |
| `docs/product/not-doing.md` | Deliberately rejected features and reasoning |
| `CLAUDE.md` | Additional context (test commands, PR workflow, MCP notes) |

---

## 🚨 Critical Constraints

1. **No backend** — defend the static-host model
2. **Privacy promise** — nothing leaves browser except user-initiated Gemini calls
3. **IndexedDB safety** — upgrades must not lose data
4. **Type safety** — `npm run check` must pass; `src/lib/types.ts` is source of truth
5. **AI key safety** — never expose, log, or transmit the user's API key
6. **Accessibility** — required, not optional (WCAG, ARIA, keyboard navigation)

---

## ✅ Definition of Done

- [ ] Relevant tests pass (unit + E2E as appropriate)
- [ ] `npm run check` clean (`svelte-check` + `tsc`)
- [ ] PR workflow followed (rebase, push, create PR)
- [ ] Consulted relevant specialist perspectives
- [ ] Considered product principles and constraints
- [ ] Changelog updated if user-facing change (`src/lib/changelog.ts`)
