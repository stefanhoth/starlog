# StarLog — What We're Not Doing (and Why)

Features and ideas we **deliberately decided against** (or deferred), with the reasoning at the time. Stops good-sounding ideas from being re-litigated, and records what would have to change for the answer to flip. Newest first.

---

## Storing the raw transcript / original input per story

**Proposed:** Persist the original input (spoken or typed) alongside each STAR story (`rawInput`), to later re-generate with a different model or with extra context when the first extraction came out incomplete.

**Decision:** Not doing it. *(2026-06-02)*

**Why:**
- **No real user need.** "Re-generate with a different model" is a tinkerer impulse, not a job-seeker workflow — and it's destructive (overwrites a story the user already edited, ranked, and mapped). "Re-generate to add what Gemini dropped" is already covered by inline editing in the StarEditor.
- **It worsens the privacy stance.** Raw transcripts are *more* sensitive than the polished story (real names, company internals, slips of the tongue) — exactly the rawness today's flow neutralises and discards. Keeping it holds the most sensitive data layer permanently in the browser and in every plaintext Export.

**What would change our mind:** Repeated user feedback that inline editing doesn't fix "Gemini dropped what I said", *and* a re-generation flow useful to users (not just model comparison) and non-destructive to manual edits. Privacy bar then is non-negotiable: opt-in (default = discard, as today), per-story delete, text-path first.
