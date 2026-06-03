# StarLog — Product Overview

## What StarLog is

StarLog is a **browser-local STAR story library for job interviews**. The mission is simple: help a job seeker walk into any interview with the *right* story ready.

A user tells StarLog about things that happened in their career — by speaking, uploading audio, or pasting a rough description. Gemini turns each into a polished STAR story (Situation, Task, Action, Result). Stories live entirely in the browser. The user pastes a job description, Gemini extracts the behavioural competencies that role will test, and the user maps stories to competencies to see coverage and gaps at a glance. Then they rehearse in a dedicated Interview Mode.

- **Core promise:** "Walk into every interview with the right story." (Onboarding hero, `Onboarding.svelte`.)
- **Target user:** an individual job seeker preparing for behavioural interviews — skewing toward experienced / leadership roles, evidenced by the competency vocabulary (`Leadership`, `Manager of Managers`, `Stakeholder Management`, `Hiring`) in `src/lib/competencies.ts`.
- **Tagline:** "Your experience, shaped into powerful stories." (used across the page title, meta/OG/Twitter descriptions, and PWA manifest.)

## The five product principles

1. **Privacy is a feature, not just a security detail.** All data — stories, job profiles, and the API key — lives in the browser (IndexedDB, with localStorage migration). There is no account and no server. The onboarding privacy popover and security popover (`Onboarding.svelte`) make this an explicit selling point: "Your data never leaves your device", "No StarLog account means no StarLog database that could be breached." API calls go directly from the browser to Google.
2. **Zero friction to start.** No sign-up. The only setup is pasting a Gemini API key, which is validated live before the user can proceed (`submitKey` is gated on `verifyStatus === 'ok'`). From key entry the user is taken straight to adding their first job.
3. **Solo-dev reality.** Every feature carries a maintenance cost. The codebase is deliberately small — one router, three persisted stores, one AI module, ~8 views.
4. **The core loop is sacred.** Capture → Structure → Map → Rehearse. Every shipped surface serves one of these four steps.
5. **Coverage-model integrity.** The job-first promise only works if coverage and gaps are trustworthy. A competency is "covered" when at least one story is mapped to it (`competencyMap[c].length > 0`); the first mapped story is the **primary** answer, the rest are **backups**. This single rule drives the coverage count in Job Hub, the sidebar percentage, and Interview Mode grouping.

## The core loop

**Capture** (`Capture.svelte`) — The user records audio in-browser, uploads an audio file (mp4/m4a/webm/mp3/wav), or pastes/types a transcript. Optional inspiration prompts (static per-competency questions in `inspiration.ts`, or AI-generated punchy questions) help them recall concrete detail. The raw input is sent to Gemini.

**Structure** (`gemini.ts` → `Review.svelte`) — Gemini transcribes (if needed) and rewrites the input into a STAR story in English, returning a title, `original_language`, 1–3 competency tags, the four STAR sections (with Action as a list of steps), and a per-section quality self-assessment with notes. The draft lands in Review, where the user edits any field inline and saves to the Story Bank.

**Map** (`JobHub.svelte`, `StoryMapModal.svelte`) — The user pastes a job description; Gemini extracts 5–7 behavioural competencies. In the Job Hub, each competency shows as covered (✓ with primary story title + backup count) or a gap (dashed warning row with "+ draft" and "map existing"). The user maps existing stories (ranking primary/backups) or drafts a new story to fill a gap, which is auto-tagged and auto-mapped to that competency on save.

**Rehearse** (`InterviewMode.svelte`) — A full-screen prep surface with a launch pad offering three modes: Flash cards, Mock interview, and Drill with timer. Stories are grouped by competency (for a job profile) or shown as a flat list (from the Story Bank).

## Feature inventory by surface

### Onboarding / Settings (`Onboarding.svelte`)
| Feature | Description | Status |
|---|---|---|
| Marketing landing + STAR primer | Two-column hero explaining the value prop and the STAR acronym for new users. | Shipped |
| API key entry + live validation | Key must start with `AIza`; a debounced `verifyApiKey` ping confirms it works before Save is enabled. | Shipped |
| Model selection | Choose a Gemini model (`GEMINI_MODELS`); persisted to settings. | Shipped |
| Security & privacy popovers | "Why your own key?" and "Your data never leaves your device" explainers. | Shipped |
| "How it works" modal | Explains the two usage patterns (job-first and story-first). | Shipped |
| What's New disclosure on landing | Collapsible changelog teaser on the marketing screen. | Shipped |
| First-job entry + competency review | Step 2/3 of onboarding: paste JD → extract → edit competencies → save. | Shipped |
| Settings mode | Reuses the same component (when `consentGiven`) as a compact key/model update card with a link to the Data section. | Shipped |

