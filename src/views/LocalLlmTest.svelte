<script lang="ts">
  import { Engine } from '@litert-lm/core';
  import { parseJson } from '../lib/gemini-utils';

  // STAR_PROMPT — same as in gemini.ts, inlined here for the spike
  const STAR_PROMPT = `You are a career coach helping a job applicant structure their interview stories.

Your job: rewrite the following transcript as a concise, polished STAR story IN ENGLISH.
Output ONLY valid JSON — no preamble, no markdown fences, no explanation.

Use this exact JSON structure:
{
  "title": "Short story title in English (5-8 words)",
  "original_language": "en",
  "competency_tags": ["1-3 tags from: Leadership, Delivery, Conflict, Ambiguity, Influence, Technical Depth, Customer Focus, Growth/Learning, Hiring, Stakeholder Management, Cross-functional Collaboration, Manager of Managers"],
  "star": {
    "situation": "string",
    "task": "string",
    "action": ["step 1", "step 2", "step 3"],
    "result": "string"
  },
  "quality": {
    "situation": "high | medium | low",
    "task": "high | medium | low",
    "action": "high | medium | low",
    "result": "high | medium | low",
    "notes": "Honest 1-2 sentence assessment."
  }
}`;

  const DEFAULT_MODEL_URL =
    'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm';

  const SAMPLE_TRANSCRIPT =
    `I led a migration from our monolithic backend to microservices. We had a team of five engineers and the codebase had no tests at all. I started by running workshops with the team to identify clear service boundaries. Then we implemented a strangler fig pattern, building new services alongside the old system. We shipped incrementally over six months with zero downtime. By the end, our deployment frequency went from once a month to daily, and we reduced production incidents by sixty percent.`;

  let modelUrl = $state(DEFAULT_MODEL_URL);
  let modelFile = $state<File | null>(null);
  let fileInput = $state<HTMLInputElement | undefined>();

  let engine = $state<Engine | null>(null);
  let phase = $state<'idle' | 'downloading' | 'initialising' | 'ready' | 'generating' | 'error'>('idle');
  let errorMsg = $state('');
  let downloadPct = $state<number | null>(null);
  let downloadedMB = $state(0);
  let totalMB = $state(0);
  let loadMs = $state<number | null>(null);

  let transcript = $state(SAMPLE_TRANSCRIPT);
  let rawResponse = $state('');
  let parsedResult = $state<unknown>(null);
  let parseError = $state('');
  let firstTokenMs = $state<number | null>(null);
  let totalGenerateMs = $state<number | null>(null);

  const webGpuAvailable =
    typeof navigator !== 'undefined' && 'gpu' in navigator;

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    modelFile = input.files?.[0] ?? null;
  }

  async function loadModel() {
    phase = 'downloading';
    downloadPct = null;
    downloadedMB = 0;
    totalMB = 0;
    errorMsg = '';
    const t0 = performance.now();

    try {
      let modelSource: string | ReadableStream<Uint8Array>;

      if (modelFile) {
        // Local file — no HTTP download, stream directly
        phase = 'initialising';
        modelSource = modelFile.stream() as unknown as ReadableStream<Uint8Array>;
      } else {
        // Remote URL — fetch with progress tracking
        const res = await fetch(modelUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const contentLength = Number(res.headers.get('content-length')) || 0;
        totalMB = Math.round(contentLength / 1_048_576);
        const body = res.body!;
        const reader = body.getReader();

        modelSource = new ReadableStream<Uint8Array>({
          async start(controller) {
            let received = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) { controller.close(); break; }
              received += value.byteLength;
              downloadedMB = Math.round(received / 1_048_576);
              downloadPct = contentLength
                ? Math.round((received / contentLength) * 100)
                : null;
              controller.enqueue(value);
            }
          },
          cancel() { reader.cancel(); },
        });
      }

      phase = 'initialising';
      engine = await Engine.create({ model: modelSource });
      loadMs = Math.round(performance.now() - t0);
      phase = 'ready';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      phase = 'error';
    }
  }

  async function generate() {
    if (!engine) return;
    phase = 'generating';
    rawResponse = '';
    parsedResult = null;
    parseError = '';
    firstTokenMs = null;
    totalGenerateMs = null;

    const t0 = performance.now();
    try {
      const conversation = await engine.createConversation({
        preface: { messages: [{ role: 'system', content: STAR_PROMPT }] },
      });

      const stream = conversation.sendMessageStreaming(`Transcript:\n${transcript}`);
      const reader = stream.getReader();
      let gotFirst = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!gotFirst) { firstTokenMs = Math.round(performance.now() - t0); gotFirst = true; }
        const text =
          typeof value.content === 'string'
            ? value.content
            : Array.isArray(value.content)
              ? value.content.map(c => c.text ?? '').join('')
              : '';
        rawResponse += text;
      }

      totalGenerateMs = Math.round(performance.now() - t0);

      try {
        parsedResult = parseJson(rawResponse);
      } catch (e) {
        parseError = e instanceof Error ? e.message : String(e);
      }

      phase = 'ready';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      phase = 'error';
    }
  }
</script>

