<script lang="ts">
  import { canUseLocalLlm } from '../ai-capabilities';
  import { initEngine, isEngineReady } from '../local';

  interface Props {
    onReady?: () => void;
  }

  let { onReady = () => {} }: Props = $props();

  let localLlmState = $state(canUseLocalLlm());
  let modelStatus = $state<'idle' | 'downloading' | 'initialising' | 'ready' | 'error'>(
    isEngineReady() ? 'ready' : 'idle',
  );
  let modelError = $state('');
  let downloadPct = $state<number | null>(null);
  let downloadedMB = $state(0);
  let totalMB = $state(0);
  let modelUrl = $state(
    'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm',
  );
  let modelFile = $state<File | null>(null);
  let abortController = $state<AbortController | null>(null);
  let useFile = $state(false);
  let reducedMotion = $state(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  function recheck() {
    localLlmState = canUseLocalLlm();
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    modelFile = input.files?.[0] ?? null;
    if (modelFile) useFile = true;
  }

  async function loadFromUrl() {
    modelStatus = 'downloading';
    downloadPct = null;
    downloadedMB = 0;
    totalMB = 0;
    modelError = '';
    abortController = new AbortController();

    try {
      const res = await fetch(modelUrl, { signal: abortController.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const contentLength = Number(res.headers.get('content-length')) || 0;
      totalMB = contentLength ? Math.round(contentLength / 1_048_576) : 0;
      const reader = res.body!.getReader();

      const progressStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) { controller.close(); break; }
            received += value.byteLength;
            downloadedMB = Math.round(received / 1_048_576);
            downloadPct = contentLength ? Math.round((received / contentLength) * 100) : null;
            controller.enqueue(value);
          }
        },
        cancel() { reader.cancel(); },
      });

      modelStatus = 'initialising';
      await initEngine(progressStream);
      modelStatus = 'ready';
      onReady();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        modelStatus = 'idle';
        return;
      }
      modelError = err instanceof Error ? err.message : 'Failed to load model.';
      modelStatus = 'error';
    } finally {
      abortController = null;
    }
  }

  async function loadFromFile() {
    if (!modelFile) return;
    modelStatus = 'initialising';
    modelError = '';
    try {
      await initEngine(modelFile.stream() as unknown as ReadableStream<Uint8Array>);
      modelStatus = 'ready';
      onReady();
    } catch (err) {
      modelError = err instanceof Error ? err.message : 'Failed to load model.';
      modelStatus = 'error';
    }
  }

  function cancelDownload() {
    abortController?.abort();
  }
</script>

