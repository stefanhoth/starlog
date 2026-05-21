<script lang="ts">
  import { extractSTAR, generateInspirationQuestions, GeminiError } from '../lib/gemini';
  import { AudioRecorder } from '../lib/audio';
  import { navigate } from '../lib/stores/view';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { COMPETENCIES } from '../lib/competencies';
  import { PROMPTS } from '../lib/inspiration';

  // Gap-fill mode: set by GapFill entry point via sessionStorage
  const gapFillProfileId = sessionStorage.getItem('starlog_gap_profile') ?? '';
  const gapFillComp = sessionStorage.getItem('starlog_gap_competency') ?? '';
  const isGapMode = Boolean(gapFillComp);

  const gapFillProfile = $derived(
    isGapMode ? ($jobProfilesStore.find(p => p.id === gapFillProfileId) ?? null) : null
  );

  type Tab = 'record' | 'upload' | 'text';
  let tab = $state<Tab>('record');

  // Inspiration section (normal mode only)
  let inspirationOpen = $state(true);
  let _selectedCompetency = $state<string | null>(null);

  // AI-generated questions
  let aiQuestions = $state<string[]>([]);
  let aiLoading = $state(false);
  let aiError = $state('');
  let aiIndex = $state(0);

  // Reset AI questions when the active competency changes
  $effect(() => {
    activeCompetency; // track
    aiQuestions = [];
    aiError = '';
    aiIndex = 0;
  });

  async function generateQuestions() {
    if (!activeCompetency) return;
    aiLoading = true;
    aiError = '';
    aiQuestions = [];
    aiIndex = 0;
    try {
      aiQuestions = await generateInspirationQuestions(activeCompetency);
    } catch (err) {
      aiError = err instanceof GeminiError ? err.message : 'Failed to generate questions. Try again.';
    } finally {
      aiLoading = false;
    }
  }

  // Gap-aware default for normal mode: first unmapped competency across all profiles
  const gapCompetency = $derived.by<string | null>(() => {
    if (isGapMode) return null;
    for (const profile of $jobProfilesStore) {
      for (const c of profile.extractedCompetencies) {
        if (!profile.competencyMap[c]?.length) return c;
      }
    }
    return null;
  });

  const activeCompetency = $derived(
    isGapMode ? gapFillComp : (_selectedCompetency ?? gapCompetency)
  );

  // Shared state
  let loading = $state(false);
  let errorMsg = $state('');

  // Record tab
  let recorder = new AudioRecorder();
  let recorderState = $state<'idle' | 'recording' | 'stopped'>('idle');
  let elapsed = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Upload tab
  let uploadedFile = $state<File | null>(null);

  // Text tab
  let textInput = $state('');

  function formatTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  async function startRecording() {
    errorMsg = '';
    try {
      await recorder.start();
      recorderState = 'recording';
      elapsed = 0;
      timerInterval = setInterval(() => elapsed++, 1000);
    } catch {
      errorMsg = 'Could not access microphone. Check browser permissions.';
    }
  }

  async function stopAndProcess() {
    if (timerInterval) clearInterval(timerInterval);
    recorderState = 'stopped';
    loading = true;
    errorMsg = '';
    try {
      const blob = await recorder.stop();
      await sendToGemini(blob);
    } catch (err) {
      handleError(err);
    } finally {
      loading = false;
      recorderState = 'idle';
    }
  }

  function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    uploadedFile = input.files?.[0] ?? null;
  }

  async function processUpload() {
    if (!uploadedFile) return;
    loading = true;
    errorMsg = '';
    try {
      await sendToGemini(uploadedFile);
    } catch (err) {
      handleError(err);
    } finally {
      loading = false;
    }
  }

  async function processText() {
    if (!textInput.trim()) return;
    loading = true;
    errorMsg = '';
    try {
      await sendToGemini(textInput.trim());
    } catch (err) {
      handleError(err);
    } finally {
      loading = false;
    }
  }

  async function sendToGemini(input: Blob | string) {
    const draft = await extractSTAR(input);
    if (isGapMode && gapFillComp && !draft.competency_tags.includes(gapFillComp)) {
      draft.competency_tags = [gapFillComp, ...draft.competency_tags];
    }
    sessionStorage.setItem('starlog_draft', JSON.stringify(draft));
    navigate('review');
  }

  function handleError(err: unknown) {
    if (err instanceof GeminiError) {
      errorMsg = err.message;
    } else {
      errorMsg = 'Something went wrong. Please try again.';
    }
  }
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="{isGapMode ? 'gap-fill-view' : 'capture-view'}">

  {#if isGapMode}
    <!-- Gap-fill mode header -->
    <div class="flex items-center gap-1.5 text-sm text-base-content/50 mb-5">
      <button class="hover:text-base-content transition-colors" onclick={() => navigate('job-hub')}>
        ← {gapFillProfile ? `${gapFillProfile.role} · ${gapFillProfile.company}` : 'Job Hub'}
      </button>
      <span>›</span>
      <span>filling gap</span>
    </div>

    <h1 class="text-2xl font-bold mb-2">Drafting for: <span class="text-primary">{gapFillComp}</span></h1>

    <!-- Context banner -->
    <div class="bg-base-200 border border-base-300 rounded-xl px-4 py-3 mb-4">
      <p class="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-1">The kind of question you'll hear</p>
      <p class="text-sm font-medium">"{`Tell me about a time you demonstrated ${gapFillComp.toLowerCase()}.`}"</p>
      <p class="text-xs text-base-content/40 mt-1">Speak freely — tell the story as it happened. AI will structure it for you.</p>
    </div>

    <!-- AI-generated questions (gap mode: competency is fixed) -->
    <div class="mb-6 flex flex-col gap-2">
      {#if aiQuestions.length === 0}
        <button
          class="btn btn-sm btn-outline btn-primary w-full"
          onclick={generateQuestions}
          disabled={loading || aiLoading}
          data-testid="generate-questions-btn"
        >
          {#if aiLoading}
            <span class="loading loading-spinner loading-xs"></span> Generating…
          {:else}
            ✨ Generate questions
          {/if}
        </button>
      {:else}
        <div class="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-col gap-3" data-testid="ai-questions">
          <p class="text-sm text-slate-700 italic">"{aiQuestions[aiIndex]}"</p>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1">
              <button
                class="btn btn-xs btn-ghost"
                onclick={() => aiIndex = (aiIndex - 1 + aiQuestions.length) % aiQuestions.length}
                aria-label="Previous question"
                data-testid="ai-prev-btn"
              >◀</button>
              <span class="text-xs text-slate-400" data-testid="ai-counter">{aiIndex + 1} / {aiQuestions.length}</span>
              <button
                class="btn btn-xs btn-ghost"
                onclick={() => aiIndex = (aiIndex + 1) % aiQuestions.length}
                aria-label="Next question"
                data-testid="ai-next-btn"
              >▶</button>
            </div>
            <button
              class="btn btn-xs btn-ghost text-base-content/50"
              onclick={generateQuestions}
              disabled={loading || aiLoading}
              data-testid="regenerate-btn"
            >
              {#if aiLoading}<span class="loading loading-spinner loading-xs"></span>{:else}↺ Regenerate{/if}
            </button>
          </div>
        </div>
      {/if}
      {#if aiError}
        <p class="text-error text-xs" data-testid="ai-error">{aiError}</p>
      {/if}
    </div>

  {:else}
    <!-- Normal capture mode header -->
    <h1 class="text-2xl font-bold mb-6">Capture a Story</h1>

    <!-- Inspiration section -->
    <div class="mb-6" data-testid="inspiration-section">
      <button
        class="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 w-full text-left mb-2 transition-colors"
        onclick={() => inspirationOpen = !inspirationOpen}
        data-testid="inspiration-toggle"
        aria-expanded={inspirationOpen}
      >
        <span class="text-xs">{inspirationOpen ? '▾' : '▸'}</span>
        💡 Need inspiration? {gapCompetency && !inspirationOpen ? `· ${gapCompetency} needs a story` : ''}
      </button>

      {#if inspirationOpen}
        <div class="flex flex-wrap gap-1.5 mb-3">
          {#each COMPETENCIES as c}
            <button
              class="badge badge-sm cursor-pointer {activeCompetency === c ? 'badge-primary' : 'badge-ghost'}"
              onclick={() => _selectedCompetency = _selectedCompetency === c ? null : c}
              data-testid="inspiration-tag-{c.toLowerCase().replace(/\W+/g, '-')}"
            >{c}</button>
          {/each}
        </div>

        {#if activeCompetency}
          <ul class="space-y-2" data-testid="inspiration-prompts">
            {#each PROMPTS[activeCompetency as keyof typeof PROMPTS] ?? [] as prompt}
              <li class="text-sm text-slate-600 flex gap-2 items-start bg-base-200 rounded-lg px-3 py-2.5">
                <span class="text-primary shrink-0 mt-0.5">▸</span>
                <span class="italic">"{prompt}"</span>
              </li>
            {/each}
          </ul>

          <!-- AI-generated questions -->
          <div class="mt-3 flex flex-col gap-2">
            {#if aiQuestions.length === 0}
              <button
                class="btn btn-sm btn-outline btn-primary w-full"
                onclick={generateQuestions}
                disabled={loading || aiLoading}
                data-testid="generate-questions-btn"
              >
                {#if aiLoading}
                  <span class="loading loading-spinner loading-xs"></span> Generating…
                {:else}
                  ✨ Generate questions
                {/if}
              </button>
            {:else}
              <div class="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-col gap-3" data-testid="ai-questions">
                <p class="text-sm text-slate-700 italic">"{aiQuestions[aiIndex]}"</p>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1">
                    <button
                      class="btn btn-xs btn-ghost"
                      onclick={() => aiIndex = (aiIndex - 1 + aiQuestions.length) % aiQuestions.length}
                      aria-label="Previous question"
                      data-testid="ai-prev-btn"
                    >◀</button>
                    <span class="text-xs text-slate-400" data-testid="ai-counter">{aiIndex + 1} / {aiQuestions.length}</span>
                    <button
                      class="btn btn-xs btn-ghost"
                      onclick={() => aiIndex = (aiIndex + 1) % aiQuestions.length}
                      aria-label="Next question"
                      data-testid="ai-next-btn"
                    >▶</button>
                  </div>
                  <button
                    class="btn btn-xs btn-ghost text-base-content/50"
                    onclick={generateQuestions}
                    disabled={loading || aiLoading}
                    data-testid="regenerate-btn"
                  >
                    {#if aiLoading}<span class="loading loading-spinner loading-xs"></span>{:else}↺ Regenerate{/if}
                  </button>
                </div>
              </div>
            {/if}

            {#if aiError}
              <p class="text-error text-xs" data-testid="ai-error">{aiError}</p>
            {/if}
          </div>
        {:else}
          <p class="text-xs text-slate-400">Pick a topic to see example questions.</p>
        {/if}
      {/if}
    </div>
  {/if}

  <div role="tablist" class="tabs tabs-boxed mb-6">
    <button role="tab" class="tab {tab === 'record' ? 'tab-active' : ''}" onclick={() => tab = 'record'} data-testid="tab-record">
      🎙️ Record
    </button>
    <button role="tab" class="tab {tab === 'upload' ? 'tab-active' : ''}" onclick={() => tab = 'upload'} data-testid="tab-upload">
      📂 Upload
    </button>
    <button role="tab" class="tab {tab === 'text' ? 'tab-active' : ''}" onclick={() => tab = 'text'} data-testid="tab-text">
      ✏️ Text
    </button>
  </div>

  {#if tab === 'record'}
    <div class="card bg-base-200 p-6 flex flex-col items-center gap-4">
      <p class="text-base-content/60 text-sm text-center">
        Hit record and talk through what happened. Don't worry about structure — just tell the story.
      </p>
      <div class="font-mono text-4xl font-bold tabular-nums">{formatTime(elapsed)}</div>
      {#if recorderState === 'idle'}
        <button class="btn btn-primary btn-lg gap-2" onclick={startRecording} disabled={loading}>
          ⏺ Start Recording
        </button>
      {:else if recorderState === 'recording'}
        <button class="btn btn-error btn-lg gap-2 animate-pulse" onclick={stopAndProcess}>
          ⏹ Stop & Process
        </button>
      {/if}
    </div>
  {/if}

  {#if tab === 'upload'}
    <div class="card bg-base-200 p-6 flex flex-col gap-4">
      <p class="text-base-content/60 text-sm">
        Upload an existing audio file (mp4, m4a, webm, mp3, wav).
      </p>
      <input
        type="file"
        accept="audio/*"
        class="file-input file-input-bordered w-full"
        onchange={onFileSelected}
        data-testid="audio-file-input"
      />
      {#if uploadedFile}
        <p class="text-sm text-base-content/70">Selected: <strong>{uploadedFile.name}</strong></p>
      {/if}
      <button
        class="btn btn-primary"
        onclick={processUpload}
        disabled={!uploadedFile || loading}
        data-testid="upload-submit"
      >
        {loading ? 'Processing…' : 'Extract STAR'}
      </button>
    </div>
  {/if}

  {#if tab === 'text'}
    <div class="card bg-base-200 p-6 flex flex-col gap-4">
      <p class="text-base-content/60 text-sm">
        Paste or type a transcript, notes, or a rough description of your story.
      </p>
      <textarea
        class="textarea textarea-bordered w-full h-48 resize-y"
        placeholder="I was working at Acme when we had a major outage..."
        bind:value={textInput}
        data-testid="text-input"
      ></textarea>
      <button
        class="btn btn-primary"
        onclick={processText}
        disabled={!textInput.trim() || loading}
        data-testid="text-submit"
      >
        {loading ? 'Processing…' : 'Extract STAR'}
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center gap-3 mt-4 text-base-content/60" data-testid="loading-indicator">
      <span class="loading loading-spinner"></span>
      <span>Analysing with Gemini…</span>
    </div>
  {/if}

  {#if errorMsg}
    <div class="alert alert-error mt-4" data-testid="error-message">
      <span>{errorMsg}</span>
      <button class="btn btn-sm btn-ghost" onclick={() => errorMsg = ''}>Dismiss</button>
    </div>
  {/if}
</div>
