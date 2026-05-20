<script lang="ts">
  import { settingsStore } from '../lib/stores/settings';
  import { navigate } from '../lib/stores/view';
  import { verifyApiKey, GeminiError } from '../lib/gemini';

  let apiKey = $state($settingsStore.apiKey ?? '');
  let verifying = $state(false);
  let verifyStatus = $state<'idle' | 'ok' | 'error'>('idle');
  let verifyError = $state('');
  let formatError = $state('');

  const isSettings = $derived($settingsStore.consentGiven);
  const canSave = $derived(verifyStatus === 'ok');

  // Auto-validate with 600 ms debounce whenever the key changes
  let validationSeq = 0;
  $effect(() => {
    const key = apiKey.trim();

    // Reset all feedback on every keystroke
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

  function submit() {
    if (!canSave) return;
    settingsStore.set({ apiKey: apiKey.trim(), consentGiven: true });
    navigate('library');
  }

  const features = [
    'Voice, file, or text capture — AI structures your STAR story',
    'Map stories to job postings and see your competency coverage',
    'Full-screen interview mode with keyboard navigation',
    'Browser-local — no account, no server, nothing leaves your device',
  ];

  const steps = [
    { icon: '🎙️', title: 'Capture',       desc: 'Record, upload, or paste a rough description of any past experience' },
    { icon: '✨', title: 'AI structures',  desc: 'Gemini extracts a clean STAR story — Situation, Task, Action, Result' },
    { icon: '📚', title: 'Build library',  desc: 'Edit, tag by competency, rank by strength, and add private notes' },
    { icon: '🎯', title: 'Rehearse',       desc: 'Map to job profiles, find gaps, and drill in full-screen interview mode' },
  ];
</script>

<!-- ── Settings mode: compact card inside the app shell ───────────── -->
{#if isSettings}

  <div class="min-h-full flex items-center justify-center p-6">
    <div class="bg-base-100 border border-base-300 rounded-2xl shadow-sm w-full max-w-sm p-6 flex flex-col gap-5">

      <div>
        <h2 class="font-semibold text-base text-base-content">Settings</h2>
        <p class="text-sm text-slate-400 mt-0.5">Update your Gemini API key</p>
      </div>

      <!-- API key field -->
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium text-base-content" for="api-key">Gemini API Key</label>
        <div class="relative">
          <input
            id="api-key"
            type="password"
            class="input input-bordered w-full pr-10 text-sm
              {formatError ? 'input-error' : verifyStatus === 'ok' ? 'input-success' : verifyStatus === 'error' ? 'input-error' : ''}"
            placeholder="AIza…"
            bind:value={apiKey}
            onkeydown={(e) => e.key === 'Enter' && submit()}
            data-testid="api-key-input"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
            {#if verifying}
              <span class="loading loading-spinner loading-xs text-slate-400"></span>
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
          <p class="text-slate-400 text-xs mt-0.5">Verifying…</p>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <button
          class="btn btn-primary w-full"
          onclick={submit}
          disabled={!canSave}
          data-testid="onboarding-submit"
        >
          Save
        </button>
        <button class="btn btn-ghost w-full text-slate-500" onclick={() => navigate('library')}>
          Cancel
        </button>
      </div>

    </div>
  </div>

<!-- ── New user: full-page landing ────────────────────────────────── -->
{:else}

  <div class="min-h-screen bg-base-100 flex flex-col">

    <!-- Hero: value prop on the left, form on the right -->
    <div class="flex-1 grid lg:grid-cols-[1fr_400px]">

      <!-- Left: pitch -->
      <div class="flex flex-col justify-center px-8 py-14 lg:px-16 xl:px-24">

        <!-- Wordmark -->
        <div class="flex items-center gap-2 mb-10">
          <span class="text-indigo-600 font-bold text-2xl leading-none">★</span>
          <span class="font-bold text-lg tracking-tight text-base-content">StarLog</span>
        </div>

        <!-- Headline -->
        <h1 class="text-4xl lg:text-5xl font-bold tracking-tight text-base-content leading-[1.1]">
          Walk into every interview<br class="hidden sm:block">
          with the right story.
        </h1>

        <!-- Sub-headline -->
        <p class="mt-5 text-lg text-slate-500 leading-relaxed max-w-lg">
          Speak or type a past experience — Gemini AI structures it into a polished STAR answer in seconds.
          Map stories to job descriptions, spot gaps, and rehearse until you're ready.
        </p>

        <!-- Feature bullets -->
        <ul class="mt-8 flex flex-col gap-3">
          {#each features as feature}
            <li class="flex items-start gap-3 text-sm text-slate-600">
              <span class="text-indigo-500 font-bold shrink-0 mt-0.5">✓</span>
              {feature}
            </li>
          {/each}
        </ul>

        <!-- Privacy assurance -->
        <p class="mt-10 text-xs text-slate-400">
          🔒 Everything stays in your browser. No account, no server.
        </p>
      </div>

      <!-- Right: API key form on a subtly different background -->
      <div class="bg-slate-50 border-l border-slate-200 flex items-center justify-center p-8 lg:p-10">
        <div class="w-full max-w-sm flex flex-col gap-5">

          <div>
            <h2 class="text-xl font-semibold text-base-content">Connect Gemini AI</h2>
            <p class="text-sm text-slate-400 mt-1 leading-relaxed">
              StarLog uses your own Gemini API key.
              The free tier is more than enough.
            </p>
          </div>

          <!-- API key field -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-base-content" for="api-key">Gemini API Key</label>
              <a
                class="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
              >Get a free key ↗</a>
            </div>

            <div class="relative">
              <input
                id="api-key"
                type="password"
                class="input input-bordered w-full pr-10 text-sm bg-white
                  {formatError ? 'input-error' : verifyStatus === 'ok' ? 'input-success' : verifyStatus === 'error' ? 'input-error' : ''}"
                placeholder="AIza…"
                bind:value={apiKey}
                onkeydown={(e) => e.key === 'Enter' && submit()}
                data-testid="api-key-input"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
                {#if verifying}
                  <span class="loading loading-spinner loading-xs text-slate-400"></span>
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
              <p class="text-slate-400 text-xs mt-0.5">Verifying key…</p>
            {/if}
          </div>

          <button
            class="btn btn-primary w-full"
            onclick={submit}
            disabled={!canSave}
            data-testid="onboarding-submit"
          >
            Get Started
          </button>

        </div>
      </div>
    </div>

    <!-- How it works strip -->
    <div class="border-t border-slate-200 bg-slate-50 py-10 px-8">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 text-center mb-8">
        How it works
      </p>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-3xl mx-auto">
        {#each steps as step, i}
          <div class="text-center">
            <div class="text-2xl mb-2">{step.icon}</div>
            <div class="text-sm font-semibold text-slate-700 mb-1">
              <span class="text-slate-400 font-normal text-xs">{i + 1}. </span>{step.title}
            </div>
            <div class="text-xs text-slate-400 leading-relaxed">{step.desc}</div>
          </div>
        {/each}
      </div>
    </div>

  </div>

{/if}
