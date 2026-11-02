# Claude Model Usage — STARlog Build Sessions

Research date: 2026-06-17. Source: cloud transcript `5facdd39`, git log, local baseline supplied by Stefan.

---

## Key findings

### (a) Cloud transcript retention

Cloud sessions run in ephemeral containers. **Past sessions are not retained.** The `~/.claude/projects/` directory only exists for the current running session; when a session ends the container is reclaimed.

This environment has exactly one transcript file (`5facdd39`, session started Jun 12 10:46 UTC, still running Jun 17). The Jun 12 main-session turns were context-compacted and are gone; only the subagent child files from Jun 12–13 survived.

**The May 20–22 gap is unrecoverable.** The git repository also has no commits before June 1, 2026.

### (b) Default model in cloud sessions

**`claude-sonnet-4-6`** — confirmed in all 88 recovered main-session turns and in the system prompt. Specialist advisory subagents used `claude-opus-4-8`; Explore/search subagents used `claude-haiku-4-5-20251001`.

### (c) Opus specialist agents during the June polish

Yes, heavily. 22 specialist subagents fired on Jun 12–13, producing 264 turns (199 Opus 4.8 + 65 Haiku 4.5).

---

## Per-session table (cloud: Jun 12–17)

| Session ID | Dates | Entrypoint | Kind | Main turns recovered | Model |
|-----------|-------|-----------|------|---------------------|-------|
| `5facdd39` | Jun 12–17 | `remote_desktop` (claude.ai/code web) | interactive | 88 | 100% Sonnet 4.6 |

Note: Jun 12 main turns were compacted before this research ran. Git shows 10 commits on Jun 12 implying ~100–200 additional main turns that are unrecoverable.

---

## Subagent breakdown — session `5facdd39`, Jun 12–13

22 subagent instances, all spawned from the main Sonnet 4.6 session.

| Agent type | Instances | Turns | Model |
|-----------|-----------|------:|-------|
| `senior-engineer` | 8 | 104 | Opus 4.8 |
| `product-designer` | 3 | 36 | Opus 4.8 |
| `product-manager` | 3 | 34 | Opus 4.8 |
| `security-advisor` | 1 | 13 | Opus 4.8 |
| `ai-engineer` | 2 | 12 | Opus 4.8 |
| `Explore` (search/read) | 5 | 65 | Haiku 4.5 |
| **Total** | **22** | **264** | 199 Opus 4.8 · 65 Haiku 4.5 |

### What each specialist reviewed

- **senior-engineer ×8 (104 turns):** PR #189 export dropdown UX, bulk markdown export, Vitest unit test strategy, fake-indexeddb approach for db.ts tests, Local AI (LiteRT M1–M5) architecture, Onboarding.svelte refactor plan, onboarding split into Landing/Settings/AddJob
- **product-designer ×3 (36 turns):** Local mode visibility for non-Chrome browsers, full #205 (local AI) review, onboarding gap issue #211
- **product-manager ×3 (34 turns):** Local mode visibility decision, full #205 review, onboarding gap issue #211
- **security-advisor ×1 (13 turns):** Full #205 review (local model loader, privacy implications)
- **ai-engineer ×2 (12 turns):** Gemini.ts pure-function exports for testing, full #205 AI integration review
- **Explore ×5 (65 turns):** Reading gemini.ts + stores.spec.ts, researching LiteRT LM JS API, auditing all AI-powered features, router/view references for onboarding refactor

---

## Per-day model totals (cloud gap: Jun 12–17)

| Date | Main Sonnet 4.6 | Subagent Opus 4.8 | Subagent Haiku 4.5 | Git commits |
|------|----------------:|------------------:|-------------------:|------------:|
| Jun 12 | ~100–200 (lost to compaction) | 190 | 65 | 10 |
| Jun 13 | 33 | 9 | — | 10 |
| Jun 14 | — | — | — | — |
| Jun 15 | 35 | — | — | 3 |
| Jun 16 | — | — | — | — |
| Jun 17 | 20 | — | — | 0 (session ongoing) |
| **Cloud total** | **88 recovered + ~150 lost** | **199** | **65** | **23** |

---

## Grand total — all sources merged

Local baseline supplied by Stefan: 2,238 main turns (Sonnet 1,982 / Opus 4.8 252 / Opus 4.7 3) + 629 bg-agent turns (100% Sonnet).

| Source | Turns | Sonnet 4.6 | Opus 4.8 | Opus 4.7 | Haiku 4.5 |
|--------|------:|-----------:|---------:|---------:|----------:|
| Local CLI — main (May 31–Jun 2, Jun 17) | 2,238 | 1,982 | 252 | 3 | — |
| Local CLI — bg agents | 629 | 629 | — | — | — |
| Cloud main, recovered (Jun 13–17) | 88 | 88 | — | — | — |
| Cloud subagents (Jun 12–13) | 264 | — | 199 | — | 65 |
| Cloud main Jun 12 *(estimated, lost)* | ~150 | ~150 | — | — | — |
| **Grand total** | **~3,370** | **~2,849** | **~451** | **3** | **65** |

Percentages (recovered turns only, excl. ~150 estimated lost):
- Sonnet 4.6: ~87 %
- Opus 4.8: ~14 %
- Haiku 4.5: ~2 %
- Opus 4.7: <1 %

---

## Git commit burst reference

For context on what each day's work produced:

| Date | Commits | Notable PRs merged |
|------|--------:|--------------------|
| Jun 12 | 10 | Export dropdown UX (#189), bulk markdown export (#199), Vitest unit tests (#200), parseBackup unit tests (#202–203), Local AI M1–M5 (#205), Safari fix (#210) |
| Jun 13 | 10 | Local AI onboarding path (#212), label fix (#218), Onboarding refactor (#219), feature strip (#222), local AI teaser (#223), scroll cue (#224), inspiration prompts (#216 partial) |
| Jun 15 | 3 | PR #221 fixes (flushSync iterations, ExportMenu Escape handler) |

---

*Source files: `~/.claude/projects/-home-user-starlog/5facdd39-644d-5047-a226-fd0e8c610cc5.jsonl` (88 assistant entries) + 22 subagent JSONL files (264 assistant entries). Repo: github.com/stefanhoth/starlog.*
