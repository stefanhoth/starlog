<script lang="ts">
  import { extractSTAR, GeminiError } from '../lib/gemini';
  import { AudioRecorder } from '../lib/audio';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate } from '../lib/stores/view';

  const gapProfileId = sessionStorage.getItem('starlog_gap_profile') ?? '';
  const gapComp = sessionStorage.getItem('starlog_gap_competency') ?? '';

  const profile = $derived($jobProfilesStore.find(p => p.id === gapProfileId) ?? null);

  type Tab = 'record' | 'upload' | 'text';
  let tab = $state<Tab>('record');
  let loading = $state(false);
  let errorMsg = $state('');

  // Record
  let recorder = new AudioRecorder();
  let recorderState = $state<'idle' | 'recording' | 'stopped'>('idle');
  let elapsed = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Upload
  let uploadedFile = $state<File | null>(null);

  // Text
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
    uploadedFile = (e.target as HTMLInputElement).files?.[0] ?? null;
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
    // Pre-tag with gap competency
    if (gapComp && !draft.competency_tags.includes(gapComp)) {
      draft.competency_tags = [gapComp, ...draft.competency_tags];
    }
    sessionStorage.setItem('starlog_draft', JSON.stringify(draft));
    navigate('review');
  }

  function handleError(err: unknown) {
    errorMsg = err instanceof GeminiError ? err.message : 'Something went wrong. Please try again.';
  }

  function goBack() {
    navigate('job-hub');
  }
</script>

<div class="p-6 max-w-2xl mx-auto" data-testid="gap-fill-view">

  <!-- Breadcrumb -->
  <div class="flex items-center gap-1.5 text-sm text-base-content/50 mb-5">
    <button class="hover:text-base-content transition-colors" onclick={goBack}>
      ← {profile ? `${profile.role} · ${profile.company}` : 'Job Hub'}
    </button>
    <span>›</span>
    <span>filling gap</span>
  </div>

  <h1 class="text-2xl font-bold mb-2">Drafting for: <span class="text-primary">{gapComp}</span></h1>

  <!-- Context banner -->
  <div class="bg-base-200 border border-base-300 rounded-xl px-4 py-3 mb-6">
    <p class="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-1">The kind of question you'll hear</p>
    <p class="text-sm font-medium">"{`Tell me about a time you demonstrated ${gapComp.toLowerCase()}.`}"</p>
    <p class="text-xs text-base-content/40 mt-1">Speak freely — tell the story as it happened. AI will structure it for you.</p>
  </div>

  <!-- Tabs -->
  <div role="tablist" class="tabs tabs-boxed mb-6">
    <button role="tab" class="tab {tab === 'record' ? 'tab-active' : ''}" onclick={() => tab = 'record'}>
      🎙️ Record
    </button>
    <button role="tab" class="tab {tab === 'upload' ? 'tab-active' : ''}" onclick={() => tab = 'upload'}>
      📂 Upload
    </button>
    <button role="tab" class="tab {tab === 'text' ? 'tab-active' : ''}" onclick={() => tab = 'text'}>
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
      <p class="text-base-content/60 text-sm">Upload an audio file (mp4, m4a, webm, mp3, wav).</p>
      <input
        type="file"
        accept="audio/*"
        class="file-input file-input-bordered w-full"
        onchange={onFileSelected}
      />
      {#if uploadedFile}
        <p class="text-sm text-base-content/70">Selected: <strong>{uploadedFile.name}</strong></p>
      {/if}
      <button
        class="btn btn-primary"
        onclick={processUpload}
        disabled={!uploadedFile || loading}
      >
        {loading ? 'Processing…' : 'Extract STAR'}
      </button>
    </div>
  {/if}

  {#if tab === 'text'}
    <div class="card bg-base-200 p-6 flex flex-col gap-4">
      <p class="text-base-content/60 text-sm">Paste or type a transcript, notes, or a rough description.</p>
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
      >
        {loading ? 'Processing…' : 'Extract STAR'}
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center gap-3 mt-4 text-base-content/60">
      <span class="loading loading-spinner"></span>
      <span>Analysing with Gemini…</span>
    </div>
  {/if}

  {#if errorMsg}
    <div class="alert alert-error mt-4">
      <span>{errorMsg}</span>
      <button class="btn btn-sm btn-ghost" onclick={() => errorMsg = ''}>Dismiss</button>
    </div>
  {/if}
</div>
