# StarLog — Design Decisions

Constraints that shape future work. Grounded in current code.

## Data & storage

- **IndexedDB is the source of truth** (`db.ts`, store via `idb`). DB `starlog`, version 1, two object stores: `data` (current state) and `snapshots` (one-write-behind backup). Keys: `stories`, `jobProfiles`, `settings`, `whatsNewLastSeen`.
  - *Why:* crash-resistance — an installed PWA could lose localStorage on a crash; IndexedDB plus the snapshot is durable (changelog: "Your data survives app crashes"). `main.ts` requests `navigator.storage.persist()` to avoid OS eviction.
  - *Constraint:* schema changes require a real IndexedDB migration (bump version + `upgrade`). New persisted state should follow the existing pattern (`loadWithFallback` + `persistToDB`).
- **Rolling snapshot, one write behind** (`persistToDB`): before overwriting `data[key]`, the previous value is copied to `snapshots[key]`. `loadWithFallback` reads `data`, falls back to `snapshots`, then to localStorage. *Constraint:* there is exactly one level of undo-on-corruption, not history.
- **localStorage is migration-only.** On first load, legacy keys (`starlog_stories`, etc.) are read once and migrated into IndexedDB. *Constraint:* don't reintroduce localStorage as a primary store.
- **No server, ever.** No backend, no account, no sync. This is a product promise, not just an implementation detail (privacy popover). *Constraint:* any feature implying a server (sharing, collaboration, cloud sync) is out of scope; cross-device = Export/Import only.
- **Crash-resistant backup format** (`backup.ts`): versioned `BackupBundle` (`version`, `exportedAt`, `appVersion`, `stories`, `jobProfiles`). Import validates shape and **replaces** all data (`restore`). *Constraint:* bumping `version` requires a migration path in `parseBackup`/`applyImport`. Note: the API key is intentionally **not** exported.
- **`sessionStorage` for transient UI handoff** — drafts (`starlog_draft`), gap-fill context (`starlog_gap_profile`, `starlog_gap_competency`), active profile/story, and interview mode/submode. *Constraint:* it is ephemeral and per-tab; never use it for durable data.

## AI integration

- **Google Gemini via `@google/generative-ai`, client-side only** (`gemini.ts`). Calls go browser → Google with the user's key; StarLog never proxies them.
- **Model selection** (`GEMINI_MODELS` in `types.ts`): default `gemini-3.5-flash`; user-selectable. `verifyApiKey` hardcodes `gemini-2.5-flash` for the validation ping. *Constraint:* the model list is a typed union — adding/removing models touches `types.ts` and the Settings select.
- **Structured output via JSON.** STAR extraction uses `responseMimeType: 'application/json'`, `temperature: 0.2`; inspiration questions use creative mode (`temperature: 0.8`, no JSON mime). Parsing strips markdown fences (`parseJson`) and validates shape (`assertStoryDraft`, competency array/`{competencies}` wrapper). *Constraint:* prompts are the contract — the STAR prompt fixes the JSON schema, the competency vocabulary (12-term list), and rules (English output, no invented action steps, 5–7 competencies). Changing the schema means updating both prompt and validators.
- **Input safety / limits:** JD truncated to 12k chars; inspiration competency sanitized (stripped backticks/quotes, 100-char cap); audio base64-encoded in 8k chunks; MIME falls back to `audio/webm`.
- **Error & rate-limit handling** (`GeminiError`, `withRetry`): status → typed error (400/401/403 = invalid key, non-retryable; 429 = rate limit, capped at 2 retries; 500/503 = retryable up to 4 with exponential backoff + jitter). *Constraint:* views should catch `GeminiError` and surface `.message` (they already do); don't swallow it.
- **Prompt eval harness** exists (`tests/prompts`, `npm run test:prompts`) with golden fixtures. *Constraint:* prompt changes should be checked against it.

## State management

- **Custom Svelte stores wrapping `writable`**, one per domain (`stories.ts`, `jobProfiles.ts`, `settings.ts`), each exposing CRUD plus `init`, `reset`, `restore`. Svelte 5 runes mode throughout (`$state`, `$derived`, `$effect`, `$props`, `$bindable`).
- **Async persist pattern:** every mutation updates the in-memory store synchronously and fires `persist()` to IndexedDB. `settingsStore.set()` returns the Promise so callers that must wait (e.g. `submitKey` before navigation) can await it; other mutations remain fire-and-forget. On failure, `storageError` is set (shown as a top banner). *Constraint:* treat write ordering carefully around navigation — if you navigate before a write completes, the user can reload into stale state.
- **Init sequence** (`init.ts` + `main.ts`): `initStores()` awaits stories/profiles/settings in parallel, kicks off `initWhatsNew()` non-blocking, then mounts the app. *Constraint:* the app only mounts after stores are hydrated, so `App.svelte`'s consent redirect sees real data.

## Navigation

- **Hash-based router with History API** (`view.ts`) — the app uses a real URL router. `currentView` is a `writable<View>` enum; `navigate()`, `openJob()`, `openStory()` push/replace `#/...` hashes and set the store. `parseHash`/`viewToHash` map between URL and view; `popstate` syncs back/forward.
  - *Why:* deep links and back/forward work on GitHub Pages without server config.
  - *Constraint:* `review` and `interview` use `replaceState` (transient, kept out of the back stack). The `View` enum includes legacy entries (`library`, `job-profiles`, `job-profile-detail`) kept for test/back-compat; `App.svelte` renders the modern equivalent for them. New views must be added to the enum, both mapping functions, and `App.svelte`'s render switch.
