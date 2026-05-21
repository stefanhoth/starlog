# StarLog

[![CI](https://github.com/stefanhoth/starlog/actions/workflows/ci.yml/badge.svg)](https://github.com/stefanhoth/starlog/actions/workflows/ci.yml)

**Your browser-local STAR story library for job interviews.**

StarLog helps you capture, structure, and rehearse past-experience stories using the STAR format (Situation, Task, Action, Result). Speak or paste a rough description of what happened — Gemini AI turns it into a polished, interview-ready story. Map your stories to specific job postings, see coverage at a glance, and walk into any interview with the right story ready to go.

Everything stays in your browser. No account, no server, no data leaving your machine — except the Gemini API calls made with your own key.

---

## Features

- **Job-first navigation** — each job you're interviewing for lives in the sidebar. The active job's hub shows coverage at a glance.
- **Job hub** — paste a job description; Gemini extracts the 5–7 behavioural competencies the role is likely to interview on. See which are covered, which are gaps, and map existing stories to any competency in one click.
- **Gap fill** — click **+ draft** on any uncovered competency to launch a focused capture flow pre-tagged with that competency. Gemini extracts and maps the story automatically on save.
- **Capture your way** — record audio directly in the browser, upload an existing file, or paste a transcript. Gemini extracts a structured STAR story from any of them.
- **Story bank** — searchable table of all your stories. Text search covers title, competency tags, situation, and result. Click any row to open the editor.
- **Story editor** — edit any STAR field inline, manage action steps, add private notes.
- **Interview mode** — full-screen prep view with a launch pad offering three modes: **Flash cards** (keyboard-navigable card deck, ← → between stories, ↑ ↓ between competency groups), **Mock interview** (question-first, space to reveal), and **Drill with timer** (90 s target, 1–5 self-rating). Two-line action crib visible by default; click/space to expand the full STAR.
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
    components/     # StoryPicker (multi-select modal), StoryCard, JobProfileCard
    stores/         # stories, jobProfiles, settings, view (localStorage-backed)
    gemini.ts       # extractSTAR, extractCompetencies, verifyApiKey
    audio.ts        # AudioRecorder (MediaRecorder wrapper)
    competencies.ts # preset competency tag list
    types.ts        # Story, JobProfile, Settings, StoryDraft
  views/
    App.svelte        # layout shell + view router (job-first sidebar)
    Onboarding.svelte # key setup → add-first-job → review competencies
    JobHub.svelte     # per-job competency coverage + map/draft actions
    GapFill.svelte    # focused capture flow for a specific competency gap
    StoryBank.svelte  # full story table with text search
    Capture.svelte    # record / upload / text → Gemini → Review
    Review.svelte     # edit & save extracted STAR draft
    StoryDetail.svelte # inline STAR editor, rank, tags, delete
    InterviewMode.svelte # full-screen prep: flash cards / mock / timer modes
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
