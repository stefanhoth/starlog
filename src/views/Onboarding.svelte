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

    // Kick off debounced live validation
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
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200 p-6">
  <div class="card bg-base-100 shadow-lg w-full max-w-md">
    <div class="card-body gap-4">

      <div class="text-center">
        <h1 class="text-3xl font-bold tracking-tight">StarLog</h1>
        <p class="text-base-content/60 mt-1">
          {#if isSettings}Edit your settings{:else}Your personal STAR story library{/if}
        </p>
      </div>

      {#if !isSettings}
        <div class="alert alert-info text-sm">
          <span>
            All your data stays in <strong>this browser only</strong>. Nothing is sent to any server
            except Gemini API calls using your own key.
          </span>
        </div>
      {/if}

      <div class="form-control gap-1">
        <label class="label" for="api-key">
          <span class="label-text font-medium">Gemini API Key</span>
          <a
            class="label-text-alt link"
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
          >Get a free key ↗</a>
        </label>
        <div class="relative">
          <input
            id="api-key"
            type="password"
            class="input input-bordered w-full pr-10 {formatError ? 'input-error' : verifyStatus === 'ok' ? 'input-success' : verifyStatus === 'error' ? 'input-error' : ''}"
            placeholder="AIza..."
            bind:value={apiKey}
            onkeydown={(e) => e.key === 'Enter' && submit()}
            data-testid="api-key-input"
          />
          <!-- Inline status icon -->
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
            {#if verifying}
              <span class="loading loading-spinner loading-xs text-base-content/40"></span>
            {:else if verifyStatus === 'ok'}
              <span class="text-success">✓</span>
            {:else if verifyStatus === 'error' || formatError}
              <span class="text-error">✕</span>
            {/if}
          </span>
        </div>

        {#if formatError}
          <p class="text-error text-sm mt-1" data-testid="key-format-error">{formatError}</p>
        {:else if verifyStatus === 'error'}
          <p class="text-error text-sm mt-1" data-testid="verify-error">{verifyError}</p>
        {:else if verifyStatus === 'ok'}
          <p class="text-success text-sm mt-1" data-testid="verify-success">✓ Key is valid and working.</p>
        {:else if verifying}
          <p class="text-base-content/50 text-sm mt-1">Verifying key…</p>
        {/if}
      </div>

      <button
        class="btn btn-primary w-full"
        onclick={submit}
        disabled={!canSave}
        data-testid="onboarding-submit"
      >
        {isSettings ? 'Save' : 'Get Started'}
      </button>

      {#if isSettings}
        <button class="btn btn-ghost w-full" onclick={() => navigate('library')}>
          Cancel
        </button>
      {/if}

    </div>
  </div>
</div>