- **Profile/story identity flows through both URL and sessionStorage.** `applyRoute` mirrors `profileId`/`storyId` into sessionStorage; views read sessionStorage for active IDs. *Constraint:* keep these two in sync when adding ID-bearing views.

## Component architecture

- **`StarEditor.svelte`** — the single shared STAR editing surface used by both `Review` and `StoryDetail`. Owns click-to-edit S/T/R, action add/edit/remove/drag-reorder, readiness stars, coaching hints, and an exported `commitPending()` parents call before saving. `guardDirty` toggles confirm-on-discard. *Why:* extracted to kill duplication. *Constraint:* any new STAR-editing behavior belongs here, not in the views.
- **`StoryMapModal.svelte`** — two-column map UI (library search left, ranked primary/backup selection right). The first selected id is canonical primary. *Constraint:* primary/backup semantics live in the ordering of `competencyMap[comp]` — index 0 is primary everywhere (Job Hub, Story Bank "Used in", Interview grouping).
- **`AiWorking.svelte`** — lightweight wrapper that draws a pulsing/sweeping glow around its slot while `active`, and neutralizes the wrapped button's styling. *Constraint:* this is the standard "AI is thinking" indicator; prefer it over ad-hoc spinners for Gemini calls.
- **`BorderGlow.svelte`** — richer mesh-gradient/box-shadow glow utility (HSL parsing, eased animation). Currently a general-purpose effect component, not on the AI-call hot path.
- **Changelog split:** `changelog.ts` (data), `ChangelogList.svelte` (presentational, paginated list with `initialVisible`/"Show older"), `WhatsNewPanel.svelte` (the drawer chrome + `markSeen` on mount). `whatsNew.ts` store tracks `lastSeenDate` for the unseen badge. *Why:* `ChangelogList` is reused in both the panel and the onboarding landing without the `markSeen` side effect. *Constraint:* to ship a changelog entry, prepend to `CHANGELOG`; the newest entry's `date` drives the badge.
- **Legacy/duplicate components:** `StoryCard.svelte`, `JobProfileCard.svelte`, `StoryPicker.svelte`, `Counter.svelte` belong to superseded views. *Constraint:* prefer the modern surfaces (Story Bank table, `StoryMapModal`); treat these as deprecated.

## PWA / offline

- **`vite-plugin-pwa` with `registerType: 'autoUpdate'`** (`vite.config.ts`). Manifest: standalone display, theme `#4f46e5`, 192/512 icons (+ maskable), scope/start `/starlog/`. Workbox precaches `js,css,html,svg,png,ico,woff2`.
- **Base path differs by command:** `/starlog/` on build (GitHub Pages), `/` in dev. *Constraint:* asset paths and the GitHub release link (`__APP_VERSION__`, injected via `define`) assume this base.
- **Offline scope:** shell + existing data fully usable offline; anything requiring Gemini (capture→structure, competency extraction, AI questions) needs network. *Constraint:* don't make core read/edit/map/rehearse paths depend on the network.

## UI system

- **daisyUI 4 + Tailwind 3** with a single custom theme `starlog` (`tailwind.config.js`). Primary indigo `#4f46e5`; success/warning/error map to the coverage color language (green = covered/ready, amber = partial, red = gap/needs work).
- **No dark mode.** Only the light `starlog` theme is defined. Interview Mode is intentionally dark by using daisyUI's `neutral`/`neutral-content` tokens on a dark surface, not a theme switch. *Constraint:* a real dark mode would require defining a second theme and auditing every hardcoded color.
- **Class conventions:** semantic daisyUI tokens (`base-100/200/300`, `base-content` with opacity like `/50`, `primary`, `warning`) over raw palette. *Caveat:* some components mix in raw Tailwind colors (`indigo-*`, `slate-*`, `emerald/amber/red`), notably `StarEditor` readiness stars, the Review "fresh from AI" banner, and the legacy `StoryCard` quality dots. *Constraint:* prefer theme tokens for new work so theming stays coherent.
- **`data-testid` everywhere.** Views and interactive elements carry stable test ids consumed by the Playwright suite. *Constraint:* preserve/extend test ids when refactoring; renaming them breaks e2e tests.

## Cross-cutting terminology (consistency reference)

- **STAR** = Situation, Task, Action (a list of steps), Result. Action is always a `string[]`.
- **Competency** = a behavioural theme; the canonical 12-term list is `competencies.ts`. Job competencies are AI-extracted per profile and editable.
- **Coverage / gap:** covered = `competencyMap[comp].length > 0`; gap otherwise.
- **Primary / backup:** index 0 of a competency's mapped story list is the primary (★ "go-to"); the rest are backups.
- **Readiness** (user, 1–5 or unrated, `rank`) is distinct from **quality** (AI, per-section high/medium/low, `quality`). The active product leads with readiness; AI quality is now a single info note.
- **Story bank** = the full library surface; **Job Hub** = per-job coverage surface; **Capture / gap-fill** = the same view in two modes; **Rehearse / Interview Mode** = the same full-screen prep surface.
