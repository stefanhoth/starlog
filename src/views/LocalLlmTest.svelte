<script lang="ts">
  import { Engine } from '@litert-lm/core';
  import { parseJson } from '../lib/gemini-utils';

  // ── Prompts (inlined from gemini.ts for the spike) ────────────────────────

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

  const INSPIRATION_PROMPT = (competency: string) =>
    `You are helping a professional recall real work experiences for job interviews.
Generate exactly 3 short, punchy questions for the competency: "${competency}".

Rules:
- Max 12 words per question
- Start with "When", "What", "How", or an action verb — never "Tell me about a time"
- Vary the angle: one about people/team dynamics, one about a challenge or failure, one about outcome or impact
- Plain conversational language, no corporate jargon

Respond with a JSON array of exactly 3 strings. No markdown, no extra keys.`;

  const DEFAULT_MODEL_URL =
    'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm';

  const SAMPLE_TRANSCRIPT =
    `I led a migration from our monolithic backend to microservices. We had a team of five engineers and the codebase had no tests at all. I started by running workshops with the team to identify clear service boundaries. Then we implemented a strangler fig pattern, building new services alongside the old system. We shipped incrementally over six months with zero downtime. By the end, our deployment frequency went from once a month to daily, and we reduced production incidents by sixty percent.`;

  // ── Feature detection ─────────────────────────────────────────────────────

  const webGpuAvailable =
    typeof navigator !== 'undefined' && 'gpu' in navigator;

  // JSPI (WebAssembly JS Promise Integration) is required by LiteRT LM.
  // Enabled by default in Chrome 126+; older versions need the flag.
  const jspiAvailable =
    typeof WebAssembly !== 'undefined' &&
    typeof (WebAssembly as Record<string, unknown>).Suspending === 'function';

  // ── Model loading state ───────────────────────────────────────────────────

  let modelUrl = $state(DEFAULT_MODEL_URL);
  let modelFile = $state<File | null>(null);

  let engine = $state<Engine | null>(null);
  let phase = $state<'idle' | 'downloading' | 'initialising' | 'ready' | 'generating-star' | 'generating-inspiration' | 'error'>('idle');
  let errorMsg = $state('');
  let downloadPct = $state<number | null>(null);
  let downloadedMB = $state(0);
  let totalMB = $state(0);
  let loadMs = $state<number | null>(null);

  // ── Test 1: STAR generation ───────────────────────────────────────────────

  let transcript = $state(SAMPLE_TRANSCRIPT);
  let starRaw = $state('');
  let starParsed = $state<unknown>(null);
  let starParseError = $state('');
  let starFirstTokenMs = $state<number | null>(null);
  let starTotalMs = $state<number | null>(null);

  // ── Test 2: Inspiration questions ─────────────────────────────────────────

  let inspirationCompetency = $state('Hiring');
  let inspirationRaw = $state('');
  let inspirationParsed = $state<string[] | null>(null);
  let inspirationParseError = $state('');
  let inspirationFirstTokenMs = $state<number | null>(null);
  let inspirationTotalMs = $state<number | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    modelFile = input.files?.[0] ?? null;
  }

  const isLoading = $derived(phase === 'downloading' || phase === 'initialising');
  const isGenerating = $derived(phase === 'generating-star' || phase === 'generating-inspiration');
  const isReady = $derived(phase === 'ready');

  // ── Model loading ─────────────────────────────────────────────────────────

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
        phase = 'initialising';
        modelSource = modelFile.stream() as unknown as ReadableStream<Uint8Array>;
      } else {
        const res = await fetch(modelUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const contentLength = Number(res.headers.get('content-length')) || 0;
        totalMB = Math.round(contentLength / 1_048_576);
        const reader = res.body!.getReader();

        modelSource = new ReadableStream<Uint8Array>({
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

  // ── Streaming helper ──────────────────────────────────────────────────────

  async function streamConversation(
    systemPrompt: string,
    userMessage: string,
    onChunk: (text: string) => void,
  ): Promise<{ firstTokenMs: number; totalMs: number }> {
    const conversation = await engine!.createConversation({
      preface: { messages: [{ role: 'system', content: systemPrompt }] },
    });
    const stream = conversation.sendMessageStreaming(userMessage);
    const reader = stream.getReader();
    const t0 = performance.now();
    let firstToken = 0;
    let gotFirst = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!gotFirst) { firstToken = Math.round(performance.now() - t0); gotFirst = true; }
      const text =
        typeof value.content === 'string'
          ? value.content
          : Array.isArray(value.content)
            ? value.content.map(c => c.text ?? '').join('')
            : '';
      onChunk(text);
    }

    return { firstTokenMs: firstToken, totalMs: Math.round(performance.now() - t0) };
  }

  // ── Test 1: STAR ──────────────────────────────────────────────────────────

  async function generateStar() {
    if (!engine) return;
    phase = 'generating-star';
    starRaw = '';
    starParsed = null;
    starParseError = '';
    starFirstTokenMs = null;
    starTotalMs = null;

    try {
      const timing = await streamConversation(
        STAR_PROMPT,
        `Transcript:\n${transcript}`,
        chunk => { starRaw += chunk; },
      );
      starFirstTokenMs = timing.firstTokenMs;
      starTotalMs = timing.totalMs;
      try { starParsed = parseJson(starRaw); } catch (e) {
        starParseError = e instanceof Error ? e.message : String(e);
      }
      phase = 'ready';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      phase = 'error';
    }
  }

  // ── Test 2: Inspiration questions ─────────────────────────────────────────

  async function generateInspiration() {
    if (!engine) return;
    phase = 'generating-inspiration';
    inspirationRaw = '';
    inspirationParsed = null;
    inspirationParseError = '';
    inspirationFirstTokenMs = null;
    inspirationTotalMs = null;

    try {
      const timing = await streamConversation(
        INSPIRATION_PROMPT(inspirationCompetency),
        'Generate the questions now.',
        chunk => { inspirationRaw += chunk; },
      );
      inspirationFirstTokenMs = timing.firstTokenMs;
      inspirationTotalMs = timing.totalMs;
      try {
        const parsed = parseJson<unknown>(inspirationRaw);
        if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
          inspirationParsed = parsed as string[];
        } else {
          inspirationParseError = `Expected string[], got: ${JSON.stringify(parsed).slice(0, 80)}`;
        }
      } catch (e) {
        inspirationParseError = e instanceof Error ? e.message : String(e);
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

  <!-- Feature checks -->
  <div class="space-y-1">
    <div>
      <span class="font-semibold">WebGPU:</span>
      {#if webGpuAvailable}
        <span class="text-green-600">✅ Available</span>
      {:else}
        <span class="text-red-600">❌ Not available — this will not work</span>
      {/if}
    </div>
    <div>
      <span class="font-semibold">JSPI (WebAssembly.Suspending):</span>
      {#if jspiAvailable}
        <span class="text-green-600">✅ Available</span>
      {:else}
        <span class="text-red-600">❌ Not available</span>
        <p class="text-xs text-red-700 mt-1">
          LiteRT LM requires WebAssembly JSPI. Enable it at
          <code class="bg-red-50 px-1">chrome://flags/#enable-experimental-webassembly-jspi</code>
          → set to <strong>Enabled</strong> → relaunch Chrome.
          Requires Chrome 115+ / Edge 115+.
        </p>
      {/if}
    </div>
  </div>

  <!-- Blocked state -->
  {#if !jspiAvailable || !webGpuAvailable}
    <div class="alert alert-error text-sm">
      Required browser features missing — see above. Nothing will work until both checks are green.
    </div>
  {/if}

  <!-- Model source -->
  <section class="space-y-2 border border-base-300 rounded p-4">
    <h2 class="font-semibold">Model source (pick one)</h2>

    <div class="space-y-1">
      <label for="model-url" class="block text-xs text-base-content/60">Remote URL (large download, ~2 GB):</label>
      <input
        id="model-url"
        class="input input-bordered input-sm w-full font-mono text-xs"
        bind:value={modelUrl}
        placeholder="https://..."
        disabled={isLoading}
      />
      <p class="text-xs text-base-content/50">
        Note: HuggingFace may require CORS headers. If the fetch fails, download the file and use the picker below.
      </p>
    </div>

    <div class="space-y-1 mt-2">
      <label for="model-file" class="block text-xs text-base-content/60">
        Local file (pre-downloaded <code>.litertlm</code> — recommended):
      </label>
      <input
        id="model-file"
        type="file"
        accept=".litertlm"
        onchange={onFileChange}
        disabled={isLoading}
        class="file-input file-input-sm file-input-bordered w-full"
      />
      {#if modelFile}
        <span class="text-xs text-green-700">
          Selected: {modelFile.name} ({Math.round(modelFile.size / 1_048_576)} MB)
        </span>
      {/if}
    </div>

    <button
      class="btn btn-primary btn-sm mt-2"
      onclick={loadModel}
      disabled={isLoading || (!jspiAvailable || !webGpuAvailable)}
    >
      {isReady ? 'Reload model' : 'Load model'}
    </button>
  </section>

  <!-- Load status -->
  {#if phase === 'downloading'}
    <div class="space-y-1">
      <p>⬇️ Downloading…
        {#if downloadPct !== null}
          {downloadedMB} / {totalMB} MB ({downloadPct}%)
        {:else}
          {downloadedMB} MB
        {/if}
      </p>
      <progress class="progress progress-primary w-full" value={downloadPct ?? undefined} max="100"></progress>
    </div>
  {:else if phase === 'initialising'}
    <p>⚙️ Initialising engine (WASM + WebGPU setup, 30–90 s)…</p>
    <progress class="progress progress-primary w-full"></progress>
  {:else if isReady}
    <p class="text-green-700">
      ✅ Ready — loaded in {loadMs !== null ? (loadMs / 1000).toFixed(1) + ' s' : '?'}
    </p>
  {:else if phase === 'error'}
    <p class="text-red-600">❌ {errorMsg}</p>
  {/if}

  <!-- ── Test 1: STAR generation ──────────────────────────────────────── -->
  <section
    class="space-y-2 border border-base-300 rounded p-4"
    class:opacity-40={!isReady && phase !== 'generating-star'}
  >
    <h2 class="font-semibold">Test 1 — STAR story from transcript</h2>

    <label for="transcript" class="block text-xs text-base-content/60">
      Transcript (text only — no audio in local mode):
    </label>
    <textarea
      id="transcript"
      class="textarea textarea-bordered w-full font-mono text-xs h-28"
      bind:value={transcript}
      disabled={!isReady}
    ></textarea>

    <button
      class="btn btn-secondary btn-sm"
      onclick={generateStar}
      disabled={!isReady}
    >
      {phase === 'generating-star' ? 'Generating…' : 'Generate STAR story'}
    </button>

    {#if starRaw || phase === 'generating-star'}
      <div class="space-y-3 pt-2">
        {#if starFirstTokenMs !== null}
          <p class="text-xs text-base-content/60">
            First token: <strong>{starFirstTokenMs} ms</strong>
            {#if starTotalMs !== null}· Total: <strong>{(starTotalMs / 1000).toFixed(1)} s</strong>{/if}
          </p>
        {:else}
          <p class="text-xs text-base-content/60">Streaming…</p>
        {/if}

        <div>
          <p class="text-xs text-base-content/50 mb-1">Raw:</p>
          <pre class="bg-base-200 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">{starRaw || '…'}</pre>
        </div>

        {#if starParsed !== null}
          <div>
            <p class="text-xs text-green-700 mb-1">✅ Parsed JSON:</p>
            <pre class="bg-green-50 border border-green-200 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto">{JSON.stringify(starParsed, null, 2)}</pre>
          </div>
        {:else if starParseError}
          <p class="text-xs text-red-600">❌ JSON parse failed: {starParseError}</p>
        {/if}
      </div>
    {/if}
  </section>

  <!-- ── Test 2: Inspiration questions ──────────────────────────────────── -->
  <section
    class="space-y-2 border border-base-300 rounded p-4"
    class:opacity-40={!isReady && phase !== 'generating-inspiration'}
  >
    <h2 class="font-semibold">Test 2 — Inspiration questions</h2>

    <div class="flex items-center gap-2">
      <label for="competency" class="text-xs text-base-content/60 shrink-0">Competency:</label>
      <input
        id="competency"
        class="input input-bordered input-sm font-mono text-xs"
        bind:value={inspirationCompetency}
        disabled={!isReady}
      />
    </div>

    <button
      class="btn btn-secondary btn-sm"
      onclick={generateInspiration}
      disabled={!isReady}
    >
      {phase === 'generating-inspiration' ? 'Generating…' : 'Generate questions'}
    </button>

    {#if inspirationRaw || phase === 'generating-inspiration'}
      <div class="space-y-3 pt-2">
        {#if inspirationFirstTokenMs !== null}
          <p class="text-xs text-base-content/60">
            First token: <strong>{inspirationFirstTokenMs} ms</strong>
            {#if inspirationTotalMs !== null}· Total: <strong>{(inspirationTotalMs / 1000).toFixed(1)} s</strong>{/if}
          </p>
        {:else}
          <p class="text-xs text-base-content/60">Streaming…</p>
        {/if}

        <div>
          <p class="text-xs text-base-content/50 mb-1">Raw:</p>
          <pre class="bg-base-200 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{inspirationRaw || '…'}</pre>
        </div>

        {#if inspirationParsed !== null}
          <div>
            <p class="text-xs text-green-700 mb-1">✅ Parsed — {inspirationParsed.length} questions:</p>
            <ol class="list-decimal list-inside space-y-1">
              {#each inspirationParsed as q}
                <li class="text-sm">{q}</li>
              {/each}
            </ol>
          </div>
        {:else if inspirationParseError}
          <p class="text-xs text-red-600">❌ Parse failed: {inspirationParseError}</p>
        {/if}
      </div>
    {/if}
  </section>
</div>
