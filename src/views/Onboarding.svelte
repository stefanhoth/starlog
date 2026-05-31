<script lang="ts">
  import { settingsStore } from '../lib/stores/settings';
  import { storiesStore } from '../lib/stores/stories';
  import { jobProfilesStore } from '../lib/stores/jobProfiles';
  import { navigate, openJob } from '../lib/stores/view';
  import { untrack } from 'svelte';
  import { verifyApiKey, extractCompetencies, GeminiError } from '../lib/gemini';
  import { exportData, parseBackup, applyImport, type BackupBundle } from '../lib/backup';
  import { GEMINI_MODELS, type GeminiModel } from '../lib/types';
  import AiWorking from '../lib/components/AiWorking.svelte';

  // addJobMode: skip key step and go straight to job entry (for sidebar "+ add job")
  let { addJobMode = false }: { addJobMode?: boolean } = $props();

  const isSettings = $derived($settingsStore.consentGiven);

  // ── Backup / restore ───────────────────────────────────────────────
  let importBundle = $state<BackupBundle | null>(null);
  let importError = $state('');
  let importConfirming = $state(false);

  async function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    importError = '';
    importBundle = null;
    importConfirming = false;
    try {
      importBundle = await parseBackup(file);
      importConfirming = true;
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Could not read file.';
    }
    (e.target as HTMLInputElement).value = '';
  }

  function confirmImport() {
    if (!importBundle) return;
    applyImport(importBundle);
    importBundle = null;
    importConfirming = false;
    navigate('job-hub');
  }

  function cancelImport() {
    importBundle = null;
    importConfirming = false;
    importError = '';
  }

  const storyCount = $derived($storiesStore.length);
  const profileCount = $derived($jobProfilesStore.length);

  // ── Step management ────────────────────────────────────────────────
  // Steps: 'key' | 'job-entry' | 'job-review'
  // addJobMode skips key entry; settings mode always shows key form first
  let step = $state<'key' | 'job-entry' | 'job-review'>(untrack(() => addJobMode ? 'job-entry' : 'key'));

  // ── Onboarding popovers ────────────────────────────────────────────
  let showSecurityPopover = $state(false);
  let showPrivacyPopover = $state(false);
  let showHowItWorks = $state(false);

  // ── Step 1: API key & model selection ─────────────────────────────
  let apiKey = $state($settingsStore.apiKey ?? '');
  let selectedModel = $state<GeminiModel>($settingsStore.geminiModel ?? 'gemini-2.5-flash');
  let verifying = $state(false);
  let verifyStatus = $state<'idle' | 'ok' | 'error'>('idle');
  let verifyError = $state('');
  let formatError = $state('');

  const canSave = $derived(verifyStatus === 'ok');

  let validationSeq = 0;
  $effect(() => {
    if (step !== 'key') return;
    const key = apiKey.trim();
    verifyStatus = 'idle';
    verifyError = '';
    formatError = '';
    verifying = false;
    if (!key) return;
    if (!key.startsWith('AIza')) {
      formatError = 'Gemini API keys start with "AIza". Please check you copied the right key.';
      return;
    }
    const seq = ++validationSeq;
    const timer = setTimeout(async () => {
      if (seq !== validationSeq) return;
      verifying = true;
      try {
        await verifyApiKey(key);
        if (seq === validationSeq) verifyStatus = 'ok';
      } catch (err) {
        if (seq === validationSeq) {
          verifyStatus = 'error';
          verifyError = err instanceof GeminiError ? err.message : 'Verification failed.';
        }
      } finally {
        if (seq === validationSeq) verifying = false;
      }
    }, 600);
    return () => clearTimeout(timer);
  });

  function submitKey() {
    if (!canSave) return;
    settingsStore.set({ apiKey: apiKey.trim(), consentGiven: true, geminiModel: selectedModel });
    if ($jobProfilesStore.length === 0) {
      navigate('add-job');
    } else {
      navigate('job-hub');
    }
  }

  function saveModelSelection() {
    settingsStore.update(s => ({ ...s, geminiModel: selectedModel }));
  }

  // ── Step 2: Job entry ──────────────────────────────────────────────
  let jobDescription = $state('');
  let jobTitle = $state('');
  let jobCompany = $state('');
  let extracting = $state(false);
  let extractError = $state('');
  let extractedComps = $state<string[]>([]);

  async function extractJob() {
    if (!jobDescription.trim()) return;
    extracting = true;
    extractError = '';
    try {
      const comps = await extractCompetencies(jobDescription.trim());
      extractedComps = comps;
      step = 'job-review';
    } catch (err) {
      extractError = err instanceof GeminiError ? err.message : 'Extraction failed. Try again.';
    } finally {
      extracting = false;
    }
  }

  // ── Step 3: Review & save ──────────────────────────────────────────
  let editableComps = $state<string[]>([]);
  let newComp = $state('');

  $effect(() => {
    if (extractedComps.length > 0) editableComps = [...extractedComps];
  });

  function removeComp(c: string) {
    editableComps = editableComps.filter(x => x !== c);
  }

  function addComp() {
    const trimmed = newComp.trim();
    if (trimmed && !editableComps.includes(trimmed)) {
      editableComps = [...editableComps, trimmed];
    }
    newComp = '';
  }

  function saveJob() {
    const profile = jobProfilesStore.addJobProfile({
      company: jobCompany.trim() || 'Unknown company',
      role: jobTitle.trim() || 'Unknown role',
      jobDescription: jobDescription.trim(),
      extractedCompetencies: editableComps,
      competencyMap: {},
    });
    openJob(profile.id);
  }

  function skipJobEntry() {
    if ($jobProfilesStore.length > 0) {
      navigate('job-hub');
    } else {
      navigate('story-bank');
    }
  }