### Job Hub (`JobHub.svelte`)
| Feature | Description | Status |
|---|---|---|
| Per-competency coverage list | Each extracted competency shown as covered (primary + backup count) or gap. | Shipped |
| Coverage counter | `coveredCount / total` with success/warning/error color. | Shipped |
| Draft to fill a gap | "+ draft" launches gap-fill capture pre-tagged with the competency. | Shipped |
| Map existing story | Opens `StoryMapModal` to assign/rank stories. | Shipped |
| Expandable ranked list + reorder | Per-competency, view and reorder primary/backups with ↑/↓. | Shipped |
| Edit job profile | Modal to edit role, company, and competencies after creation; remaps cleanly. | Shipped |
| Start interview prep CTA | Appears once ≥1 competency is covered; launches Interview Mode for the profile. | Shipped |

### Story Bank (`StoryBank.svelte`)
| Feature | Description | Status |
|---|---|---|
| Story table | Title, tags, readiness, and "Used in" job mappings per row. | Shipped |
| Text search | Matches title, tags, situation, result. | Shipped |
| Sort by readiness | Least-ready first (unrated first, then rank 1→5); toggleable. | Shipped |
| "Used in" popover | Shows which job/competency a story serves and whether it's go-to or backup. | Shipped |
| Review (rehearse) entry | Launches Interview Mode in library mode / flash-card submode. | Shipped |
| New Story | Clears gap-fill session keys, then opens Capture. | Shipped |

### Capture (`Capture.svelte`)
| Feature | Description | Status |
|---|---|---|
| Record tab | In-browser MediaRecorder capture with elapsed timer. | Shipped |
| Upload tab | Audio file upload. | Shipped |
| Text tab | Paste/type transcript with a min-length (50 char) warning. | Shipped |
| Inspiration prompts | Per-competency static questions; gap-aware default in normal mode. | Shipped |
| AI inspiration questions | Gemini generates 3 punchy questions for a competency. | Shipped |
| Gap-fill mode | Breadcrumbed variant that pre-tags and auto-maps to a competency. | Shipped |

### Review & Story Detail (`Review.svelte`, `StoryDetail.svelte`, `StarEditor.svelte`)
| Feature | Description | Status |
|---|---|---|
| Inline STAR editor | Click any section (S/T/R) to edit; coaching hints appear while editing. | Shipped |
| Action steps | Add, edit, remove, and drag-to-reorder numbered action steps. | Shipped |
| Title click-to-edit | Inline title editing. | Shipped |
| Competency tag picker | Add/remove tags from the preset list; first tag is "primary" (★). | Shipped |
| Readiness rating | 1–5 stars ("not ready" … "nailed it") or unrated. | Shipped |
| AI quality verdict | `quality.notes` shown as an info banner. | Shipped |
| Dirty-state guard | Review uses `guardDirty` to confirm before discarding edits. | Shipped |
| Personal notes | Free-text private notes (Story Detail only). | Shipped |
| Delete with confirm | Delete a story behind a confirmation modal. | Shipped |

### Interview Mode (`InterviewMode.svelte`)
| Feature | Description | Status |
|---|---|---|
| Launch pad | Mode picker + competency summary; entry from Job Hub or Story Bank. | Shipped |
| Flash cards (`read`) | Keyboard-navigable deck: ←→ stories, ↑↓ competency groups, space to expand full STAR. | Shipped |
| Mock interview (`train-question`) | Question-first ("Tell me about a time you demonstrated X"), think-timer, space to reveal. | Shipped |
| Drill with timer (`train-timer`) | 90s target bar with over-time indicator, 1–5 self-rating. | Shipped |

### Data (`Data.svelte`)
| Feature | Description | Status |
|---|---|---|
| Storage summary | Story and profile counts; "no server, no account" reassurance. | Shipped |
| Export backup | Downloads a versioned `.starlog.json` bundle. | Shipped |
| Import / restore | Validates and replaces all data behind a confirmation. | Shipped |
| Clear all data | Danger-zone wipe of stories, profiles, and API key. | Shipped |

### App shell (`App.svelte`)
| Feature | Description | Status |
|---|---|---|
| Desktop sidebar | Jobs list (with coverage %), + add job, Story bank, Rehearse, Data, Settings, What's New, version link. | Shipped |
| Mobile bottom nav | Jobs / Stories / Capture / Settings. | Shipped |
| What's New panel + unseen badge | Right-side drawer; badge clears once the latest entry is seen. | Shipped |
| Storage error banner | Top alert when a persist call fails. | Shipped |
| PWA install | Installable, offline-capable via service worker. | Shipped |

## Known gaps and deferred features

- **Self-ratings in Drill mode are not persisted.** The 1–5 rating in `train-timer` (`selectedRating`) updates UI only; it is never written back to the story's `rank`. This is a coverage-model gap: rehearsal feedback doesn't flow into the readiness model that Story Bank sorts on.
- **Quality "legend" drift.** `StoryCard.svelte` surfaces an AI-quality color dot (green/amber/red) that no primary view shows; the active product leads with user **readiness** stars instead. `Counter.svelte` is a leftover scaffold component.
- **No multi-device sync by design.** Stated explicitly in the privacy popover; Export/Import is the only cross-device path.

For ideas we have **deliberately decided against** (and the reasoning), see [`not-doing.md`](not-doing.md).
