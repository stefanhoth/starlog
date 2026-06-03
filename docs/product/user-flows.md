# STARlog — User Flows

Notation: each flow is a numbered happy path with branch notes for empty/error states. View files in parentheses.

## 1. First-time setup (`Onboarding.svelte`, `App.svelte`)

1. App loads. `main.ts` runs `initStores()`, then mounts. Because `settings.consentGiven` is false, `App.svelte` redirects to `onboarding`; the view is rendered full-screen.
2. User sees the marketing landing (left: pitch + STAR primer; right: "Connect Gemini AI" key form). Optional: open privacy popover, security popover, "How it works" modal, or expand "See what's new".
3. User pastes an API key. A debounced `$effect` validates:
   - **Branch — wrong format:** key not starting with `AIza` → inline `formatError`, no network call.
   - **Branch — invalid key:** `verifyApiKey` throws → `verifyStatus = 'error'` with the Gemini message ("Invalid API key…").
   - **Branch — rate-limited / network:** typed `GeminiError` surfaced.
   - **Success:** "✓ Key is valid and working." Save ("Get Started →") enables.
4. User clicks Get Started. `submitKey` awaits the settings write, then navigates to `add-job` (no profiles yet) or `job-hub`.
5. **Step job-entry:** Progress shows "API key connected · Add a job". User optionally enters role/company and pastes a JD.
   - **Branch — empty JD:** Extract button disabled.
   - **Branch — extraction error:** `extractError` alert; user retries.
   - **Branch — skip:** "Skip" → `job-hub` (if a profile exists) or `story-bank`.
6. **Step job-review:** Gemini-extracted competencies shown editable. User removes/adds competencies, then "Save · open job hub →" (`saveJob` → `openJob`).
7. User lands in Job Hub with all competencies shown as gaps (no stories yet).

## 2. Add a new job profile (`Onboarding.svelte` in `addJobMode`)

1. From the sidebar "+ add job" (or mobile Jobs when no active profile) → `navigate('add-job')` → `Onboarding` mounts with `addJobMode`, skipping the key step, starting at `job-entry`.
2. Enter optional role/company, paste JD, "Extract competencies →".
   - **Branch — error/empty:** as in flow 1, step 5.
3. Review/edit competencies → Save. `addJobProfile` creates the profile (empty `competencyMap`) and `openJob` navigates to its hub.

## 3. Capture a new story (`Capture.svelte` → `Review.svelte`)

Entry points: Story Bank "+ New Story" (clears gap session keys), mobile Capture nav, or Job Hub "+ draft" (gap-fill mode).

1. Capture view opens on the **Record** tab (also Upload, Text).
2. **Record:** Start Recording (`AudioRecorder.start`).
   - **Branch — mic denied:** "Could not access microphone. Check browser permissions."
   - Stop & Process → blob sent to Gemini; button shows AI-working glow + "Processing…".
3. **Upload:** select an audio file → "Extract STAR".
4. **Text:** type/paste a transcript.
   - **Branch — too short (<50 chars):** warning hint, but submit still allowed once non-empty.
5. `sendToGemini` calls `extractSTAR`. In gap-fill mode the gap competency is force-prepended to the draft's tags. Draft is stored in `sessionStorage` and navigates to `review`.
   - **Branch — Gemini error:** `errorMsg` alert (rate limit, invalid key, malformed JSON, incomplete STAR), dismissible; user stays in Capture.
6. Optional throughout: pick a competency to see inspiration questions, or "I need different ideas" for AI questions.
   - **Branch — AI question error:** inline `genError`.

## 4. Edit a STAR story (`StoryDetail.svelte` + `StarEditor.svelte`)

1. Open a story from Story Bank row click (`openStory`).
   - **Branch — story missing:** `$effect` redirects to `story-bank`.
2. Edit title inline (✏ edit → Enter saves, Esc cancels).
3. Edit any STAR field: click S/T/R to open a textarea with a coaching hint; Enter saves, Esc cancels. Each commit persists via `oncommit → save`.
4. Action steps: click to edit, ✏/✕ on hover, "+ Add step", drag ⋮⋮ to reorder.
5. Set readiness 1–5 stars (or clear). Add/remove competency tags. Edit personal notes (saves on blur).
6. Save button commits any pending inline edit then `updateStory`. Delete → confirm modal → `deleteStory` → back to Story Bank.
- **Review variant:** same `StarEditor` with `guardDirty` (confirm-on-discard) and a "fresh from AI" banner; "Save to Library" calls `addStory`. If in gap-fill, the new story is auto-mapped as primary for the gap competency and returns to Job Hub; otherwise returns to Story Bank.

## 5. Map stories to a job (`JobHub.svelte` + `StoryMapModal.svelte`)