<div class="max-w-3xl mx-auto p-6 font-mono text-sm space-y-6">
  <h1 class="text-xl font-bold">⚗️ Local LLM Spike — LiteRT LM / Gemma</h1>

  <!-- WebGPU status -->
  <div>
    <span class="font-semibold">WebGPU:</span>
    {#if webGpuAvailable}
      <span class="text-green-600">✅ Available</span>
    {:else}
      <span class="text-red-600">❌ Not available — this will not work</span>
    {/if}
  </div>

  <!-- Model source -->
  <section class="space-y-2 border border-base-300 rounded p-4">
    <h2 class="font-semibold">Model source (pick one)</h2>

    <div class="space-y-1">
      <label for="model-url" class="block text-xs text-base-content/60">Remote URL (large download, ~2–4 GB):</label>
      <input
        id="model-url"
        class="input input-bordered input-sm w-full font-mono text-xs"
        bind:value={modelUrl}
        placeholder="https://..."
        disabled={phase !== 'idle' && phase !== 'error'}
      />
      <p class="text-xs text-base-content/50">
        Note: HuggingFace may require CORS headers. If the fetch fails, use a local file instead.
      </p>
    </div>

    <div class="space-y-1 mt-2">
      <label for="model-file" class="block text-xs text-base-content/60">Local file (pre-downloaded <code>.litertlm</code>):</label>
      <input
        id="model-file"
        type="file"
        accept=".litertlm"
        onchange={onFileChange}
        bind:this={fileInput}
        disabled={phase !== 'idle' && phase !== 'error'}
        class="file-input file-input-sm file-input-bordered w-full"
      />
      {#if modelFile}
        <span class="text-xs text-green-700">Selected: {modelFile.name} ({Math.round(modelFile.size / 1_048_576)} MB)</span>
      {/if}
    </div>

    <button
      class="btn btn-primary btn-sm mt-2"
      onclick={loadModel}
      disabled={phase !== 'idle' && phase !== 'error' && phase !== 'ready'}
    >
      {phase === 'ready' ? 'Reload model' : 'Load model'}
    </button>
  </section>

  <!-- Load status -->
  {#if phase === 'downloading'}
    <div class="space-y-1">
      <p>⬇️ Downloading model…
        {#if downloadPct !== null}
          {downloadedMB} / {totalMB} MB ({downloadPct}%)
        {:else}
          {downloadedMB} MB downloaded
        {/if}
      </p>
      {#if downloadPct !== null}
        <progress class="progress progress-primary w-full" value={downloadPct} max="100"></progress>
      {:else}
        <progress class="progress progress-primary w-full"></progress>
      {/if}
    </div>
  {:else if phase === 'initialising'}
    <p>⚙️ Initialising engine… (WASM + GPU setup, may take 30–90 s)</p>
    <progress class="progress progress-primary w-full"></progress>
  {:else if phase === 'ready'}
    <p class="text-green-700">
      ✅ Model ready — loaded in {loadMs !== null ? (loadMs / 1000).toFixed(1) + ' s' : '?'}
    </p>
  {:else if phase === 'error'}
    <p class="text-red-600">❌ Error: {errorMsg}</p>
  {/if}

  <!-- Generation -->
  <section class="space-y-2 border border-base-300 rounded p-4" class:opacity-40={phase !== 'ready' && phase !== 'generating'}>
    <h2 class="font-semibold">Generate STAR story</h2>

    <label for="transcript" class="block text-xs text-base-content/60">Transcript (text only — no audio in local mode):</label>
    <textarea
      id="transcript"
      class="textarea textarea-bordered w-full font-mono text-xs h-28"
      bind:value={transcript}
      disabled={phase !== 'ready'}
    ></textarea>

    <button
      class="btn btn-secondary btn-sm"
      onclick={generate}
      disabled={phase !== 'ready'}
    >
      Generate
    </button>
  </section>

  <!-- Results -->
  {#if phase === 'generating' || rawResponse}
    <section class="space-y-4 border border-base-300 rounded p-4">
      <h2 class="font-semibold">Results</h2>

      {#if firstTokenMs !== null}
        <p class="text-xs text-base-content/60">
          First token: <strong>{firstTokenMs} ms</strong>
          {#if totalGenerateMs !== null}
            &nbsp;· Total: <strong>{(totalGenerateMs / 1000).toFixed(1)} s</strong>
          {/if}
        </p>
      {:else}
        <p class="text-xs text-base-content/60">Generating…</p>
      {/if}

      <div>
        <p class="text-xs text-base-content/60 mb-1">Raw response:</p>
        <pre class="bg-base-200 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-60 overflow-y-auto">{rawResponse || '…'}</pre>
      </div>

      {#if parsedResult !== null}
        <div>
          <p class="text-xs text-green-700 mb-1">✅ Parsed JSON:</p>
          <pre class="bg-green-50 border border-green-200 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">{JSON.stringify(parsedResult, null, 2)}</pre>
        </div>
      {:else if parseError}
        <div>
          <p class="text-xs text-red-600 mb-1">❌ JSON parse failed: {parseError}</p>
          <p class="text-xs text-base-content/50">The model may need a JSON-constrained generation mode or prompt tuning.</p>
        </div>
      {/if}
    </section>
  {/if}
</div>
