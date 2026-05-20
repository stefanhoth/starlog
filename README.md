# StarLog

[![CI](https://github.com/stefanhoth/starlog/actions/workflows/ci.yml/badge.svg)](https://github.com/stefanhoth/starlog/actions/workflows/ci.yml)

**Your browser-local STAR story library for job interviews.**

StarLog helps you capture, structure, and rehearse past-experience stories using the STAR format (Situation, Task, Action, Result). Speak or paste a rough description of what happened — Gemini AI turns it into a polished, interview-ready story. Map your stories to specific job postings, see coverage at a glance, and walk into any interview with the right story ready to go.

Everything stays in your browser. No account, no server, no data leaving your machine — except the Gemini API calls made with your own key.

---

## Features

- **Capture your way** — record audio directly in the browser, upload an existing file, or paste a transcript. Gemini extracts a structured STAR story from any of them.
- **Library** — searchable, filterable card grid of all your stories. Tag by competency, rank by strength.
- **Story editor** — edit any STAR field inline, manage action steps, add private notes.
- **Job Profiles** — paste a job description and Gemini extracts the 5–7 behavioural competencies the role is likely to interview on.
- **Coverage matrix** — see which competencies you have stories for and which are gaps. Map any story to any competency in one click.
- **Re-extract** — update a job description and reconcile stories that were mapped to competencies that no longer exist.
- **Interview mode** — full-screen flashcard view. Browse all stories or drill by job profile / competency group. Keyboard-navigable (← → ↑ ↓ ESC). Two-line action crib visible by default; tap to expand the full STAR.
- **Print cheat sheet** — one keystroke generates a clean print layout with one competency per page.
- **API key validation** — live ping on the key you enter; Save is disabled until the key is confirmed working.

---

## Getting Started

### Prerequisites

- **Node.js 22+** — [nodejs.org](https://nodejs.org)
- **Gemini API key** — free tier available at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### Setup

```bash
git clone https://github.com/stefanhoth/starlog.git
cd starlog
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), enter your Gemini API key, and start capturing stories.

---

## Architecture

| Layer | Choice | Why |
|---|---|---|
| UI framework | Svelte 5 (runes mode) | Fine-grained reactivity without a VDOM; native browser APIs fit naturally |
| Styling | Tailwind CSS v3 + DaisyUI v4 | Utility-first layout, component tokens for consistent UI |
| Build | Vite 6 | Near-instant HMR in development; fast production builds |
| AI | Gemini 2.5 Flash (`@google/generative-ai`) | Multimodal (audio + text in one call); generous free tier |
| Storage | `localStorage` (stories, profiles, settings) + `sessionStorage` (navigation state) | No backend needed; data never leaves the device |
| Tests | Playwright (Chromium) | Real browser, real MediaRecorder, Gemini mocked via `page.route` |

### Data model (simplified)

```
Story {
  id, title, original_language
  star: { situation, task, action: string[], result }
  quality: { situation, task, action, result, notes }   ← AI-assessed per section
  competency_tags, rank, notes
}

JobProfile {
  id, company, role, jobDescription
  extractedCompetencies: string[]
  competencyMap: Record<competency, storyId[]>          ← same story usable across profiles
}
```

---

## Development

```bash
npm run dev          # dev server with HMR at localhost:5173
npm run check        # svelte-check + tsc (type errors)
npm run build        # production build to dist/
npx playwright test  # full e2e suite (55 tests, Chromium)
npx playwright test tests/onboarding.spec.ts  # single file
```

Test fixtures live in `tests/fixtures/`. Gemini responses are mocked — no real API key needed to run the suite.

### Project structure

```
src/
  lib/
    components/     # StoryCard, StoryPicker, JobProfileCard
    stores/         # stories, jobProfiles, settings, view (localStorage-backed)
    gemini.ts       # extractSTAR, extractCompetencies, verifyApiKey
    audio.ts        # AudioRecorder (MediaRecorder wrapper)
    competencies.ts # preset competency tag list
    types.ts        # Story, JobProfile, Settings, StoryDraft
  views/            # one file per screen
  App.svelte        # layout shell + view router
tests/
  fixtures/         # star-draft.json, competencies.json
  helpers.ts        # shared Gemini mock helper
  *.spec.ts         # one spec file per view
```

---

## CI / CD

GitHub Actions runs on every push and PR to `main`:

| Job | Trigger | Steps |
|---|---|---|
| **Quality** | push + PR | `npm run check` → `npm run build` → `npm audit` |
| **E2E** | PR only | Playwright tests in pre-baked Chromium container |
| **Deploy** | push to main | Build → publish to [GitHub Pages](https://stefanhoth.github.io/starlog/) → CalVer release tag |

Every successful deploy creates a `YYYY.MM.DD` release tag (e.g. `2026.05.20`). Multiple deploys on the same day get a numeric suffix (`.1`, `.2`, …). See [CHANGELOG.md](CHANGELOG.md) for a human-maintained history of notable changes.

Dependency updates are managed by [Renovate](https://docs.renovatebot.com) (weekly, Monday mornings CET). Dev dependency patches and minor versions automerge when CI passes. The Gemini SDK is flagged for manual review.

---

## License

MIT