</script>

<!-- ── Settings mode: compact key update ──────────────────────────── -->
{#if isSettings && !addJobMode && step === 'key'}

  <div class="min-h-full flex items-center justify-center p-6">
    <div class="bg-base-100 border border-base-300 rounded-2xl shadow-sm w-full max-w-sm p-6 flex flex-col gap-5">
      <div>
        <h2 class="font-semibold text-base">Settings</h2>
        <p class="text-sm text-base-content/50 mt-0.5">Update your Gemini API key</p>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" for="api-key">Gemini API Key</label>
        <div class="relative">
          <input
            id="api-key"
            type="password"
            class="input input-bordered w-full pr-10 text-sm
              {formatError ? 'input-error' : verifyStatus === 'ok' ? 'input-success' : verifyStatus === 'error' ? 'input-error' : ''}"
            placeholder="AIza…"
            bind:value={apiKey}
            onkeydown={(e) => e.key === 'Enter' && submitKey()}
            data-testid="api-key-input"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
            {#if verifying}
              <span class="loading loading-spinner loading-xs text-base-content/40"></span>
            {:else if verifyStatus === 'ok'}
              <span class="text-success font-bold">✓</span>
            {:else if verifyStatus === 'error' || formatError}
              <span class="text-error">✕</span>
            {/if}
          </span>
        </div>
        {#if formatError}
          <p class="text-error text-xs mt-0.5" data-testid="key-format-error">{formatError}</p>
        {:else if verifyStatus === 'error'}
          <p class="text-error text-xs mt-0.5" data-testid="verify-error">{verifyError}</p>
        {:else if verifyStatus === 'ok'}
          <p class="text-success text-xs mt-0.5" data-testid="verify-success">✓ Key is valid.</p>
        {:else if verifying}
          <p class="text-base-content/40 text-xs mt-0.5">Verifying…</p>
        {/if}
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium" for="model-select">Gemini Model</label>
        <select
          id="model-select"
          class="select select-bordered w-full text-sm"
          bind:value={selectedModel}
          onchange={saveModelSelection}
          data-testid="model-select"
        >
          {#each GEMINI_MODELS as m}
            <option value={m.id}>{m.label}</option>
          {/each}
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <button
          class="btn btn-primary w-full"
          onclick={submitKey}
          disabled={!canSave}
          data-testid="onboarding-submit"
        >Save</button>
        <button class="btn btn-ghost w-full text-base-content/50" onclick={() => navigate('job-hub')}>
          Cancel
        </button>
      </div>

      <!-- Data: backup & restore -->
      <div class="border-t border-base-300 pt-5 flex flex-col gap-3" data-testid="data-section">
        <p class="text-xs font-semibold uppercase tracking-widest text-base-content/50">Data</p>

        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium">Download backup</p>
            <p class="text-xs text-base-content/50 mt-0.5">{storyCount} {storyCount === 1 ? 'story' : 'stories'} · {profileCount} job {profileCount === 1 ? 'profile' : 'profiles'}</p>
          </div>
          <button
            class="btn btn-outline btn-sm shrink-0"
            onclick={exportData}
            data-testid="export-btn"
          >
            ↓ Download
          </button>
        </div>

        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium">Restore from backup</p>
            <p class="text-xs text-base-content/50 mt-0.5">Replaces all current data.</p>
          </div>
          <label class="btn btn-outline btn-sm shrink-0 cursor-pointer" data-testid="import-label">
            ↑ Restore
            <input
              type="file"
              accept=".json,.starlog.json"
              class="hidden"
              onchange={handleImportFile}
              data-testid="import-input"
            />
          </label>
        </div>

        {#if importError}
          <p class="text-error text-xs" data-testid="import-error">{importError}</p>
        {/if}

        {#if importConfirming && importBundle}
          <div class="bg-warning/10 border border-warning/30 rounded-xl p-4 flex flex-col gap-3" data-testid="import-confirm">
            <p class="text-sm">
              This backup contains <strong>{importBundle.stories.length} {importBundle.stories.length === 1 ? 'story' : 'stories'}</strong>
              and <strong>{importBundle.jobProfiles.length} job {importBundle.jobProfiles.length === 1 ? 'profile' : 'profiles'}</strong>,
              exported on {new Date(importBundle.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
              Importing will replace your current {storyCount} {storyCount === 1 ? 'story' : 'stories'} and {profileCount} job {profileCount === 1 ? 'profile' : 'profiles'}.
            </p>
            <div class="flex gap-2">
              <button class="btn btn-warning btn-sm" onclick={confirmImport} data-testid="import-confirm-btn">Confirm import</button>
              <button class="btn btn-ghost btn-sm" onclick={cancelImport} data-testid="import-cancel-btn">Cancel</button>
            </div>
          </div>
        {/if}
      </div>

    </div>
  </div>

<!-- ── New user landing + key step ────────────────────────────────── -->
{:else if step === 'key'}

  <div class="min-h-screen bg-base-100 flex flex-col">

    <div class="flex-1 grid lg:grid-cols-[1fr_400px]">

      <!-- Left: pitch -->
      <div class="flex flex-col justify-center px-8 py-14 lg:px-16 xl:px-24">
        <div class="flex items-center gap-2 mb-10">
          <span class="text-primary font-bold text-2xl leading-none">★</span>
          <span class="font-bold text-lg tracking-tight">StarLog</span>
        </div>
        <h1 class="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
          Walk into every interview<br class="hidden sm:block">
          with the right story.
        </h1>
        <p class="mt-5 text-lg text-base-content/60 leading-relaxed max-w-lg">
          Tell StarLog your work stories. It maps them to what interviewers actually test, so when the question comes you already have the answer.
        </p>

        <!-- STAR primer -->
        <div class="mt-8 border border-base-300 rounded-xl p-4 bg-base-100 max-w-md">
          <p class="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-3">What's STAR?</p>
          <div class="grid grid-cols-4 gap-3">
            {#each [
              { l: 'S', w: 'Situation', d: 'set the scene' },
              { l: 'T', w: 'Task',      d: 'your job' },
              { l: 'A', w: 'Action',    d: 'what YOU did' },
              { l: 'R', w: 'Result',    d: 'what changed' },
            ] as item}
              <div class="text-center">
                <div class="w-8 h-8 mx-auto rounded-lg bg-primary text-primary-content font-bold text-sm flex items-center justify-center mb-1">
                  {item.l}
                </div>
                <div class="text-xs font-semibold">{item.w}</div>
                <div class="text-xs text-base-content/40">{item.d}</div>
              </div>
            {/each}
          </div>
        </div>

        <div class="mt-8 flex flex-wrap items-center gap-4">
          <button
            class="text-xs text-base-content/40 hover:text-base-content/70 transition-colors text-left"
            onclick={() => showPrivacyPopover = true}
          >
            🔒 Your data stays in your browser — what does that mean?
          </button>
          <button
            class="text-xs text-primary/70 hover:text-primary transition-colors"
            onclick={() => showHowItWorks = true}
          >
            How it works →
          </button>
        </div>
      </div>

      <!-- Right: key form -->
      <div class="bg-base-200 border-l border-base-300 flex items-center justify-center p-8 lg:p-10">
        <div class="w-full max-w-sm flex flex-col gap-5">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold">Connect Gemini AI</h2>
              <button
                class="text-xs text-base-content/40 hover:text-primary transition-colors"
                onclick={() => showSecurityPopover = true}
                aria-label="Why your own key?"
              >ⓘ more info</button>
            </div>
            <p class="text-sm text-base-content/50 mt-1 leading-relaxed">
              StarLog uses your own Gemini API key — your calls go directly to Google, never through StarLog.
            </p>
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium" for="api-key">Gemini API Key</label>
              <a class="text-xs text-primary hover:text-primary/80 transition-colors"
                href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                Get a free key ↗
              </a>
            </div>
            <div class="relative">
              <input
                id="api-key"
                type="password"
                class="input input-bordered w-full pr-10 text-sm bg-base-100
                  {formatError ? 'input-error' : verifyStatus === 'ok' ? 'input-success' : verifyStatus === 'error' ? 'input-error' : ''}"
                placeholder="AIza…"
                bind:value={apiKey}
                onkeydown={(e) => e.key === 'Enter' && submitKey()}
                data-testid="api-key-input"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
                {#if verifying}
                  <span class="loading loading-spinner loading-xs text-base-content/40"></span>
                {:else if verifyStatus === 'ok'}
                  <span class="text-success font-bold">✓</span>
                {:else if verifyStatus === 'error' || formatError}
                  <span class="text-error">✕</span>
                {/if}
              </span>
            </div>
            {#if formatError}
              <p class="text-error text-xs mt-0.5" data-testid="key-format-error">{formatError}</p>
            {:else if verifyStatus === 'error'}
              <p class="text-error text-xs mt-0.5" data-testid="verify-error">{verifyError}</p>
            {:else if verifyStatus === 'ok'}
              <p class="text-success text-xs mt-0.5" data-testid="verify-success">✓ Key is valid and working.</p>
            {:else if verifying}
              <p class="text-base-content/40 text-xs mt-0.5">Verifying key…</p>
            {/if}
          </div>

          <button
            class="btn btn-primary w-full"
            onclick={submitKey}
            disabled={!canSave}
            data-testid="onboarding-submit"
          >
            Get Started →
          </button>
        </div>
      </div>
    </div>

  </div>

  <!-- Security popover -->
  {#if showSecurityPopover}
    <div
      class="fixed inset-0 z-50 flex items-start justify-end p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-heading"
      onkeydown={(e) => e.key === 'Escape' && (showSecurityPopover = false)}
      onclick={(e) => e.target === e.currentTarget && (showSecurityPopover = false)}
      tabindex="-1"
    >
      <div class="bg-base-100 border border-base-300 rounded-xl shadow-md p-5 text-sm max-w-xs w-full mt-16 mr-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <h3 id="security-heading" class="font-semibold text-base">Why your own key?</h3>
          <button class="btn btn-xs btn-ghost shrink-0 -mt-1 -mr-1" onclick={() => showSecurityPopover = false} aria-label="Close">✕</button>
        </div>
        <p class="text-base-content/60 leading-relaxed">When you use a shared AI service, your prompts go through someone else's account and billing. With your own Gemini key:</p>
        <ul class="space-y-1.5 text-base-content/70">
          <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>Your API calls go directly from your browser to Google — StarLog never sees them</span></li>
          <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>You control usage and can revoke the key any time from Google AI Studio</span></li>
          <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No StarLog account means no StarLog database that could be breached</span></li>
        </ul>
        <p class="text-base-content/50 text-xs">The free tier (Gemini Flash) handles hundreds of stories before you'd ever hit a limit.</p>
      </div>
    </div>
  {/if}

  <!-- Data privacy popover -->
  {#if showPrivacyPopover}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-heading"
      onkeydown={(e) => e.key === 'Escape' && (showPrivacyPopover = false)}
      onclick={(e) => e.target === e.currentTarget && (showPrivacyPopover = false)}
      tabindex="-1"
    >
      <div class="bg-base-100 border border-base-300 rounded-xl shadow-md p-5 text-sm max-w-sm w-full flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <h3 id="privacy-heading" class="font-semibold text-base">Your data never leaves your device</h3>
          <button class="btn btn-xs btn-ghost shrink-0 -mt-1 -mr-1" onclick={() => showPrivacyPopover = false} aria-label="Close">✕</button>
        </div>
        <p class="text-base-content/60 leading-relaxed">StarLog stores everything — your stories, job profiles, and API key — in your browser's <code class="bg-base-200 px-1 rounded text-xs">localStorage</code>. This means:</p>
        <ul class="space-y-1.5 text-base-content/70">
          <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No account required. No email, no password.</span></li>
          <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No server. There is no StarLog backend that receives or stores your data.</span></li>
          <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>No sync. If you clear browser storage or switch browsers, your data is gone. Use Export to back it up.</span></li>
          <li class="flex gap-2"><span class="text-primary shrink-0">·</span><span>Your API key is only used to talk directly to Google's Gemini API — it is never sent to StarLog.</span></li>
        </ul>
        <p class="text-base-content/40 text-xs">This is a private, single-device tool. It is not designed for sharing or collaboration.</p>
        <button class="btn btn-sm btn-ghost self-end" onclick={() => showPrivacyPopover = false}>Got it</button>
      </div>
    </div>
  {/if}

  <!-- How it works modal -->
  {#if showHowItWorks}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-heading"
      onkeydown={(e) => e.key === 'Escape' && (showHowItWorks = false)}
      onclick={(e) => e.target === e.currentTarget && (showHowItWorks = false)}
      tabindex="-1"
    >
      <div class="bg-base-100 border border-base-300 rounded-xl shadow-md p-6 text-sm max-w-xl w-full flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-2">
          <h3 id="how-heading" class="font-semibold text-lg">Two ways to use StarLog</h3>
          <button class="btn btn-xs btn-ghost shrink-0 -mt-1 -mr-1" onclick={() => showHowItWorks = false} aria-label="Close">✕</button>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="border border-base-300 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <p class="font-semibold text-base">Job-first</p>
              <p class="text-xs text-base-content/50 mt-0.5">Recommended when you have a specific role to prep for</p>
            </div>
            <ol class="space-y-2 text-base-content/70">
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">1.</span><span>Paste the job description → AI extracts 5–7 competencies</span></li>
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">2.</span><span>For each competency with no story, StarLog prompts you to fill the gap</span></li>
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">3.</span><span>Record or type your story → AI structures it into STAR format</span></li>
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">4.</span><span>Rehearse in Interview Mode until it flows</span></li>
            </ol>
          </div>
          <div class="border border-base-300 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <p class="font-semibold text-base">Story-first</p>
              <p class="text-xs text-base-content/50 mt-0.5">Good for building a reusable bank before job-hunting</p>
            </div>
            <ol class="space-y-2 text-base-content/70">
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">1.</span><span>Start by capturing stories from memory — anything you're proud of</span></li>
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">2.</span><span>Add a job profile when you're ready to apply</span></li>
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">3.</span><span>Map your existing stories to the competencies it requires</span></li>
              <li class="flex gap-2"><span class="text-primary font-semibold shrink-0">4.</span><span>See which gaps remain and fill them</span></li>
            </ol>
          </div>
        </div>
        <p class="text-base-content/50 text-xs text-center">Either way, the Story Bank is always there. You own it across every application.</p>
        <button class="btn btn-primary btn-sm self-center px-8" onclick={() => showHowItWorks = false}>Got it</button>
      </div>
    </div>
  {/if}

<!-- ── Step 2: Job entry ────────────────────────────────────────────── -->
{:else if step === 'job-entry'}

  <div class="min-h-full flex items-center justify-center p-6">
    <div class="w-full max-w-xl flex flex-col gap-6">

      <!-- Progress -->
      {#if !addJobMode}
        <div class="flex items-center gap-2 text-sm text-base-content/50">
          <span class="w-5 h-5 rounded-full bg-success text-success-content text-xs flex items-center justify-center font-bold">✓</span>
          <span class="text-success text-xs">API key connected</span>
          <span class="text-base-content/20 mx-1">·</span>
          <span class="w-5 h-5 rounded-full bg-primary text-primary-content text-xs flex items-center justify-center font-bold">2</span>
          <span class="font-medium text-base-content">Add a job</span>
        </div>
      {/if}

      <div>
        <h1 class="text-2xl font-bold">What are you interviewing for?</h1>
        <p class="text-base-content/60 text-sm mt-1">
          Paste the job description — Gemini extracts the 5–7 competencies they'll interview you on.
        </p>
      </div>

      <!-- Optional: role + company -->
      <div class="grid grid-cols-2 gap-3">
        <div class="form-control">
          <label class="label py-0.5" for="job-role"><span class="label-text text-xs">Role title</span></label>
          <input
            id="job-role"
            class="input input-bordered input-sm"
            placeholder="Director of Engineering"
            bind:value={jobTitle}
            data-testid="profile-role"
          />
        </div>
        <div class="form-control">
          <label class="label py-0.5" for="job-company"><span class="label-text text-xs">Company</span></label>
          <input
            id="job-company"
            class="input input-bordered input-sm"
            placeholder="Acme Corp"
            bind:value={jobCompany}
            data-testid="profile-company"
          />
        </div>
      </div>

      <!-- JD textarea -->
      <div class="form-control">
        <label class="label py-0.5" for="jd-text"><span class="label-text text-xs">Job description</span></label>
        <textarea
          id="jd-text"
          class="textarea textarea-bordered h-48 resize-y"
          placeholder="Paste the full job description here…"
          bind:value={jobDescription}
          data-testid="profile-jd"
        ></textarea>
      </div>

      {#if extractError}
        <div class="alert alert-error text-sm">{extractError}</div>
      {/if}

      <div class="flex gap-3">
        <AiWorking active={extracting} class="flex-1">
          <button
            class="btn btn-primary w-full"
            onclick={extractJob}
            disabled={!jobDescription.trim() || extracting}
            data-testid="profile-submit"
          >
            {extracting ? 'Extracting competencies…' : 'Extract competencies →'}
          </button>
        </AiWorking>
        <button class="btn btn-ghost" onclick={skipJobEntry}>Skip</button>
      </div>

    </div>
  </div>

<!-- ── Step 3: Review extracted competencies ───────────────────────── -->
{:else if step === 'job-review'}

  <div class="min-h-full flex items-center justify-center p-6">
    <div class="w-full max-w-xl flex flex-col gap-6">

      <div class="flex items-center gap-2 text-sm text-base-content/50">
        <button class="hover:text-base-content transition-colors" onclick={() => step = 'job-entry'}>← Back</button>
      </div>

      <div>
        <h1 class="text-2xl font-bold">Review competencies</h1>
        <p class="text-base-content/60 text-sm mt-1">
          These are what {jobTitle || 'this role'} at {jobCompany || 'this company'} will likely interview you on.
          Edit before saving.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        {#each editableComps as comp}
          <div class="flex items-center justify-between px-4 py-2.5 border border-base-300 rounded-lg bg-base-100">
            <div class="flex items-center gap-2">
              <span class="text-success text-sm">✓</span>
              <span class="font-medium text-sm">{comp}</span>
            </div>
            <button
              class="btn btn-xs btn-ghost text-base-content/40 hover:text-error"
              onclick={() => removeComp(comp)}
              aria-label="Remove {comp}"
            >✕</button>
          </div>
        {/each}

        <!-- Add custom -->
        <div class="flex gap-2">
          <input
            class="input input-bordered input-sm flex-1"
            placeholder="Add a competency I missed…"
            bind:value={newComp}
            onkeydown={(e) => e.key === 'Enter' && addComp()}
          />
          <button class="btn btn-sm btn-ghost" onclick={addComp} disabled={!newComp.trim()}>+ Add</button>
        </div>
      </div>

      <div class="flex gap-3">
        <button
          class="btn btn-primary flex-1"
          onclick={saveJob}
          disabled={editableComps.length === 0}
          data-testid="profile-save"
        >
          Save · open job hub →
        </button>
      </div>

    </div>
  </div>

{/if}