<!-- State 3: unsupported -->
{#if localLlmState === 'unsupported'}
  <div class="rounded-lg border border-base-300 bg-base-200 p-4 flex flex-col gap-2" aria-label="Local AI unavailable">
    <p class="text-sm font-medium">Local AI</p>
    <p class="text-xs text-base-content/60 leading-relaxed">
      Local AI is available in <strong>Chrome 137+</strong>, <strong>Edge 137+</strong>, and <strong>Opera 121+</strong>.
      Coming soon to your browser.
    </p>
    <p class="text-xs text-base-content/40">
      After a one-time model download, no data leaves your device.
    </p>
  </div>

<!-- State 2: needs flag -->
{:else if localLlmState === 'needs-flag'}
  <div class="rounded-lg border border-warning/40 bg-warning/5 p-4 flex flex-col gap-3" aria-label="Local AI needs flag">
    <p class="text-sm font-medium">You're one step away</p>
    <p class="text-xs text-base-content/70 leading-relaxed">
      Enable WebAssembly JSPI in Chrome flags to unlock local AI. Open a new tab and go to:
    </p>
    <code class="text-xs bg-base-100 border border-base-300 rounded px-2 py-1.5 block break-all select-all">
      chrome://flags/#enable-experimental-webassembly-jspi
    </code>
    <p class="text-xs text-base-content/50">
      Set to <strong>Enabled</strong>, then relaunch Chrome.
    </p>
    <button class="btn btn-xs btn-ghost self-start" onclick={recheck} data-testid="local-recheck">
      Recheck →
    </button>
  </div>

<!-- State 1: fully supported -->
{:else}
  {#if modelStatus === 'ready'}
    <div class="rounded-lg border border-success/40 bg-success/5 p-3 flex items-center justify-between gap-3" aria-label="Local model ready" data-testid="local-model-ready">
      <span class="text-success text-xs font-medium">✓ Model loaded — local AI ready</span>
      <button class="btn btn-xs btn-ghost text-base-content/50" onclick={() => { modelStatus = 'idle'; useFile = false; }}>
        Change
      </button>
    </div>

  {:else if modelStatus === 'downloading'}
    <div class="flex flex-col gap-2" aria-live="polite" aria-label="Downloading model">
      <div class="flex items-center justify-between text-xs text-base-content/60">
        <span>Downloading model{totalMB > 0 ? ` (${totalMB} MB total)` : ''}…</span>
        <span>{downloadedMB} MB{downloadPct !== null ? ` · ${downloadPct}%` : ''}</span>
      </div>
      <progress
        class="progress progress-primary w-full"
        value={downloadPct ?? undefined}
        max={downloadPct !== null ? 100 : undefined}
        aria-label={downloadPct !== null ? `${downloadPct}% downloaded` : 'Downloading'}
      ></progress>
      <button class="btn btn-xs btn-ghost self-start text-base-content/50" onclick={cancelDownload}>
        Cancel
      </button>
    </div>

  {:else if modelStatus === 'initialising'}
    <div class="flex flex-col gap-2" aria-live="polite" aria-label="Initialising model">
      <div class="flex items-center gap-2 text-xs text-base-content/60">
        {#if !reducedMotion}
          <span class="loading loading-spinner loading-xs" aria-hidden="true" data-testid="local-spinner"></span>
        {/if}
        <span>Initialising model — this takes 30–90 s…</span>
      </div>
      {#if reducedMotion}
        <p class="text-xs text-base-content/40" data-testid="local-static-progress">Please wait…</p>
      {:else}
        <progress class="progress progress-primary w-full" aria-label="Initialising"></progress>
      {/if}
    </div>

  {:else}
    <!-- idle / error -->
    {#if modelStatus === 'error'}
      <div class="alert alert-error text-xs py-2" role="alert" data-testid="local-model-error">
        <span>{modelError}</span>
      </div>
    {/if}

    <div class="flex flex-col gap-3">
      <div role="tablist" class="tabs tabs-boxed tabs-sm">
        <button
          role="tab"
          class="tab {!useFile ? 'tab-active' : ''}"
          onclick={() => useFile = false}
          aria-selected={!useFile}
        >From URL</button>
        <button
          role="tab"
          class="tab {useFile ? 'tab-active' : ''}"
          onclick={() => useFile = true}
          aria-selected={useFile}
        >From file</button>
      </div>

      {#if !useFile}
        <div class="flex flex-col gap-1.5">
          <input
            type="url"
            class="input input-bordered input-sm text-xs"
            bind:value={modelUrl}
            placeholder="https://…"
            aria-label="Model URL"
            data-testid="local-model-url"
          />
          <p class="text-xs text-base-content/40">
            ~2 GB download. Stays in your browser's cache after first load.
          </p>
        </div>
        <button
          class="btn btn-sm btn-primary"
          onclick={loadFromUrl}
          disabled={!modelUrl.trim()}
          data-testid="local-load-url"
        >
          Download &amp; load model
        </button>
      {:else}
        <label class="btn btn-sm btn-outline cursor-pointer" data-testid="local-file-label">
          {modelFile ? `📄 ${modelFile.name}` : 'Choose .litertlm file…'}
          <input
            type="file"
            accept=".litertlm"
            class="hidden"
            onchange={onFileChange}
            data-testid="local-file-input"
          />
        </label>
        {#if modelFile}
          <button
            class="btn btn-sm btn-primary"
            onclick={loadFromFile}
            data-testid="local-load-file"
          >
            Load model
          </button>
        {/if}
      {/if}
    </div>
  {/if}
{/if}
