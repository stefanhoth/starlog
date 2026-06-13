<script lang="ts">
  import type { AiProvider } from '../types';
  import { canUseLocalLlm } from '../ai-capabilities';
  import LocalModelLoader from './LocalModelLoader.svelte';
  import { verifyApiKey } from '../gemini';
  import { GeminiError } from '../gemini-utils';

  let {
    apiKey = $bindable(''),
    selectedProvider = $bindable<AiProvider>('cloud'),
    localModelReady = $bindable(false),
    valid = $bindable(false),
    showGetKeyLink = false,
    alwaysShowLocalTab = false,
    onSubmit,
  }: {
    apiKey?: string;
    selectedProvider?: AiProvider;
    localModelReady?: boolean;
    valid?: boolean;
    showGetKeyLink?: boolean;
    alwaysShowLocalTab?: boolean;
    onSubmit?: () => void;
  } = $props();

  const localCapability = canUseLocalLlm();

  let verifying = $state(false);
  let verifyStatus = $state<'idle' | 'ok' | 'error'>('idle');
  let verifyError = $state('');
  let formatError = $state('');

  let validationSeq = 0;
  $effect(() => {
    const key = apiKey.trim();
    verifyStatus = 'idle';
    verifyError = '';
    formatError = '';
    verifying = false;
    if (!key || selectedProvider !== 'cloud') return;
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

  $effect(() => {
    valid = selectedProvider === 'local' ? localModelReady : verifyStatus === 'ok';
  });
</script>

{#if localCapability !== 'unsupported' || alwaysShowLocalTab}
  <div class="flex flex-col gap-1.5">
    <span class="text-sm font-medium">AI Provider</span>
    <div role="tablist" class="tabs tabs-boxed tabs-sm" data-testid="provider-toggle">
      <button
        role="tab"
        class="tab {selectedProvider === 'cloud' ? 'tab-active' : ''}"
        onclick={() => selectedProvider = 'cloud'}
        aria-selected={selectedProvider === 'cloud'}
        data-testid="provider-cloud"
      >Cloud (Gemini)</button>
      <button
        role="tab"
        class="tab {selectedProvider === 'local' ? 'tab-active' : ''}"
        onclick={() => selectedProvider = 'local'}
        aria-selected={selectedProvider === 'local'}
        data-testid="provider-local"
      >Local AI</button>
    </div>
  </div>
{/if}

{#if selectedProvider === 'cloud'}
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium" for="api-key">Gemini API Key</label>
      {#if showGetKeyLink}
        <a class="text-xs text-primary hover:text-primary/80 transition-colors"
          href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
          Get a free key ↗
        </a>
      {/if}
    </div>
    <div class="relative">
      <input
        id="api-key"
        type="password"
        class="input input-bordered w-full pr-10 text-sm bg-base-100
          {formatError ? 'input-error' : verifyStatus === 'ok' ? 'input-success' : verifyStatus === 'error' ? 'input-error' : ''}"
        placeholder="AIza…"
        bind:value={apiKey}
        onkeydown={(e) => e.key === 'Enter' && onSubmit?.()}
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
{:else}
  <LocalModelLoader onReady={() => { localModelReady = true; }} />
{/if}