1. In Job Hub, each competency row is covered (✓ + primary title + "· N backups") or a gap (dashed warning + "no story yet").
2. **Map existing:** click "map existing" / "edit" → `StoryMapModal`.
   - Left: searchable story library (title/tag search). Right: selected list; first = ★ Primary, rest = #N Backup.
   - Add (+ add), remove (✕), promote (↑ to primary). Save writes `competencyMap[comp] = ids`.
   - **Branch — no stories:** "No stories in library yet." **Branch — no search match:** "No stories match your search." Esc or backdrop click cancels.
3. **Reorder mapped:** expand a covered row (▼) and use ↑/↓ to reorder primary/backups (`reorderMapping`).
4. **Draft a gap:** "+ draft" stores gap profile/competency in session and navigates to gap-fill (flow 3 + 4 Review variant).
5. Coverage counter and sidebar % update live from `competencyMap`.
   - **Branch — no competencies extracted:** info alert suggesting re-adding the job with a full JD.
   - **Branch — no profile:** empty state with "Add your first job".

## 6. Interview Mode — three sub-modes (`InterviewMode.svelte`)

Entry: Job Hub "Start interview prep →" (mode `profile`), Story Bank "Review" (mode `library`), or sidebar "Rehearse" (launch pad). Stories are grouped by competency (profile) or one flat group (library), filtering out empty groups.

1. **Launch pad:** header + mode cards + competency summary.
   - **Branch — no mapped stories:** "No stories mapped yet." with a Go to Job Hub button.
2. **Flash cards (`read`):** card shows title + 2-line action crib; space/click expands full STAR. Keyboard: ←→ stories (wraps with a flash), ↑↓ competency groups, Esc exits. Position shown as `current / total`.
3. **Mock interview (`train-question`):** shows "Tell me about a time you demonstrated {competency}." with a running think-timer. Space reveals the story (stops timer); → next question. Esc exits.
4. **Drill with timer (`train-timer`):** 90s target progress bar (warning segment when over), play/pause, full STAR card, 1–5 self-rating (keys 1–5).
   - **Known gap:** rating is not saved back to the story's `rank`.
   - Space toggles timer, → next, Esc exits.
5. Exit returns to Job Hub (profile) or Story Bank (library).

## 7. Returning user: settings update (`Onboarding.svelte` settings mode)

1. Sidebar "⚙ Settings" (or mobile Settings) → `navigate('onboarding')`. Since `consentGiven` is true, the compact Settings card renders.
2. Update API key (same live validation) and/or model (saved on change via `saveModelSelection`). Save (gated on a valid key) or Cancel → `job-hub`.
3. "Go to Data →" link jumps to the Data view.

## 8. Data backup / export / import (`Data.svelte`, `backup.ts`)

1. Sidebar "🗄 Data". Shows story/profile counts.
2. **Export:** "↓ Download" → `exportData` builds a `BackupBundle` (version, exportedAt, appVersion, stories, jobProfiles) and downloads `starlog-backup-YYYY-MM-DD.starlog.json`.
3. **Import:** "↑ Restore" file picker → `parseBackup` validates shape.
   - **Branch — invalid file:** `importError` (bad JSON, missing version/stories/jobProfiles, malformed entries).
   - **Success:** confirmation card summarising counts and export date; "Confirm import" → `applyImport` (replaces all data via `restore`) → `job-hub`. Cancel discards.
4. **Clear all data:** danger zone → "Are you absolutely sure?" modal → wipes stories, profiles, settings → `onboarding`.

## 9. PWA install (`vite.config.ts`, `main.ts`)

1. `vite-plugin-pwa` registers a service worker (`autoUpdate`) and serves a manifest (name, icons, standalone display, theme `#4f46e5`).
2. Browser shows its native install prompt (no in-app custom prompt). User installs to home screen / desktop.
3. `main.ts` calls `navigator.storage.persist()` to request durable storage so the OS won't evict IndexedDB under pressure.
4. Offline: precached assets (`globPatterns`) let the shell load offline. **Branch — offline AI:** Gemini calls fail (network) and surface as retryable `GeminiError`s; capture/structure cannot complete offline. Reading, editing, mapping, and rehearsing existing data work offline.

## 10. What's New / changelog (`WhatsNewPanel.svelte`, `App.svelte`, `Onboarding.svelte`)

1. Sidebar "What's New" shows a primary-color dot badge when `lastSeenDate !== CHANGELOG[0].date`.
2. Click opens a right-side drawer (`WhatsNewPanel`) listing entries (3 visible, "Show older" loads more); `onMount` marks the latest date seen (`markSeen`, persisted to IndexedDB `whatsNewLastSeen`), clearing the badge.
3. New users can also expand "See what's new" on the onboarding landing (shows 1 entry initially).
