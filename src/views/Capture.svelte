<script lang="ts">
  import { extractSTAR, GeminiError } from '../lib/gemini';
  import { AudioRecorder } from '../lib/audio';
  import { navigate } from '../lib/stores/view';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { COMPETENCIES } from '../lib/competencies';
  import { PROMPTS } from '../lib/inspiration';

  type Tab = 'record' | 'upload' | 'text';
  let tab = $state<Tab>('record');

  // Inspiration section
  let inspirationOpen = $state(true);
  let _selectedCompetency = $state<string | null>(null);

  // Gap-aware default: find the first unmapped competency across all job profiles
  const gapCompetency = $derived.by<string | null>(() => {
    for (const profile of $jobProfilesStore) {
      for (const c of profile.extractedCompetencies) {
        if (!profile.competencyMap[c]?.length) return c;
      }
    }
    return null;
  });

  const activeCompetency = $derived(_selectedCompetency ?? gapCompetency);

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
    // Store draft for Review screen and navigate
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

<div class="p-6 max-w-2xl mx-auto" data-testid="capture-view">
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
      {:else}
        <p class="text-xs text-slate-400">Pick a topic to see example questions.</p>
      {/if}
    {/if}
  </div>

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
