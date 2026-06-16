# STARlog — What We're Not Doing (and Why)

Features and ideas we **deliberately decided against** (or deferred), with the reasoning at the time. Stops good-sounding ideas from being re-litigated, and records what would have to change for the answer to flip. Newest first.

---

## Local audio capture / transcription (record & upload in local mode)

**Proposed:** Let the local AI provider also handle audio — record or upload a clip in local mode and transcribe it on-device — instead of forcing the Text tab and silently routing audio to the cloud.

**Decision:** Deferred, staying text-only in local mode. *(2026-06-16)*

**Why:**
- **The cloud architecture can't be mirrored locally.** Cloud (Gemini 2.5 Flash) transcribes *and* restructures into a STAR story in one multimodal call. LiteRT LM's web/WASM build is text-in/text-out only — Gemma 3n's audio capability isn't wired through the browser pipeline. There is no "flip `supportsAudio` and it works" path today.
- **The only viable build is a heavy two-stage pipeline.** Whisper via transformers.js (speech-to-text) feeding the existing local `extractSTAR(string)`. That adds ~25–40 MB download on top of the already-large local LLM (roughly doubling local-mode footprint), runs two sequential in-browser inferences (slower, memory-heavy on low-end machines), and regresses quality — transcription errors propagate uncorrected because the LLM reasons *after* transcription rather than jointly (the cloud model self-corrects garbled audio from story context). Multilingual (e.g. German→English) is notably weaker.
- **The privacy upside is real but incremental.** Local audio *is* strictly more private than cloud audio (the raw voice recording — the single most sensitive artefact — never leaves the device). But it improves an already-private mode, while the maintenance cost (a second AI dependency on a fast-moving stack) is large and permanent for a solo dev. Upload + text already carry local-mode users through the full value loop.

**What would change our mind:** A multimodal local model becomes something local-mode users would download *anyway* (so audio adds ~zero marginal footprint), or LiteRT LM ships a usable in-browser audio path — at which point flip the `LocalModelCapabilities.supportsAudio` flag (the existing hedge) and re-enable the Record/Upload tabs.

---

## Storing the raw transcript / original input per story

**Proposed:** Persist the original input (spoken or typed) alongside each STAR story (`rawInput`), to later re-generate with a different model or with extra context when the first extraction came out incomplete.

**Decision:** Not doing it. *(2026-06-02)*

**Why:**
- **No real user need.** "Re-generate with a different model" is a tinkerer impulse, not a job-seeker workflow — and it's destructive (overwrites a story the user already edited, ranked, and mapped). "Re-generate to add what Gemini dropped" is already covered by inline editing in the StarEditor.
- **It worsens the privacy stance.** Raw transcripts are *more* sensitive than the polished story (real names, company internals, slips of the tongue) — exactly the rawness today's flow neutralises and discards. Keeping it holds the most sensitive data layer permanently in the browser and in every plaintext Export.

**What would change our mind:** Repeated user feedback that inline editing doesn't fix "Gemini dropped what I said", *and* a re-generation flow useful to users (not just model comparison) and non-destructive to manual edits. Privacy bar then is non-negotiable: opt-in (default = discard, as today), per-story delete, text-path first.
